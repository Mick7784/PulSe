import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInsights} from '../insights.mjs';
import {createPulseServer} from '../serve.mjs';
const fixture={version:1,period:7,scope:'tracked-links',tracked_total:3,active_campaigns:5,top_links:[{id:'a'.repeat(32),name:'Lien',clicks:3,available:true}],sources:[{id:'b'.repeat(32),name:'Discord',platform:'discord',clicks:3}]};
test('insights reject mismatched periods, scopes, duplicate rows and inconsistent counts',()=>{
 assert.equal(normalizeInsights(fixture,7).trackedTotal,3);
 for(const value of [{...fixture,period:30},{...fixture,scope:'all'},{...fixture,tracked_total:-1},{...fixture,top_links:[...fixture.top_links,...fixture.top_links]},{...fixture,tracked_total:2}])assert.throws(()=>normalizeInsights(value,7));
 assert.equal(Object.hasOwn(normalizeInsights({...fixture,token:'secret'},7),'token'),false);
});
test('private insights are read-only, no-store, narrowly projected and fail explicitly',async()=>{
 let calls=0,fail=false;const secret='server-only-secret';
 const server=createPulseServer({user:'test',password:'private-password',linksURL:'http://public.test',bridgeURL:'http://private.test',bridgeToken:secret,fetcher:async(url,opts)=>{
  calls++;assert.equal(url,'http://private.test/api/pulse/insights?days=7');assert.equal(opts.headers.Authorization,'Bearer '+secret);
  return new Response(JSON.stringify(fail?{error:secret}:{...fixture,token:secret}),{status:fail?500:200});
 }});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,headers={Authorization:'Basic '+Buffer.from('test:private-password').toString('base64')};
 try{
  assert.equal((await fetch(base+'/api/insights')).status,401);assert.equal((await fetch(base+'/publication.js')).status,401);
  assert.equal((await fetch(base+'/api/insights',{method:'POST',headers})).status,405);
  for(const suffix of ['?days=8','?days=','?days=7&days=30'])assert.equal((await fetch(base+'/api/insights'+suffix,{headers})).status,400);
  assert.equal(calls,0);const response=await fetch(base+'/api/insights',{headers});assert.equal(response.headers.get('Cache-Control'),'no-store');const body=await response.json();assert.equal(body.available,true);assert.ok(!JSON.stringify(body).includes(secret));
  fail=true;const failed=await(await fetch(base+'/api/insights',{headers})).json();assert.equal(failed.available,false);assert.ok(!JSON.stringify(failed).includes(secret));assert.equal(failed.topLinks,undefined);
 }finally{await new Promise(r=>server.close(r))}
});
