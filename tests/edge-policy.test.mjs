import test from 'node:test';
import assert from 'node:assert/strict';
import {edgePolicy} from '../security/edge-policy.mjs';
const input={pulseHosts:['pulse.test'],linksHosts:['links.test','www.links.test'],publicEntryPoints:[{name:'http',tls:false},{name:'https',tls:true}]};
test('private edge policy refuses missing inventory and rule injection',()=>{
 for(const bad of [{},{...input,pulseHosts:[]},{...input,linksHosts:['pulse.test']},{...input,pulseHosts:['https://pulse.test']},{...input,linksHosts:['links.test`) || PathPrefix(`/']},{...input,publicEntryPoints:[{name:'https'}]},{...input,publicEntryPoints:[{tls:true}]},{...input,publicEntryPoints:[{name:123,tls:true}]},{...input,publicEntryPoints:[{name:'https',tls:true},{name:'https',tls:false}]}])assert.throws(()=>edgePolicy(bad));
 const config=edgePolicy(input);assert.equal(Object.keys(config.http.routers).length,4);
 for(const router of Object.values(config.http.routers)){assert.equal(router.service,'noop@internal');assert.equal(router.priority,1000000000)}
 assert.equal(config.http.routers['pulse-private-deny-http'].tls,undefined);
 assert.deepEqual(config.http.routers['pulse-private-deny-https'].tls,{});
});
