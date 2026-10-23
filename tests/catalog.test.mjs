import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCatalog,normalizeTrackedLinks,safeImageRef,normalizeStats} from '../catalog.mjs';

test('PulSe imports only active promotional offers, never classic or featured links',()=>{
 const raw={links:[{id:'offer',type:'promo',title:'Promo',url:'https://example.org/promo',image:'/uploads/abc.png'},
 {id:'feature',type:'featured',title:'Mise en avant',url:'https://example.org/feature'},
 {id:'classic',type:'classic',title:'Produit',url:'https://example.org/product'},
 {id:'bad',type:'promo',title:'Bad',url:'javascript:alert(1)'},
 {id:'archived',type:'other',url:'https://example.org'}]};
 const catalog=normalizeCatalog(raw);
 assert.deepEqual(catalog.campaigns.map(x=>x.id),['offer']);
 assert.deepEqual(catalog.trackedLinks,[]);
 assert.equal(catalog.trackedAvailable,false);
 assert.equal(catalog.campaigns.some(x=>x.id==='classic'),false);
});
test('private bridge provides only enabled and non-archived tracked links',()=>{
 const tracked=normalizeTrackedLinks({links:[
  {id:'tracked-1',name:'Produit partenaire',category:'Tech',url:'https://example.com/tracked',enabled:true,archived:false},
  {id:'tracked-2',name:'Désactivé',url:'https://example.com/disabled',enabled:false,archived:false},
  {id:'tracked-3',name:'Archivé',url:'https://example.com/archived',enabled:true,archived:true},
  {id:'tracked-4',name:'Invalide',url:'javascript:alert(1)',enabled:true,archived:false}
 ]});
 assert.deepEqual(tracked.map(x=>x.id),['tracked-1']);
 assert.equal(tracked[0].type,'independent');
});
test('visual proxy rejects untrusted paths and dynamic URLs',()=>{
 assert.equal(safeImageRef('/uploads/aaa.png'),true);
 assert.equal(safeImageRef('/assets/bg-1.webp'),true);
 for(const bad of ['https://evil.com/x.jpg','/uploads/../etc/passwd','/api/admin','system:dark','/uploads/x?yes=1'])assert.equal(safeImageRef(bad),false);
});
test('stats rejects invalid values',()=>{
 const s=normalizeStats({today:4,last7:-1,stories:0,days:[{date:'2026-10-23',clicks:5},{date:'oops',clicks:100}]});
 assert.equal(s.today,4);assert.equal(s.last7,null);assert.equal(s.stories,0);assert.deepEqual(s.days,[{date:'2026-10-23',clicks:5}]);
});
