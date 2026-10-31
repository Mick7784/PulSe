import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createPulseServer} from '../serve.mjs';
const secret='fixture-bridge-secret-'.repeat(3),upstreamSecret='upstream-secret-never-exposed';
const open=async s=>{await new Promise(r=>s.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+s.address().port};
const close=s=>new Promise(r=>s.close(r));
test('private bridge: isolated Bearer, upstream redirects and errors never leak secrets',async()=>{
 let privateCalls=0,publicCalls=0,redirectHits=0,mode='ok';
 const sink=http.createServer((req,res)=>{redirectHits++;res.end('must not be reached')});const sinkURL=await open(sink);
 const upstream=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://fixture').pathname;
  res.setHeader('Content-Type','application/json');
  if(p.startsWith('/api/pulse/')){
   privateCalls++;assert.equal(req.headers.authorization,'Bearer '+secret);assert.equal(req.headers.cookie,undefined);
   if(mode==='redirect'){res.writeHead(302,{Location:sinkURL});return res.end()}
   if(mode==='error'){res.writeHead(500);return res.end(JSON.stringify({error:secret,upstreamSecret}))}
   if(p==='/api/pulse/links')return res.end(JSON.stringify({links:[{id:'private',name:'Private title',url:'https://partner.test',enabled:true,archived:false}],token:secret}));
   if(p==='/api/pulse/story-link')return res.end(JSON.stringify({url:'https://links.test/abc123456',token:secret,upstreamSecret}));
   res.writeHead(503);return res.end('{}');
  }
  publicCalls++;assert.equal(req.headers.authorization,undefined);assert.equal(req.headers.cookie,undefined);
  res.end(JSON.stringify(p==='/api/public-config'?{links:[],token:secret,upstreamSecret}:null));
 });const links=await open(upstream);
 const pulse=createPulseServer({bridgeToken:secret,linksURL:links,bridgeURL:links}),base=await open(pulse);
 const check=async response=>{
  assert.equal(response.headers.get('cache-control'),'no-store');
  const text=await response.text();for(const value of [secret,upstreamSecret,'Bearer '])assert.ok(!text.includes(value));
  for(const [,value] of response.headers)assert.ok(!value.includes(secret)&&!value.includes(upstreamSecret));return text;
 };
 try{
  const headers={Authorization:'Bearer browser-credential-never-forward',Cookie:'private-session=never-forward'};
  const catalog=JSON.parse(await check(await fetch(base+'/api/catalog',{headers})));
  assert.equal(catalog.trackedLinks[0].title,'Private title');
  const post=()=>fetch(base+'/api/story-link',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-PulSe-Request':'1'},body:JSON.stringify({type:'independent',id:'private',token:secret})});
  assert.deepEqual(JSON.parse(await check(await post())),{url:'https://links.test/abc123456',tracked:true});
  for(const path of ['/.env','/serve.mjs','/security/edge-input.example.json','/api/pulse/links']){const r=await fetch(base+path,{headers});assert.equal(r.status,404);await check(r)}
  for(const next of ['error','redirect']){mode=next;const r=await post();assert.equal(r.status,503);await check(r)}
  assert.equal(redirectHits,0,'Bearer-bearing redirects must never reach another server');
  assert.ok(privateCalls>=4);assert.ok(publicCalls>=2);
 }finally{await close(pulse);await close(upstream);await close(sink)}
});
