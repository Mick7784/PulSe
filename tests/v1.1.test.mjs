import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVideo} from '../catalog.mjs';
import {installationHelp} from '../pwa.mjs';
import {createPulseServer,startFromEnvironment} from '../serve.mjs';
const id='abcdefghijk',auth='Basic '+Buffer.from('admin:long-password-123').toString('base64');
const days=n=>Array.from({length:n},(_,i)=>({date:new Date(Date.UTC(2026,9,24-n+i)).toISOString().slice(0,10),clicks:i}));
const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
const open=async s=>{await new Promise(r=>s.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+s.address().port};
const close=s=>new Promise(r=>s.close(r));
test('YouTube metadata accepts only a video ID and matching trusted thumbnail',()=>{
 const v=normalizeVideo({url:'https://youtu.be/'+id,title:'Test',thumbnail:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg'});assert.equal(v.id,id);
 assert.equal(normalizeVideo({url:'https://youtube.com.evil.test/watch?v='+id}),null);
 assert.equal(normalizeVideo({url:'https://www.youtube.com/watch?v='+id,thumbnail:'https://evil.test/a.png'}).thumbnail,'');
 assert.equal(normalizeVideo({url:'https://www.youtube.com/watch?v='+id,thumbnail:'https://i.ytimg.com/vi/other-id/hqdefault.jpg'}).thumbnail,'');
});
test('installation instructions cover iPhone, iPad desktop UA, Android and desktop',()=>{
 assert.match(installationHelp('iPhone Safari',1),/Partager/);assert.match(installationHelp('Macintosh Safari',5),/écran d’accueil/);
 assert.match(installationHelp('iPhone CriOS',1),/Ouvrez cette page dans Safari/);assert.match(installationHelp('Android Chrome'),/menu/);assert.match(installationHelp('Windows'),/Chrome ou Edge/);
});
test('startup refuses missing authentication, short bridge token and unauthenticated network bind',async()=>{
 await assert.rejects(startFromEnvironment({}),/requis/);
 await assert.rejects(startFromEnvironment({PULSE_REQUIRE_AUTH:'0',PULSE_HOST:'0.0.0.0'}),/Authentification/);
 await assert.rejects(startFromEnvironment({PULSE_REQUIRE_AUTH:'0',PULSE_BRIDGE_TOKEN:'short'}),/32 caractères/);
});
test('bridge: strict 7/30 stats, immutable video request, safe visual proxy and CSRF',async()=>{
 let wrongStats=false,privateCalls=0,fail=false,videoMissing=false,videoError=false;
 const fetcher=async(url,options={})=>{
  const u=new URL(url);if(u.hostname==='i.ytimg.com'){assert.equal(options.headers,undefined);return new Response(Buffer.from('image'),{headers:{'Content-Type':'image/jpeg'}})}
  assert.equal(u.hostname,'links.test');
  if(u.pathname.startsWith('/api/pulse/')){assert.equal(options.headers.Authorization,'Bearer '+'s'.repeat(64));privateCalls++;if(fail)return new Response('{}',{status:503})}
  if(u.pathname==='/api/public-config')return json({links:[]});
  if(u.pathname==='/latest-video.json')return json(videoMissing?null:{url:'https://www.youtube.com/watch?v='+id,title:'Vidéo',thumbnail:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',privateKey:'must-not-leak'});
  if(u.pathname==='/api/pulse/links')return json({links:[]});
  if(u.pathname==='/api/pulse/stats'){const n=wrongStats?7:Number(u.searchParams.get('days')),d=days(n),total=d.reduce((s,x)=>s+x.clicks,0);return json({period:n,total,today:d.at(-1).clicks,last7:d.slice(-7).reduce((s,x)=>s+x.clicks,0),stories:3,days:d})}
  if(u.pathname==='/api/pulse/story-link'){if(videoError)return new Response(JSON.stringify({error:'Type PulSe invalide'}),{status:400});assert.deepEqual(JSON.parse(options.body),{type:'youtube',id});return json({url:'https://links.example/abc123xyz',token:'never-return-token'})}
  return new Response('{}',{status:404});
 };
 const server=createPulseServer({linksURL:'http://links.test',bridgeToken:'s'.repeat(64),user:'admin',password:'long-password-123',fetcher}),base=await open(server);
 const get=p=>fetch(base+p,{headers:{Authorization:auth}});
 const post=(body,headers={})=>fetch(base+'/api/story-link',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json','X-PulSe-Request':'1',...headers},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(base+'/api/catalog')).status,401);
  const cat=await(await get('/api/catalog')).json();assert.equal(cat.video.id,id);assert.equal(cat.video.privateKey,undefined);assert.ok(!JSON.stringify(cat).includes('ssssssss'));
  for(const n of [7,30]){const stats=await(await get('/api/stats?days='+n)).json();assert.equal(stats.available,true);assert.equal(stats.days.length,n);assert.equal(stats.period,n)}
  for(const p of ['days=8','days=','days=7&days=30'])assert.equal((await get('/api/stats?'+p)).status,400);
  wrongStats=true;const bad=await(await get('/api/stats?days=30')).json();assert.equal(bad.available,false);assert.equal(bad.total,undefined);wrongStats=false;
  const link=await(await post({type:'youtube',id,url:'https://evil.test'})).json();assert.deepEqual(link,{url:'https://links.example/abc123xyz',tracked:true});
  videoError=true;const unsupported=await post({type:'youtube',id});assert.equal(unsupported.status,503);assert.equal((await unsupported.json()).code,'VIDEO_BRIDGE_REQUIRED');videoError=false;
  assert.equal((await post({type:'youtube',id:'other-id'})).status,404);
  assert.equal((await post({type:'youtube',id},{Origin:'https://evil.test'})).status,403);
  assert.equal((await post({type:'youtube',id},{'X-PulSe-Request':''})).status,403);
  assert.equal((await post(null)).status,400);
  let r=await get('/api/visual?type=youtube&id='+id);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/jpeg');
  assert.equal((await get('/api/visual?type=youtube&id=https://evil.test')).status,404);
  for(const p of ['/.env','/serve.mjs','/catalog.mjs','/tests/server.test.mjs'])assert.equal((await get(p)).status,404);
  fail=true;assert.equal((await post({type:'youtube',id})).status,503);assert.equal((await(await get('/api/stats')).json()).available,false);
  assert.ok(privateCalls>3);
  fail=false;videoMissing=true;assert.equal((await(await get('/api/catalog?refresh=1')).json()).video,null);
 }finally{await close(server)}
});

test('PWA installation resources are available without credentials while the dashboard and APIs stay private',async()=>{
 const server=createPulseServer({user:'admin',password:'long-password-123'}),base=await open(server);
 try{
  for(const path of ['/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/sw.js','/offline.html']){
   const response=await fetch(base+path);
   assert.equal(response.status,200,'public PWA asset: '+path);
   if(path==='/manifest.webmanifest'){
    assert.match(response.headers.get('content-type'),/application\/manifest\+json/);
    const manifest=await response.json();
    assert.equal(manifest.display,'standalone');
    assert.equal(manifest.start_url,'/');
    assert.deepEqual(manifest.icons.map(icon=>icon.sizes),['192x192','512x512']);
   }
  }
  for(const path of ['/','/index.html','/app.js','/brand-pulse.png','/api/catalog','/api/stats','/api/visual']){
   assert.equal((await fetch(base+path)).status,401,'authenticated route: '+path);
  }
  const html=await(await fetch(base+'/',{headers:{Authorization:auth}})).text();
  assert.match(html,/rel="manifest"[^>]*crossorigin="use-credentials"/);
  const sw=await(await fetch(base+'/sw.js')).text();
  assert.match(sw,/pulse-public-v1\.1\.2/);
  assert.doesNotMatch(sw,/PUBLIC_SHELL=[^;]*\/api\//);
 }finally{await close(server)}
});
