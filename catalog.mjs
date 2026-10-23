/** PulSe catalog: only active LinKs campaigns and privately authorized tracked links. */
const clamp = (v,max=240)=>typeof v==='string'?v.trim().slice(0,max):'';
export function httpURL(value) {
  if(typeof value!=='string'||value.length>2048)return '';
  try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''} catch{return ''}
}
export function normalizeCatalog(payload) {
  if(!payload||!Array.isArray(payload.links))throw new Error('Réponse LinKs incompatible.');
  const campaigns=[];
  for(const raw of payload.links.slice(0,400)) {
    if(!raw||typeof raw!=='object')continue;
    const type=raw.type==='promo'?'promo':null;
    if(!type)continue;
    const url=httpURL(raw.url);
    if(!url)continue;
    const item={id:clamp(raw.id,90),title:clamp(raw.title,180)||'Sans titre',description:clamp(raw.description,240),url,image:clamp(raw.image,240),promoCode:clamp(raw.promo_code,100),type,startAt:clamp(raw.start_at,35),endAt:clamp(raw.end_at,35)};
    if(!item.id)continue;
    // Neither classic links nor featured non-promotional blocks are Story offers.
    campaigns.push(item);
  }
  return {campaigns,trackedLinks:[],trackedAvailable:false,timezone:clamp(payload.timezone,80)||'Europe/Paris',updatedAt:new Date().toISOString(),source:'links-public'};
}
export function normalizeTrackedLinks(raw) {
  if(!raw||!Array.isArray(raw.links))throw new Error('Passerelle de liens suivis incompatible.');
  const seen=new Set(),result=[];
  for(const item of raw.links.slice(0,400)) {
    if(!item||item.enabled!==true||item.archived!==false)continue;
    const id=clamp(item.id,100),title=clamp(item.name,180),url=httpURL(item.url);
    if(!id||!title||!url||seen.has(id))continue;
    seen.add(id);
    result.push({id,title,description:clamp(item.category,180),url,image:'',type:'independent',promoCode:''});
  }
  return result;
}
export function normalizeStats(raw) {
  if(!raw||!Array.isArray(raw.days))throw new Error('Statistiques LinKs incompatibles.');
  return {today:finiteNonnegative(raw.today),last7:finiteNonnegative(raw.last7),stories:finiteNonnegative(raw.stories),days:raw.days.slice(-30).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&Number.isFinite(d.clicks)&&d.clicks>=0).map(d=>({date:d.date,clicks:d.clicks})),updatedAt:new Date().toISOString()};
}
function finiteNonnegative(v){return Number.isFinite(v)&&v>=0?v:null}
export function safeImageRef(ref){return typeof ref==='string'&&/^\/(uploads|assets)\/[A-Za-z0-9._-]{1,200}$/.test(ref)}
