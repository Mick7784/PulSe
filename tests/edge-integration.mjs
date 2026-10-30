// Docker-only isolated test. No socket mounted in Traefik, no host network, no VPS.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,copyFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import http from 'node:http';
import https from 'node:https';
import {setTimeout as delay} from 'node:timers/promises';
import {edgePolicy} from '../security/edge-policy.mjs';
const root=await mkdtemp(join(tmpdir(),'pulse-edge-')),suffix=process.pid+'-'+Date.now();
const network='pulse-edge-'+suffix,links='links-'+suffix,pulse='pulse-'+suffix,proxy='proxy-'+suffix;
const secret='fixture-bridge-token-not-production-12345',password='fixture-basic-password';
const auth='Basic '+Buffer.from('admin:'+password).toString('base64'),started=[];
const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const start=(name,args)=>{docker(['run','-d','--name',name,'--network',network,...args]);started.push(name)};
const config=edgePolicy({pulseHosts:['pulse.test','old-pulse.test'],linksHosts:['links.test','www.links.test'],publicEntryPoints:[{name:'public-http',tls:false},{name:'public-https',tls:true}]});
// Simulate stale public PulSe routes: the generated deny must win over both.
Object.assign(config.http.routers,{
 'old-pulse-http':{entryPoints:['public-http'],rule:'Host(`pulse.test`) || Host(`old-pulse.test`)',service:'pulse'},
 'old-pulse-https':{entryPoints:['public-https'],rule:'Host(`pulse.test`) || Host(`old-pulse.test`)',service:'pulse',tls:{}},
 'links-http':{entryPoints:['public-http'],rule:'Host(`links.test`) || Host(`www.links.test`)',service:'links'},
 'links-https':{entryPoints:['public-https'],rule:'Host(`links.test`) || Host(`www.links.test`)',service:'links',tls:{}},
 'private-pulse':{entryPoints:['private-https'],rule:'Host(`pulse.test`)',service:'pulse',tls:{}}
});
config.http.services={pulse:{loadBalancer:{servers:[{url:'http://'+pulse+':4173'}]}},links:{loadBalancer:{servers:[{url:'http://'+links+':8080'}]}}};
config.tls={certificates:[{certFile:'/config/cert.pem',keyFile:'/config/key.pem'}]};
try{
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=pulse.test','-addext','subjectAltName=DNS:pulse.test,DNS:old-pulse.test,DNS:links.test,DNS:www.links.test','-keyout',join(root,'key.pem'),'-out',join(root,'cert.pem')],{stdio:'ignore'});
 await chmod(root,0o755);
 // JSON is a YAML subset; Traefik's file provider selects its decoder by suffix.
 await writeFile(join(root,'dynamic.yaml'),JSON.stringify(config));
 await copyFile(new URL('./fixtures/links-edge.mjs',import.meta.url),join(root,'links.mjs'));
 const ca=await readFile(join(root,'cert.pem'));
 docker(['network','create',network]);
 start(links,['-v',root+':/fixture:ro','-e','PULSE_BRIDGE_TOKEN='+secret,'pulse-validation','node','/fixture/links.mjs']);
 start(pulse,['--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','-e','PULSE_TEST_USER=admin','-e','PULSE_TEST_PASSWORD='+password,'-e','PULSE_BRIDGE_TOKEN='+secret,'-e','LINKS_PUBLIC_URL=http://'+links+':8080','-e','LINKS_BRIDGE_URL=http://'+links+':8080','pulse-validation']);
 start(proxy,['-p','127.0.0.1::8080','-p','127.0.0.1::8443','-p','127.0.0.1::8444','-v',root+':/config:ro','traefik:v3.6.1','--entrypoints.public-http.address=:8080','--entrypoints.public-https.address=:8443','--entrypoints.private-https.address=:8444','--providers.file.filename=/config/dynamic.yaml','--log.level=ERROR']);
 const port=p=>Number(docker(['port',proxy,p+'/tcp']).split(':').at(-1));
 const ports={http:port(8080),https:port(8443),private:port(8444)};
 const request=(side,host,path,headers={},method='GET',body)=>new Promise((resolve,reject)=>{
  const req=(side==='http'?http:https).request({hostname:'127.0.0.1',port:ports[side],servername:host,ca,path,method,headers:{Host:host,...headers},timeout:8000},res=>{
   let data='';res.on('data',b=>data+=b);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:data}));
  });req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Timeout')));req.end(body);
 });
 for(let i=0;;i++){
  try{if((await request('https','links.test','/')).status===200)break}catch{}
  if(i>=40)throw Error('Test proxy did not become ready');await delay(250);
 }
 const count=async()=>JSON.parse((await request('https','links.test','/fixture-count')).body).bridgeCalls;
 assert.equal(await count(),0);
 for(const side of ['http','https']){
  for(const host of ['pulse.test','old-pulse.test'])for(const path of ['/','/healthz','/manifest.webmanifest','/icon-192.png','/api/catalog','/api/stats']){
   const r=await request(side,host,path,{Authorization:auth,'X-Forwarded-For':'127.0.0.1','X-Forwarded-Host':'links.test'});
   assert.equal(r.status,418,side+' '+host+path);assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.body,'');
  }
  for(const host of ['links.test','www.links.test'])for(const path of ['/api/pulse','/api/pulse/links','/api/pulse/stats?days=7','/api/pulse/story-link','/api//pulse/links','//api/pulse/links','/%61pi/pulse/links','/api/%70ulse/links','/api%2fpulse/links','/x/../api/pulse/links'])for(const method of ['GET','POST','HEAD','OPTIONS']){
   const r=await request(side,host,path,{Authorization:'Bearer '+secret,'X-Forwarded-For':'127.0.0.1'},method);
   assert.ok([400,418].includes(r.status),method+' '+side+' '+host+path+' = '+r.status);
  }
  for(const path of ['/','/api/public-config','/latest-video.json','/assets/fixture.css','/uploads/fixture.png','/api/pulse-other'])assert.equal((await request(side,'links.test',path)).status,200,path);
  for(const path of ['/abc123456','/go/fixture']){const r=await request(side,'links.test',path);assert.equal(r.status,302);assert.equal(r.headers.location,'https://partner.test/unchanged')}
 }
 assert.equal(await count(),0,'external requests must never reach the bridge, even with its token');
 assert.equal((await request('private','pulse.test','/')).status,401);
 assert.equal((await request('private','pulse.test','/',{Authorization:'Basic wrong'})).status,401);
 assert.equal((await request('private','pulse.test','/',{Authorization:auth})).status,200);
 assert.equal((await request('private','pulse.test','/manifest.webmanifest')).status,200);
 const catalog=await request('private','pulse.test','/api/catalog',{Authorization:auth});
 assert.equal(JSON.parse(catalog.body).trackedAvailable,true);assert.ok(!catalog.body.includes(secret));
 assert.equal(JSON.parse((await request('private','pulse.test','/api/stats',{Authorization:auth})).body).available,true);
 const story=await request('private','pulse.test','/api/story-link',{Authorization:auth,'Content-Type':'application/json','X-PulSe-Request':'1'},'POST',JSON.stringify({type:'independent',id:'private'}));
 assert.deepEqual(JSON.parse(story.body),{url:'https://links.test/abc123456',tracked:true});
 assert.equal(await count(),3);
 // Validate the candidate Compose without printing its interpolated secrets.
 const env={...process.env,PULSE_PRIVATE_IMAGE:'pulse-validation',PULSE_TEST_USER:'admin',PULSE_TEST_PASSWORD:password,PULSE_BRIDGE_TOKEN:secret,LINKS_PUBLIC_URL:'http://links:8080',LINKS_BRIDGE_URL:'http://links:8080',PULSE_PRIVATE_NETWORK:'fixture-private',LINKS_BRIDGE_NETWORK:'fixture-bridge'};
 const compose=JSON.parse(execFileSync('docker',['compose','-f',resolve('security/compose.private.yaml'),'config','--format','json'],{env,encoding:'utf8'}));
 assert.ok(!compose.services.pulse.ports?.length);assert.equal(compose.services.pulse.environment.PULSE_REQUIRE_AUTH,'1');
 assert.equal(compose.services.pulse.labels['traefik.enable'],'false');
 console.log('PASS actual Traefik 3.6.1: HTTP/HTTPS denial, encoded paths, old public routes, spoofed headers, internal bridge, Basic, public LinKs and short-link contracts, private Compose. VPN and production not tested.');
}catch(error){
 for(const name of started){try{console.error(name,docker(['logs',name]))}catch{}}
 throw error;
}finally{
 for(const name of started.reverse()){try{docker(['rm','-f',name])}catch{}}
 try{docker(['network','rm',network])}catch{}
 await rm(root,{recursive:true,force:true});
}
