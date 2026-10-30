import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeToday} from '../today.mjs';
import {createPulseServer} from '../serve.mjs';
const sample=()=>({version:1,available:true,timezone:'Europe/Paris',date:'2026-10-30',yesterday_date:'2026-10-29',generated_at:'2026-10-30T12:00:00Z',scope:'all-clicks',comparison:'yesterday-full-day',analytics_enabled:true,today:6,yesterday:9,ranking_scope:'tracked-links',tracked_total:2,top_links:[{id:'a'.repeat(32),name:'Été & <test>',clicks:2,available:true}],sources:[]});
test('daily snapshot rejects false scopes, totals, dates and fabricated comparisons',()=>{
 assert.equal(normalizeToday(sample()).today,6);
 for(const extra of [{today:-1},{today:1},{today:NaN},{timezone:'UTC'},{date:'2026-10-31'},{yesterday_date:'2026-10-30'},{generated_at:'bad'},{comparison:'same-hour'},{ranking_scope:'all-clicks'},{top_links:[{...sample().top_links[0],clicks:3}]}])assert.throws(()=>normalizeToday({...sample(),...extra}));
 assert.equal(normalizeToday({version:1,available:false,reason:'timezone'}).available,false);
});
test('today bridge stays Basic/Bearer private, bounded and no-store',async()=>{
 let response=sample(),calls=0;
 const server=createPulseServer({user:'test',password:'local-validation-password',linksURL:'http://links.test',bridgeToken:'s'.repeat(64),fetcher:async(url,options)=>{calls++;assert.equal(new URL(url).pathname,'/api/pulse/today');assert.equal(options.headers.Authorization,'Bearer '+'s'.repeat(64));return new Response(JSON.stringify(response))}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,headers={Authorization:'Basic '+Buffer.from('test:local-validation-password').toString('base64')};
 try{
  assert.equal((await fetch(base+'/api/today')).status,401);assert.equal(calls,0);
  assert.equal((await fetch(base+'/api/today?days=7',{headers})).status,400);assert.equal(calls,0);
  const r=await fetch(base+'/api/today',{headers});assert.match(r.headers.get('cache-control'),/no-store/);assert.equal((await r.json()).today,6);
  response={...sample(),today:1};assert.equal((await(await fetch(base+'/api/today',{headers})).json()).available,false);
 }finally{await new Promise(r=>server.close(r))}
});
