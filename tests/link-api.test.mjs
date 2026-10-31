import test from 'node:test';
import assert from 'node:assert/strict';
import {createPulseServer} from '../serve.mjs';

test('link bridge confines routes, credentials, fields and failures to its public contract',async()=>{
 const secret='never-return-this-bridge-secret',calls=[];
 let upstreamStatus=200,upstream={version:1,items:[{id:'existing',name:'Nom',url:'https://example.com',notes:'Note',partner_id:'',revision:'rev',token:secret}],partners:[{id:'partner',name:'Partenaire',template:secret}],sources:[{id:'source',name:'YouTube',platform:'youtube',active:true,admin_session:secret}],secret};
 const server=createPulseServer({linksURL:'http://public.test',bridgeURL:'http://private.test',bridgeToken:secret,fetcher:async(url,opts)=>{
  calls.push({url,opts});return new Response(JSON.stringify(upstream),{status:upstreamStatus,headers:{'Content-Type':'application/json'}});
 }});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const headers={'Content-Type':'application/json','X-PulSe-Request':'1'};
 const request=(path,body,extra={})=>fetch(base+path,{method:body?'POST':'GET',headers:{...headers,...extra},body:body?JSON.stringify(body):undefined});
 try{
  for(const path of ['/api/admin','/api/pulse/link-save','/api/link-manager/extra','/link-api.mjs'])assert.equal((await request(path)).status,404);
  for(const [path,body]of [['/api/link-manager',null],['/api/link-preview',{}],['/api/link-save',{}],['/api/link-token',{}]]){
   if(body){
    assert.equal((await request(path,body,{'X-PulSe-Request':''})).status,403);
    assert.equal((await request(path,body,{Origin:'https://foreign.example'})).status,403);
    assert.equal((await request(path,body,{'Sec-Fetch-Site':'cross-site'})).status,403);
    assert.equal((await request(path,body,{'Content-Type':'text/plain'})).status,415);
   }
  }
  assert.equal(calls.length,0);
  const catalog=await request('/api/link-manager');assert.equal(catalog.status,200);assert.equal(catalog.headers.get('cache-control'),'no-store');
  const catalogText=await catalog.text();assert.ok(!catalogText.includes(secret));assert.ok(!catalogText.includes('template'));assert.ok(!catalogText.includes('admin_session'));assert.equal(JSON.parse(catalogText).items[0].url,'https://example.com');
  assert.equal(calls[0].url,'http://private.test/api/pulse/link-manager');assert.equal(calls[0].opts.headers.Authorization,'Bearer '+secret);assert.equal(calls[0].opts.redirect,'error');
  upstream={url:'https://links.example/alias123',source_id:'source',token:secret};
  const token=await request('/api/link-token',{id:'existing',source_id:'source',expected_url:'https://example.com',admin:true,allow_duplicate:true,duplicate_ids:['other']});
  assert.deepEqual(await token.json(),{url:'https://links.example/alias123',source_id:'source'});
  assert.deepEqual(JSON.parse(calls.at(-1).opts.body),{id:'existing',source_id:'source',expected_url:'https://example.com'});
  const before=calls.length;assert.equal((await request('/api/link-save',{name:'x'.repeat(33000)})).status,400);assert.equal(calls.length,before);
  for(const status of [400,401,404,500]){
   upstreamStatus=status;upstream={error:secret,details:secret};
   const response=await request('/api/link-preview',{});assert.equal(response.status,status===400?400:503);assert.ok(!(await response.text()).includes(secret));
  }
  upstreamStatus=409;upstream={code:'DUPLICATE',error:secret,duplicates:[{id:'existing',name:'Nom',url:'https://example.com',enabled:true,token:secret}]};
  const conflict=await request('/api/link-save',{});assert.equal(conflict.status,409);const body=await conflict.json();assert.equal(body.code,'DUPLICATE');assert.ok(!JSON.stringify(body).includes(secret));assert.equal(body.duplicates[0].id,'existing');
  upstreamStatus=200;upstream={version:0,secret};assert.equal((await request('/api/link-manager')).status,503);
 }finally{await new Promise(r=>server.close(r))}
});
