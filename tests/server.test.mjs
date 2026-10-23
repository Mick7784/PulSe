import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createPulseServer} from '../serve.mjs';

async function open(server){await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port}
async function close(server){await new Promise(r=>server.close(r))}
const auth='Basic '+Buffer.from('admin:strong-password-123').toString('base64');
const config={links:[{id:'offer',type:'promo',title:'Offre en cours',image:'/uploads/fake.png',url:'https://example.com/promo',promo_code:'DEMO'},
{id:'regular',type:'classic',title:'Un lien classique',image:'',url:'https://example.com/link'}]};

test('PulSe auth, catalogue campagnes, aucun lien classic, stat et proxy',async()=>{
 const fake=http.createServer(async(req,res)=>{
  if(req.url==='/api/public-config') {res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(config));return}
  if(req.url==='/uploads/fake.png'){res.writeHead(200,{'Content-Type':'image/png'});res.end(await readFile(new URL('../icon-192.png',import.meta.url)));return}
  res.writeHead(404);res.end();
 });
 const fakeURL=await open(fake);const pulse=createPulseServer({linksURL:fakeURL,user:'admin',password:'strong-password-123'});const base=await open(pulse);
 try {
  let r=await fetch(base+'/healthz');assert.equal(r.status,200);assert.equal((await r.json()).status,'ok');
  r=await fetch(base+'/');assert.equal(r.status,401);
  r=await fetch(base+'/',{headers:{Authorization:auth}});assert.equal(r.status,200);assert.match(await r.text(),/<title>PulSe/);
  r=await fetch(base+'/api/catalog',{headers:{Authorization:auth}});assert.equal(r.status,200);const cat=await r.json();assert.equal(cat.campaigns.length,1);assert.deepEqual(cat.trackedLinks,[]);
  r=await fetch(base+'/api/stats',{headers:{Authorization:auth}});assert.equal((await r.json()).available,false);
  r=await fetch(base+'/api/story-link',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({type:'campaign',id:'offer'})});assert.deepEqual(await r.json(),{url:'https://example.com/promo',tracked:false});
  r=await fetch(base+'/api/story-link',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({type:'classic',id:'regular'})});assert.equal(r.status,400);
  r=await fetch(base+'/api/story-link',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({type:'independent',id:'regular'})});assert.equal(r.status,503);
  r=await fetch(base+'/api/story-link',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({type:'campaign',id:'unknown'})});assert.equal(r.status,404);
  r=await fetch(base+'/api/visual?id=offer',{headers:{Authorization:auth}});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.ok((await r.arrayBuffer()).byteLength>0);
  r=await fetch(base+'/api/visual?id=regular',{headers:{Authorization:auth}});assert.equal(r.status,404);
 }finally{await close(pulse);await close(fake)}
});
test('private bridge lists tracked links and only returns a tracked link on success',async()=>{
 let failLink=false;
 const fake=http.createServer(async(req,res)=>{
  if(req.url==='/api/public-config'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(config));return}
  if(req.url==='/api/pulse/links'){
   assert.equal(req.headers.authorization,'Bearer secret-bridge');
   res.writeHead(200,{'Content-Type':'application/json'});
   res.end(JSON.stringify({links:[{id:'tracked-123',name:'Produit suivi',url:'https://partner.example/destination',enabled:true,archived:false}]}));return;
  }
  if(req.url==='/api/pulse/story-link'&&req.method==='POST'){
   assert.equal(req.headers.authorization,'Bearer secret-bridge');
   res.writeHead(failLink?503:200,{'Content-Type':'application/json'});
   res.end(JSON.stringify(failLink?{error:'Indisponible'}:{url:'https://links.example/x12345678'}));return;
  }
  res.writeHead(404);res.end();
 });
 const url=await open(fake),pulse=createPulseServer({linksURL:url,bridgeURL:url,bridgeToken:'secret-bridge',user:'admin',password:'strong-password-123'}),base=await open(pulse);
 try{
  let r=await fetch(base+'/api/catalog',{headers:{Authorization:auth}}),catalog=await r.json();
  assert.equal(catalog.trackedAvailable,true);assert.deepEqual(catalog.trackedLinks.map(x=>x.id),['tracked-123']);
  r=await fetch(base+'/api/story-link',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({type:'independent',id:'tracked-123'})});
  assert.deepEqual(await r.json(),{url:'https://links.example/x12345678',tracked:true});
  failLink=true;
  r=await fetch(base+'/api/story-link',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({type:'independent',id:'tracked-123'})});
  assert.equal(r.status,503);
  // A failing private bridge must never silently return the partner URL.
  r=await fetch(base+'/api/story-link',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({type:'campaign',id:'offer'})});
  assert.equal(r.status,503);
 }finally{await close(pulse);await close(fake)}
});
