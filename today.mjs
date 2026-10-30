import {normalizeInsights} from './insights.mjs';
export function normalizeToday(d){
 if(d?.version===1&&d.available===false&&d.reason==='timezone')return {available:false,reason:'Les compteurs LinKs ne sont pas en Europe/Paris. Conversion journalière impossible.'};
 const integer=n=>Number.isSafeInteger(n)&&n>=0;
 if(d?.version!==1||d.available!==true||d.scope!=='all-clicks'||d.timezone!=='Europe/Paris'||d.comparison!=='yesterday-full-day'||d.ranking_scope!=='tracked-links'||typeof d.analytics_enabled!=='boolean'||!integer(d.today)||!integer(d.yesterday)||!integer(d.tracked_total)||d.tracked_total>d.today)throw Error('Synthèse incompatible');
 const timestamp=new Date(d.generated_at), day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(timestamp);
 if(d.date!==day||!/^\d{4}-\d{2}-\d{2}$/.test(d.yesterday_date)||new Date(d.date+'T12:00:00Z')-new Date(d.yesterday_date+'T12:00:00Z')!==86400000)throw Error('Dates incompatibles');
 const ranking=normalizeInsights({...d,scope:'tracked-links',period:7,active_campaigns:0},7);
 return {available:true,date:d.date,yesterdayDate:d.yesterday_date,generatedAt:timestamp.toISOString(),today:d.today,yesterday:d.yesterday,analyticsEnabled:d.analytics_enabled,trackedTotal:ranking.trackedTotal,topLinks:ranking.topLinks,sources:ranking.sources};
}
