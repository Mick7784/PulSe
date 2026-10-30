import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCatalog,normalizeTrackedLinks,safeImageRef,normalizeStats} from '../catalog.mjs';

test('PulSe imports all LinKs campaign types and effective visuals, never classic links',()=>{
 const raw={visible_campaign_ids:['offer'],links:[{id:'offer',type:'promo',title:'Promo',url:'https://example.org/promo',image:'/uploads/abc.png',effective_image:'/uploads/default.webp'},
 {id:'feature',type:'featured',title:'Mise en avant',url:'https://example.org/feature'},
 {id:'classic',type:'classic',title:'Produit',url:'https://example.org/product'},
 {id:'bad',type:'promo',title:'Bad',url:'javascript:alert(1)'},
 {id:'archived',type:'other',url:'https://example.org'}]};
 const catalog=normalizeCatalog(raw);
 assert.deepEqual(catalog.campaigns.map(x=>x.id),['offer','feature']);
 assert.equal(catalog.campaigns[0].image,'/uploads/default.webp');
 assert.deepEqual(catalog.trackedLinks,[]);
 assert.equal(catalog.trackedAvailable,false);
 assert.equal(catalog.campaigns.some(x=>x.id==='classic'),false);
});
test('private bridge provides only enabled and non-archived tracked links',()=>{
 const tracked=normalizeTrackedLinks({links:[
  {id:'tracked-1',name:'Produit partenaire',category:'Tech',url:'https://example.com/tracked',enabled:true,archived:false},
  {id:'tracked-2',name:'DÃ©sactivÃ©',url:'https://example.com/disabled',enabled:false,archived:false},
  {id:'tracked-3',name:'ArchivÃ©',url:'https://example.com/archived',enabled:true,archived:true},
  {id:'tracked-4',name:'Invalide',url:'javascript:alert(1)',enabled:true,archived:false}
 ]});
 assert.deepEqual(tracked.map(x=>x.id),['tracked-1']);
 assert.equal(tracked[0].type,'independent');
 assert.equal(tracked[0].description,'','Removed LinKs categories must not be displayed');
});
test('visual proxy rejects untrusted paths and dynamic URLs',()=>{
 assert.equal(safeImageRef('/uploads/aaa.png'),true);
 assert.equal(safeImageRef('/assets/bg-1.webp'),true);
 for(const bad of ['https://evil.com/x.jpg','/uploads/../etc/passwd','/api/admin','system:dark','/uploads/x?yes=1'])assert.equal(safeImageRef(bad),false);
});
test('stats requires complete dates, nonnegative integer values and matching totals',()=>{
 const days=Array.from({length:7},(_,i)=>({date:'2026-10-'+(17+i),clicks:i}));
 const raw={today:6,last7:21,stories:3,days};
 assert.equal(normalizeStats(raw).total,21);
 assert.throws(()=>normalizeStats({...raw,last7:-1}));
 assert.throws(()=>normalizeStats({...raw,days:days.slice(1)}));
 assert.throws(()=>normalizeStats({...raw,stories:22}));
 assert.throws(()=>normalizeStats({...raw,total:500}));
 assert.throws(()=>normalizeStats({...raw,days:[...days.slice(0,6),{date:'2026-10-23',clicks:0.5}]}));
 assert.throws(()=>normalizeStats({...raw,days:[days[0],days[0],...days.slice(2)]}));
 assert.throws(()=>normalizeStats(raw,30));
});
