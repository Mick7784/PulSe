'use strict';
import {installationHelp,watchUpdates} from './pwa.mjs';
import {initLinkManager} from './link-manager.js';
const $=id=>document.getElementById(id),number=new Intl.NumberFormat('fr-FR');
let catalog={campaigns:[],trackedLinks:[]},selected=null,prepared=null,objectURL=null,revision=0,statsRevision=0,catalogRevision=0,mediaRevision=0,mediaFile=null,mediaBusy=false,flow={copied:false,shared:false,downloaded:false,published:false};
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
function showView(view,{fromHistory=false}={}){
 if(!['stats','stories','links'].includes(view)||view===activeView)return;
 if(!fromHistory)history.pushState({pulseView:view},'');
 if(activeView==='links')linkManager.endStory();
 viewScroll[activeView]=window.scrollY;activeView=view;
 for(const name of ['stats','stories','links']){
  $(name+'-view').hidden=name!==view;
  const button=$('nav-'+name);if(name===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
 }
 $('story-panel').hidden=view!=='stories';
 document.title='PulSe — '+({stats:'Statistiques',stories:'Stories',links:'Liens'}[view]);
 if(view==='links')linkManager.enter();
 document.querySelector('.skip-link').href='#view-'+view+'-title';
 $('view-'+view+'-title').focus({preventScroll:true});
 window.scrollTo({top:viewScroll[view],behavior:'instant'});
}
history.replaceState({pulseView:activeView},'');
history.scrollRestoration='manual';
window.addEventListener('popstate',event=>showView(event.state?.pulseView||'stats',{fromHistory:true}));
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
function resetStats(reason){$('stat-today').textContent='—';$('today-comparison').textContent='';$('chart-caption').textContent=reason;$('chart').replaceChildren();$('insights-content').hidden=true;$('insights-status').textContent=reason}
async function refreshStats(){
 const ticket=++statsRevision;resetStats('Chargement…');
 try{const s=await api('/api/today');if(ticket!==statsRevision)return;if(!s.available){resetStats(s.reason||'Statistiques indisponibles');return}
  $('stat-today').textContent=number.format(s.today);
  $('today-comparison').textContent=number.format(s.yesterday)+' hier, journée complète';
  const max=Math.max(s.today,s.yesterday,1);
  for(const [label,count] of [["Aujourd’hui",s.today],['Hier · journée complète',s.yesterday]]){
   const line=node('div','today-bar'),text=node('div','today-bar-label');text.append(node('span','',label),node('strong','',number.format(count)));
   const track=node('div','today-track'),fill=node('div','today-fill');fill.style.width=(100*count/max)+'%';track.append(fill);line.append(text,track);$('chart').append(line);
  }
  $('chart-caption').textContent=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'short',timeStyle:'short'}).format(new Date(s.generatedAt))+' · '+(s.analyticsEnabled?'Actualisé':'Collecte désactivée : données partielles');
  $('insights-status').textContent='Classements limités aux liens suivis, inclus dans le total.';
  $('today-top-link').textContent=s.topLinks.length?'Lien le plus cliqué : '+s.topLinks[0].name+' · '+number.format(s.topLinks[0].clicks):'Aucun clic sur les liens suivis aujourd’hui.';
  $('today-top-source').textContent=s.sources.length?'Source principale : '+s.sources[0].name+' · '+number.format(s.sources[0].clicks):'Aucune source avec des clics aujourd’hui.';
  $('insights-summary').textContent=number.format(s.trackedTotal)+' clics sur les liens suivis aujourd’hui';$('insights-links').replaceChildren();$('insights-sources').replaceChildren();
  for(const row of s.topLinks){const b=node('button','selection-button');b.type='button';b.disabled=!row.available;b.append(node('span','selection-copy',row.name+(row.available?'':' · indisponible')),node('strong','',number.format(row.clicks)));b.onclick=()=>{showView('links');linkManager.focusLink(row.id)};$('insights-links').append(b)}
  for(const row of s.sources){const p=node('p');p.append(node('span','',row.name),node('strong','',number.format(row.clicks)));$('insights-sources').append(p)}
  $('insights-content').hidden=false;
 }catch{if(ticket===statsRevision)resetStats('Statistiques indisponibles. Réessayez après reconnexion.')}
}
// Re-read the daily snapshot after returning from another app or crossing midnight.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshStats()});
setInterval(()=>{if(document.visibilityState==='visible')refreshStats()},60000);
async function refreshCatalog(){const ticket=++catalogRevision;$('connection-status').textContent='Actualisation…';try{const next=await api('/api/catalog?refresh=1');if(ticket!==catalogRevision)return;catalog=next;renderLists();renderVideo();$('connection-status').textContent=catalog.trackedAvailable?'Synchronisé avec LinKs':'Offres synchronisées · passerelle privée indisponible'}catch{if(ticket!==catalogRevision)return;catalog={campaigns:[],trackedLinks:[]};renderLists();renderVideo();$('connection-status').textContent='LinKs momentanément inaccessible'}}
$('refresh').onclick=()=>{refreshCatalog();refreshStats()};
let installPrompt=null,installed=false;const displayMode=matchMedia('(display-mode: standalone)');function updateInstall(){const yes=installed||displayMode.matches||navigator.standalone===true;$('install').textContent=yes?'App installée':'Installer l’app';$('install').disabled=yes;$('install').hidden=yes;if(yes)$('install-help').hidden=true}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;updateInstall()});window.addEventListener('appinstalled',()=>{installed=true;installPrompt=null;updateInstall()});displayMode.addEventListener('change',updateInstall);
$('install').onclick=async()=>{if(installPrompt){const current=installPrompt;installPrompt=null;try{await current.prompt();const choice=await current.userChoice;$('install-help').textContent=choice.outcome==='accepted'?'Installation demandée. Ouvrez PulSe depuis votre écran d’accueil.':'Installation annulée. Vous pouvez réessayer depuis le menu du navigateur.'}catch{$('install-help').textContent=installationHelp(navigator.userAgent,navigator.maxTouchPoints)}$('install-help').hidden=false;updateInstall();return}$('install-help').textContent=installationHelp(navigator.userAgent,navigator.maxTouchPoints);$('install-help').hidden=false};
updateInstall();refreshCatalog();refreshStats();if(isSecureContext&&'serviceWorker'in navigator)pwaUpdates=watchUpdates({hasDraft:()=>mediaBusy||!!selected&&!flow.published||linkManager.hasDraft()});
