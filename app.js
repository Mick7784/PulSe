'use strict';
import {installationHelp,watchUpdates} from './pwa.mjs';
import {initLinkManager} from './link-manager.js';
const $=id=>document.getElementById(id),number=new Intl.NumberFormat('fr-FR');
let catalog={campaigns:[],trackedLinks:[]},selected=null,prepared=null,objectURL=null,revision=0,period=7,statsRevision=0,catalogRevision=0,mediaRevision=0,mediaFile=null,mediaBusy=false,flow={copied:false,shared:false,downloaded:false,published:false};
const editor=$('editor');
let pwaUpdates;
const linkManager=initLinkManager({onDraft:()=>pwaUpdates?.refreshDraft(),onSaved:()=>refreshCatalog(),onStoryLink:useStoryLink,onStoryBack:()=>showView('stories')});
const message=text=>{$('story-status').textContent=text||''};
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el}
async function api(path,options={}){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  let r;try{r=await fetch(path,{cache:'no-store',...options,signal:controller.signal})}catch{throw Error('Connexion indisponible. Reconnectez Pangolin puis réessayez. Votre préparation reste dans cette page.')}
  if(r.status===401||r.status===403)throw Error('Accès refusé. Vérifiez votre connexion privée et vos identifiants, puis réessayez.');
  let data;try{data=await r.json()}catch{throw Error('Réponse indisponible. Vérifiez votre connexion privée puis réessayez.')}
  if(!r.ok)throw Error(data.error||'Connexion indisponible.');return data;
 }finally{clearTimeout(timeout)}
}
function canShareFile(file){try{return isSecureContext&&!!navigator.share&&!!navigator.canShare?.({files:[file]})}catch{return false}}
function clearPrepared(){prepared=null;mediaFile=null;if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null;flow={copied:false,shared:false,downloaded:false,published:false};$('preview').hidden=true;$('video-preview').hidden=true;$('video-preview').pause();$('video-preview').removeAttribute('src');$('story-link').value='';$('media-name').textContent='';$('manual-copy').hidden=true;$('retry-link').hidden=true;$('publication-check').checked=false;$('publication-receipt').textContent='';syncDraft()}
function syncDraft(){const url=selected?.link||'';prepared=!mediaBusy&&mediaFile&&url?{file:mediaFile,url}:null;$('story-link').value=url;$('copy').disabled=!url;$('share').disabled=!prepared||!flow.copied||!canShareFile(mediaFile);$('download').hidden=!mediaFile||mediaBusy;
 $('draft-dot').hidden=!selected||(flow.published&&!mediaBusy);
 pwaUpdates?.refreshDraft();
 const states={media:!!mediaFile&&!mediaBusy,copy:flow.copied,share:flow.shared||flow.downloaded,publish:flow.published};
 for(const [name,complete]of Object.entries(states))$('step-'+name).dataset.state=complete?'complete':'pending';
 $('media-state').textContent=mediaBusy?'Préparation…':mediaFile?'Visuel prêt':'Choix / préparation';$('copy-state').textContent=flow.copied?'Lien copié':url?'Lien prêt':'Lien en attente';$('share-state').textContent=flow.shared?'Partage effectué':flow.downloaded?'Import manuel à faire':'Après copie du lien';$('publish-state').textContent=flow.published?'Déclaration enregistrée':'À faire dans Instagram';
 $('publication-state').textContent=flow.published?'Terminée sur cet appareil':prepared?'Prête à publier':mediaFile?'Visuel prêt · lien en attente':'En préparation';const canFinish=!!prepared&&flow.copied&&states.share;$('publication-check').disabled=!canFinish||flow.published;$('confirm-publication').disabled=!canFinish||!$('publication-check').checked||flow.published;
}
let activeView='stats';
const viewScroll={stats:0,stories:0,links:0};
function showView(view){
 if(view===activeView)return;
 if(activeView==='links')linkManager.endStory();
 viewScroll[activeView]=window.scrollY;activeView=view;
 for(const name of ['stats','stories','links']){
  $(name+'-view').hidden=name!==view;
  const button=$('nav-'+name);if(name===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
 }
 $('story-panel').hidden=view!=='stories';$('story-toggle').setAttribute('aria-expanded',String(view==='stories'));
 document.title='PulSe — '+({stats:'Statistiques',stories:'Stories',links:'Liens'}[view]);
 if(view==='links')linkManager.enter();
 document.querySelector('.skip-link').href='#view-'+view+'-title';
 $('view-'+view+'-title').focus({preventScroll:true});
 window.scrollTo({top:viewScroll[view],behavior:'instant'});
}
$('story-toggle').onclick=()=>showView('stories');
$('nav-stats').onclick=()=>showView('stats');$('nav-stories').onclick=()=>showView('stories');
$('nav-links').onclick=()=>showView('links');
$('story-create-link').onclick=()=>{linkManager.beginStory();showView('links')};
function useStoryLink(row){
 const item={id:row.id,title:row.name,url:row.url,type:'independent',image:'',description:''};
 if(selected&&mediaFile&&!flow.published&&!window.confirm('Utiliser ce lien pour votre Story en conservant le média ? Les étapes de copie et de partage seront à refaire.'))return false;
 catalog.trackedLinks=[item,...catalog.trackedLinks.filter(x=>x.id!==item.id)];
 showView('stories');selectItem(item,{keepMedia:true});return true;
}
function chain(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('chain-icon');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d','M10 13a5 5 0 0 0 7 .2l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.2l-3 3a5 5 0 0 0 7 7l2-2');p.setAttribute('fill','none');p.setAttribute('stroke','currentColor');p.setAttribute('stroke-width','1.8');svg.append(p);return svg}
const itemKey=item=>item.type+':'+item.id;
function renderList(name,items){const root=$(name);root.replaceChildren();if(!items.length){root.append(node('p','empty',name==='campaigns'?catalog.campaigns.length?'Aucune offre correspondant à votre recherche.':'Aucune offre active.':catalog.trackedAvailable?'Aucun lien correspondant.':'Liens suivis momentanément indisponibles.'));return}
 for(const item of items){const b=node('button','selection-button');b.type='button';b.setAttribute('aria-pressed',String(selected&&itemKey(selected)===itemKey(item)));b.setAttribute('aria-controls','editor');const thumb=node('span','thumbnail');if(name==='tracked-links')thumb.append(chain());else if(item.image){const img=node('img');img.alt='';img.loading='lazy';img.src='/api/visual?id='+encodeURIComponent(item.id);img.onerror=()=>{img.remove();thumb.textContent='—'};thumb.append(img)}else thumb.textContent='—';const copy=node('span','selection-copy');copy.append(node('strong','',item.title));if(name==='tracked-links'&&item.description)copy.append(node('small','',item.description));b.append(thumb,copy,node('span','chev','›'));b.onclick=()=>selectItem(item);root.append(b);if(selected&&itemKey(selected)===itemKey(item))root.append(editor)}
}
function renderLists(){$('story-panel').append(editor);const offerQuery=$('campaign-search').value.trim().toLocaleLowerCase('fr');renderList('campaigns',catalog.campaigns.filter(x=>(x.title+' '+x.description+' '+x.promoCode).toLocaleLowerCase('fr').includes(offerQuery)));const q=$('link-search').value.trim().toLocaleLowerCase('fr');renderList('tracked-links',catalog.trackedLinks.filter(x=>(x.title+' '+x.description).toLocaleLowerCase('fr').includes(q)));$('offers-count').textContent=catalog.campaigns.length;$('links-count').textContent=catalog.trackedLinks.length;if(selected?.type==='youtube')$('latest-video').after(editor)}
$('link-search').oninput=renderLists;
$('campaign-search').oninput=renderLists;
function campaignDetails(item){
 const root=$('campaign-details');root.replaceChildren();root.hidden=!['promo','featured'].includes(item.type);if(root.hidden)return;
 if(item.description)root.append(node('p','',item.description));
 if(item.promoCode)root.append(node('p','','Code promo : '+item.promoCode));
 let end='Sans date de fin';if(item.endAt){try{end='Fin prévue : '+new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short',timeZone:catalog.timezone}).format(new Date(item.endAt))}catch{end='Fin indiquée par LinKs : '+item.endAt}}
 root.append(node('p','',end));
}
function renderVideo(){const root=$('latest-video');root.replaceChildren();if(!catalog.video){root.append(node('p','empty',catalog.videoReason||'Aucune vidéo disponible dans LinKs.'));return}const v=catalog.video,b=node('button','video-select');b.type='button';if(v.thumbnail){const img=node('img');img.src='/api/visual?type=youtube&id='+encodeURIComponent(v.id);img.alt='';img.onerror=()=>img.remove();b.append(img)}const text=node('span');text.append(node('strong','',v.title));if(v.published)text.append(node('small','video-date','Publiée le '+new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium'}).format(new Date(v.published))));text.append(node('small','video-cta','Préparer et publier la Story →'));b.append(text);b.onclick=()=>selectItem({...v,type:'youtube'});root.append(b)}
async function loadStoryLink(item,ticket){$('retry-link').hidden=true;try{const link=await api('/api/story-link',{method:'POST',headers:{'Content-Type':'application/json','X-PulSe-Request':'1'},body:JSON.stringify({type:['promo','featured'].includes(item.type)?'campaign':item.type,id:item.id})});if(ticket!==revision)return;selected={...selected,link:link.url};syncDraft();message(mediaBusy?'Préparation du média…':mediaFile?'Visuel et lien prêts. Copiez le lien pour continuer.':'Lien suivi prêt. Préparez ou choisissez votre média.')}catch(e){if(ticket!==revision)return;syncDraft();$('retry-link').hidden=false;message(e.message)}}
async function selectItem(item,{keepMedia=false}={}){
 if(!keepMedia&&(mediaFile||mediaBusy)&&!flow.published&&!window.confirm('Remplacer cette préparation ? Le média et les étapes en cours seront effacés.'))return;
 const retain=keepMedia&&!!mediaFile,ticket=++revision,mediaTicket=++mediaRevision;mediaBusy=false;selected={...item,link:''};
 if(retain){flow={copied:false,shared:false,downloaded:false,published:false};$('manual-copy').hidden=true;$('publication-check').checked=false;$('publication-receipt').textContent='';syncDraft()}else clearPrepared();
 $('story-media').disabled=false;$('story-media').value='';editor.hidden=false;$('editor-title').textContent=item.title;campaignDetails(item);renderLists();$('editor-title').focus({preventScroll:true});editor.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});message('Préparation du visuel et du lien suivi…');
 // The thumbnail can be prepared independently while the secure bridge is checked.
 const linkRequest=loadStoryLink(item,ticket);
 try{if(!retain&&item.type!=='independent'&&(item.image||item.thumbnail)){mediaBusy=true;syncDraft();const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);try{const r=await fetch('/api/visual?'+(item.type==='youtube'?'type=youtube&':'')+'id='+encodeURIComponent(item.id),{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('Visuel indisponible. Choisissez un média du téléphone.');const blob=await r.blob();await prepareMedia(new File([blob],'visuel.jpg',{type:blob.type}),ticket,mediaTicket)}finally{clearTimeout(timeout)}}else if(!retain&&ticket===revision)message('Choisissez une photo ou une vidéo pour illustrer ce lien.')}catch{if(ticket===revision&&mediaTicket===mediaRevision)message('Visuel indisponible. Choisissez un média du téléphone.')}finally{if(ticket===revision&&mediaTicket===mediaRevision){mediaBusy=false;syncDraft()}}
 await linkRequest;
}
$('retry-link').onclick=()=>{if(selected){message('Nouvelle tentative de connexion à LinKs…');loadStoryLink(selected,revision)}};
async function decode(file){if(file.size>25*1024*1024)throw Error('Image trop lourde (25 Mo maximum).');const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();return img}finally{URL.revokeObjectURL(url)}}
async function composeImage(file){const img=await decode(file),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;const c=canvas.getContext('2d');c.fillStyle='#111b2a';c.fillRect(0,0,1080,1920);const cover=Math.max(1080/img.naturalWidth,1920/img.naturalHeight),bw=img.naturalWidth*cover,bh=img.naturalHeight*cover;c.save();c.filter='blur(48px) brightness(.55)';c.drawImage(img,(1080-bw)/2,(1920-bh)/2,bw,bh);c.restore();const fit=Math.min(1080/img.naturalWidth,1920/img.naturalHeight),w=img.naturalWidth*fit,h=img.naturalHeight*fit;c.drawImage(img,(1080-w)/2,(1920-h)/2,w,h);const blob=await new Promise((resolve,reject)=>canvas.toBlob(x=>x?resolve(x):reject(Error('Encodage JPEG impossible.')),'image/jpeg',.92));return new File([blob],'pulse-story-'+Date.now()+'.jpg',{type:'image/jpeg'})}
async function prepareMedia(source,ticket,mediaTicket){let file;if(source.type.startsWith('image/'))file=await composeImage(source);else if(source.type.startsWith('video/')){if(source.size>100*1024*1024)throw Error('Vidéo trop lourde (100 Mo maximum).');file=source}else throw Error('Choisissez une image ou une vidéo compatible.');if(ticket!==revision||mediaTicket!==mediaRevision)return;
 // Commit only a fully prepared replacement. A decode/validation failure keeps the old media.
 const nextURL=URL.createObjectURL(file);if(objectURL)URL.revokeObjectURL(objectURL);$('video-preview').pause();$('video-preview').removeAttribute('src');
 mediaFile=file;mediaBusy=false;flow.shared=false;flow.downloaded=false;flow.published=false;$('publication-check').checked=false;$('publication-receipt').textContent='';
 objectURL=nextURL;const video=file.type.startsWith('video/');$('preview').hidden=video;$('video-preview').hidden=!video;$(video?'video-preview':'preview').src=objectURL;$('download').href=objectURL;$('download').download=file.name;$('media-name').textContent=video?'Vidéo originale · format et orientation conservés':'Image Story · 1080 × 1920';syncDraft();if(selected?.link)message('Visuel et lien prêts. Copiez le lien pour continuer.')}
$('story-media').onchange=async()=>{const file=$('story-media').files?.[0];if(!file||!selected)return;const ticket=revision,mediaTicket=++mediaRevision;mediaBusy=true;syncDraft();try{message('Préparation du média…');await prepareMedia(file,ticket,mediaTicket)}catch{if(ticket===revision&&mediaTicket===mediaRevision)message('Média refusé : image valide de 25 Mo maximum ou vidéo de 100 Mo maximum.'+(mediaFile?' Le média précédent est conservé.':''))}finally{if(ticket===revision&&mediaTicket===mediaRevision){mediaBusy=false;syncDraft()}}};
$('copy').onclick=()=>{if(!selected?.link)return;const url=selected.link,ticket=revision;try{navigator.clipboard.writeText(url).then(()=>{if(ticket!==revision)return;flow.copied=true;$('manual-copy').hidden=true;syncDraft();message('Lien copié. Partagez maintenant le média vers Instagram.')},()=>{if(ticket===revision)manualCopy()})}catch{manualCopy()}};
function manualCopy(){flow.copied=false;syncDraft();const input=$('story-link');input.focus();input.select();input.setSelectionRange(0,input.value.length);$('manual-copy').hidden=false;message('Copie automatique indisponible : appui long sur le lien sélectionné, puis Copier. Confirmez ensuite la copie manuelle.')}
$('manual-copy').onclick=()=>{if(!selected?.link)return;flow.copied=true;$('manual-copy').hidden=true;syncDraft();message('Copie manuelle confirmée. Partagez le média vers Instagram.')};
$('share').onclick=()=>{if(!prepared||!flow.copied)return;const data={files:[prepared.file]},ticket=revision,mediaTicket=mediaRevision;if(!canShareFile(prepared.file)){message('Enregistrez le média puis importez-le dans Instagram.');return}
 // Samsung: the file is ready before the tap. No await, fetch, conversion or clipboard write here.
 try{navigator.share(data).then(()=>{if(ticket!==revision||mediaTicket!==mediaRevision)return;flow.shared=true;syncDraft();message('Média remis au partage système. Dans Instagram : Story → sticker Lien → coller → publier. Revenez ici après publication.')},e=>{if(ticket===revision)message(e.name==='AbortError'?'Partage annulé. Votre brouillon est conservé.':'Partage refusé. Enregistrez le média puis importez-le dans Instagram.')})}catch{message('Partage indisponible. Enregistrez le média puis importez-le dans Instagram.')}};
$('download').onclick=event=>{if(!mediaFile||mediaBusy){event.preventDefault();return}flow.downloaded=true;syncDraft();message('Enregistrez le média dans la galerie, puis importez-le dans une Story Instagram et ajoutez le sticker Lien.')};
$('publication-check').onchange=syncDraft;$('confirm-publication').onclick=()=>{if(!prepared||!flow.copied||!$('publication-check').checked||(!flow.shared&&!flow.downloaded))return;flow.published=true;syncDraft();$('publication-receipt').textContent='Publication déclarée par vous sur cet appareil. Instagram ne vérifie pas cette déclaration.';message('Parcours terminé. Vous pouvez préparer une nouvelle Story.')};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&prepared&&flow.shared&&!flow.published)message('De retour dans PulSe : vérifiez que le sticker Lien a été ajouté et la Story publiée, puis terminez le parcours ci-dessous.')});
function svgNode(tag,attrs,text){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;return e}
const dateLabel=date=>new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
let lastChartDays=[],chartWidth=0;
function updateChart(days){lastChartDays=days;const root=$('chart');chartWidth=root.clientWidth;root.replaceChildren();$('daily-values').replaceChildren();$('daily-details').hidden=false;$('chart-help').hidden=days.length<=7;$('chart-selection').textContent='Touchez une barre pour lire le jour et sa valeur.';
 const width=Math.max(320,chartWidth,days.length>7?days.length*48+56:0),height=260,left=38,right=12,bottom=207,plot=163,step=(width-left-right)/days.length,max=Math.max(4,Math.ceil(Math.max(...days.map(d=>d.clicks))/4)*4);
 const svg=svgNode('svg',{viewBox:'0 0 '+width+' '+height,width,height,role:'group','aria-label':'Clics quotidiens LinKs'}),defs=svgNode('defs',{}),gradient=svgNode('linearGradient',{id:'pulse-click-gradient',x1:'0',y1:'0',x2:'0',y2:'1'});gradient.append(svgNode('stop',{offset:'0%','stop-color':'#32c3ff'}),svgNode('stop',{offset:'100%','stop-color':'#0064ef'}));defs.append(gradient);svg.append(defs);
 for(let i=0;i<=4;i++){const y=bottom-i*plot/4;svg.append(svgNode('line',{x1:left,x2:width-right,y1:y,y2:y,class:'grid'}),svgNode('text',{x:left-8,y:y+5,'text-anchor':'end',class:'axis-value'},String(max*i/4)))}
 days.forEach((d,i)=>{const h=plot*d.clicks/max,x=left+i*step+6,cx=x+(step-12)/2,label=dateLabel(d.date)+' : '+number.format(d.clicks)+' clics',bar=svgNode('rect',{x,y:bottom-h,width:Math.max(8,step-12),height:h,rx:4,class:'bar',fill:'url(#pulse-click-gradient)'});svg.append(bar,svgNode('text',{x:cx,y:bottom-h-10,'text-anchor':'middle',class:'bar-value'},number.format(d.clicks)),svgNode('text',{x:cx,y:bottom+25,'text-anchor':'middle',class:'day-label'},dateLabel(d.date)));
 const hit=svgNode('rect',{x:left+i*step,y:20,width:step,height:bottom-15,fill:'transparent',class:'chart-hit',tabindex:0,role:'button','aria-label':label});hit.append(svgNode('title',{},label));const show=()=>{$('chart-selection').textContent=label};hit.onclick=show;hit.onfocus=show;hit.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show()}};svg.append(hit);const tr=node('tr');tr.append(node('td','',dateLabel(d.date)),node('td','',number.format(d.clicks)));$('daily-values').append(tr)});root.append(svg)
}
new ResizeObserver(()=>{if(lastChartDays.length&&$('chart').clientWidth>0&&chartWidth!==$('chart').clientWidth)updateChart(lastChartDays)}).observe($('chart'));
function resetStats(reason){lastChartDays=[];for(const id of ['stat-today','stat-period','stat-story'])$(id).textContent='—';$('chart-caption').textContent=reason;$('chart').replaceChildren(node('p','empty',reason));$('daily-details').hidden=true;$('daily-values').replaceChildren();$('chart-help').hidden=true;$('chart-selection').textContent=''}
async function refreshInsights(requested,ticket){
 $('insights-content').hidden=true;$('insights-links').replaceChildren();$('insights-sources').replaceChildren();$('insights-status').textContent='Chargement…';
 try{const data=await api('/api/insights?days='+requested);if(ticket!==statsRevision)return;if(!data.available){$('insights-status').textContent=data.reason||'Synthèse indisponible.';return}
  $('insights-status').textContent='LinKs · '+requested+' jours';$('insights-summary').textContent=number.format(data.trackedTotal)+' clics sur les liens suivis · '+number.format(data.activeCampaigns)+' campagnes éligibles maintenant';
  for(const row of data.topLinks){const button=node('button','selection-button');button.type='button';button.disabled=!row.available;button.append(node('span','selection-copy',row.name+(row.available?'':' · indisponible')),node('strong','',number.format(row.clicks)));button.onclick=()=>{showView('links');linkManager.focusLink(row.id)};$('insights-links').append(button)}
  if(!data.topLinks.length)$('insights-links').append(node('p','empty','Aucun clic suivi sur cette période.'));
  for(const row of data.sources){const line=node('p');line.append(node('span','',row.name),node('strong','',number.format(row.clicks)));$('insights-sources').append(line)}
  if(!data.sources.length)$('insights-sources').append(node('p','empty','Aucune source avec des clics suivis.'));
  $('insights-content').hidden=false;
 }catch{if(ticket===statsRevision)$('insights-status').textContent='Synthèse indisponible. Vérifiez votre connexion privée.'}
}
async function refreshStats(){const ticket=++statsRevision,requested=period;resetStats('Chargement…');refreshInsights(requested,ticket);try{const s=await api('/api/stats?days='+requested);if(ticket!==statsRevision)return;if(!s.available){resetStats(s.reason||'Statistiques indisponibles');return}$('stat-today').textContent=number.format(s.today);$('stat-period').textContent=number.format(s.total);$('stat-story').textContent=number.format(s.stories);$('chart-caption').textContent='LinKs · '+requested+' jours';updateChart(s.days)}catch{if(ticket===statsRevision)resetStats('Statistiques indisponibles')}}
for(const b of document.querySelectorAll('[data-period]'))b.onclick=()=>{period=Number(b.dataset.period);for(const p of document.querySelectorAll('[data-period]'))p.setAttribute('aria-pressed',String(p===b));$('period-label').textContent='Clics sur '+period+' jours';refreshStats()};
async function refreshCatalog(){const ticket=++catalogRevision;$('connection-status').textContent='Actualisation…';try{const next=await api('/api/catalog?refresh=1');if(ticket!==catalogRevision)return;catalog=next;renderLists();renderVideo();$('connection-status').textContent=catalog.trackedAvailable?'Synchronisé avec LinKs':'Offres synchronisées · passerelle privée indisponible'}catch{if(ticket!==catalogRevision)return;catalog={campaigns:[],trackedLinks:[]};renderLists();renderVideo();$('connection-status').textContent='LinKs momentanément inaccessible'}}
$('refresh').onclick=()=>{refreshCatalog();refreshStats()};
let installPrompt=null,installed=false;const displayMode=matchMedia('(display-mode: standalone)');function updateInstall(){const yes=installed||displayMode.matches||navigator.standalone===true;$('install').textContent=yes?'App installée':'Installer l’app';$('install').disabled=yes;if(yes)$('install-help').hidden=true}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;updateInstall()});window.addEventListener('appinstalled',()=>{installed=true;installPrompt=null;updateInstall()});displayMode.addEventListener('change',updateInstall);
$('install').onclick=async()=>{if(installPrompt){const current=installPrompt;installPrompt=null;try{await current.prompt();const choice=await current.userChoice;$('install-help').textContent=choice.outcome==='accepted'?'Installation demandée. Ouvrez PulSe depuis votre écran d’accueil.':'Installation annulée. Vous pouvez réessayer depuis le menu du navigateur.'}catch{$('install-help').textContent=installationHelp(navigator.userAgent,navigator.maxTouchPoints)}$('install-help').hidden=false;updateInstall();return}$('install-help').textContent=installationHelp(navigator.userAgent,navigator.maxTouchPoints);$('install-help').hidden=false};
updateInstall();refreshCatalog();refreshStats();if(isSecureContext&&'serviceWorker'in navigator)pwaUpdates=watchUpdates({hasDraft:()=>mediaBusy||!!selected&&!flow.published||linkManager.hasDraft()});
