// Transport projections only. LinKs owns destination resolution and all writes.
import {httpURL} from './catalog.mjs';
const text=(value,max=2000)=>typeof value==='string'?value.slice(0,max):'';
const item=row=>({id:text(row.id,32),name:text(row.name,160),url:httpURL(row.url),original_url:httpURL(row.original_url),notes:text(row.notes,800),partner_id:text(row.partner_id,32),revision:text(row.revision,64)});
export const matches=rows=>Array.isArray(rows)?rows.map(row=>({id:text(row.id,32),name:text(row.name,160),url:httpURL(row.url),enabled:!!row.enabled,archived:!!row.archived})):[];
const receiptKeys=['id','revision','name','url','notes','partner_id','apply_partner','expected_url','previous_url','expires','proof'];
export function managerRequest(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Requête invalide.');
 return Object.fromEntries([...receiptKeys,'detect','confirm_destination','source_id'].filter(key=>Object.hasOwn(data,key)).map(key=>[key,data[key]]));
}
export function managerResponse(action,data){
 if(action==='link-manager'){
  if(data.version!==1||!Array.isArray(data.items)||!Array.isArray(data.partners)||!Array.isArray(data.sources))throw Error('Bridge incompatible');
  return {version:1,items:data.items.map(item),partners:data.partners.map(row=>({id:text(row.id,32),name:text(row.name,100)})),sources:data.sources.map(row=>({id:text(row.id,32),name:text(row.name,100),platform:text(row.platform,32),historical:!!row.historical}))};
 }
 if(action==='link-preview'){
  const p=data.preview,r=data.receipt;if(!p||!r||!httpURL(p.url)||typeof r.proof!=='string')throw Error('Aperçu incompatible');
  const receipt={};for(const key of receiptKeys)receipt[key]=['apply_partner'].includes(key)?r[key]===true:key==='expires'?Number(r[key]):text(r[key],key==='notes'?800:key==='name'?160:2000);
  return {preview:{url:httpURL(p.url),original_url:httpURL(p.original_url),partner_id:text(p.partner_id,32),previous_url:httpURL(p.previous_url),changed:p.changed===true,duplicates:matches(p.duplicates),duplicate_confirmation_required:p.duplicate_confirmation_required===true},receipt};
 }
 if(action==='link-save'){if(!data.item?.id)throw Error('Lien incompatible');return {item:item(data.item)}}
 if(action==='link-token'){if(!httpURL(data.url))throw Error('Lien incompatible');return {url:httpURL(data.url),source_id:text(data.source_id,32)}}
 throw Error('Opération inconnue');
}
