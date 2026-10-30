/** PulSe catalog: only active LinKs campaigns and privately authorized tracked links. */
const clamp = (v,max=240)=>typeof v==='string'?v.trim().slice(0,max):'';
export function httpURL(value) {
  if(typeof value!=='string'||value.length>2048)return '';
  try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''} catch{return ''}
}
export function normalizeCatalog(payload) {
  if(!payload||!Array.isArray(payload.links))throw new Error('Réponse LinKs incompatible.');
  const campaigns=[];
  for(const raw of payload.links) {
    if(!raw||typeof raw!=='object')continue;
    const type=['promo','featured'].includes(raw.type)?raw.type:null;
    if(!type)continue;
    const url=httpURL(raw.url);
    if(!url)continue;
    const item={id:clamp(raw.id,90),title:clamp(raw.title,180)||'Sans titre',description:clamp(raw.description,240),url,image:clamp(raw.effective_image??raw.image,240),promoCode:clamp(raw.promo_code,100),type,startAt:clamp(raw.start_at,35),endAt:clamp(raw.end_at,35)};
    if(!item.id)continue;
    // LinKs supplies all eligible campaigns; visible_campaign_ids is only for its public page.
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
    result.push({id,title,description:'',url,image:'',type:'independent',promoCode:''});
  }
  return result;
}
export function normalizeStats(raw,period=7) {
  const valid=v=>Number.isSafeInteger(v)&&v>=0;
  if(!raw||!Array.isArray(raw.days)||raw.days.length!==period||
     !valid(raw.today)||!valid(raw.last7)||!valid(raw.stories)||
     (raw.period!==undefined&&raw.period!==period))throw new Error('Période statistique LinKs incompatible.');
  const days=raw.days.map((d,i)=>{
    if(!d||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!valid(d.clicks))throw new Error('Statistiques incomplètes.');
    const stamp=Date.parse(d.date+'T00:00:00Z');
    if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==d.date||
      (i&&stamp!==Date.parse(raw.days[i-1].date+'T00:00:00Z')+86400000))throw new Error('Jours statistiques invalides.');
    return {date:d.date,clicks:d.clicks};
  });
  const total=days.reduce((n,d)=>n+d.clicks,0);
  if(!valid(total)||raw.today!==days.at(-1).clicks||raw.last7!==days.slice(-7).reduce((n,d)=>n+d.clicks,0)||
     raw.stories>total||(raw.total!==undefined&&raw.total!==total))throw new Error('Totaux statistiques incohérents.');
  return {today:raw.today,last7:raw.last7,total,period,stories:raw.stories,days,updatedAt:new Date().toISOString()};
}
export function normalizeVideo(raw){
  if(raw===null)return null;
  const url=httpURL(raw?.url);if(!url)return null;
  const parsed=new URL(url),id=parsed.hostname==='youtu.be'?parsed.pathname.slice(1):
    ['youtube.com','www.youtube.com'].includes(parsed.hostname)&&parsed.pathname==='/watch'?parsed.searchParams.get('v'):'';
  if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))return null;
  let thumbnail='';try{const u=new URL(raw.thumbnail);if(u.protocol==='https:'&&u.hostname==='i.ytimg.com'&&!u.username&&!u.password&&u.pathname.startsWith('/vi/'+id+'/'))thumbnail=u.href}catch{}
  const published=typeof raw.published==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(raw.published)&&Number.isFinite(Date.parse(raw.published))?new Date(raw.published).toISOString():'';
  return {id,title:clamp(raw.title,180)||'Vidéo YouTube',url:'https://www.youtube.com/watch?v='+id,thumbnail,published,type:'youtube'};
}
export function safeImageRef(ref){return typeof ref==='string'&&/^\/(uploads|assets)\/[A-Za-z0-9._-]{1,200}$/.test(ref)}
