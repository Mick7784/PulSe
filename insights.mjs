// Strict display contract: never substitute lifetime counters for the selected period.
export function normalizeInsights(data,period){
 const integer=n=>Number.isSafeInteger(n)&&n>=0;
 if(data?.version!==1||data.scope!=='tracked-links'||data.period!==period||!integer(data.tracked_total)||!integer(data.active_campaigns))throw Error('Synthèse incompatible');
 function rows(values,links){
  if(!Array.isArray(values)||values.length>5)throw Error('Classement incompatible');
  const seen=new Set();return values.map(row=>{
   if(!row||typeof row.id!=='string'||!/^[a-f0-9]{32}$/.test(row.id)||seen.has(row.id)||typeof row.name!=='string'||!integer(row.clicks)||row.clicks>data.tracked_total||(links&&typeof row.available!=='boolean'))throw Error('Ligne incompatible');
   seen.add(row.id);return {id:row.id,name:row.name.slice(0,160),clicks:row.clicks,...(links?{available:row.available}:{platform:typeof row.platform==='string'?row.platform.slice(0,32):''})};
  });
 }
 const topLinks=rows(data.top_links,true),sources=rows(data.sources,false);
 if([topLinks,sources].some(rows=>rows.reduce((sum,row)=>sum+row.clicks,0)>data.tracked_total))throw Error('Total incompatible');
 return {period,scope:'tracked-links',trackedTotal:data.tracked_total,activeCampaigns:data.active_campaigns,topLinks,sources};
}
