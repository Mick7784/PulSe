'use strict';
const $=id=>document.getElementById(id);
const number=new Intl.NumberFormat('fr-FR');
let catalog={campaigns:[],trackedLinks:[]},selected=null,prepared=null,pendingLink=null,objectURL=null,lastShare=false,personalTracked=false,personalURL='';
const storedKey='pulse-confirmations-v1';
function message(value){$('story-status').textContent=value||''}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el}
function canShareFile(file){try{return !!navigator.share&&!!navigator.canShare?.({files:[file]})}catch{return false}}
async function api(path,options={}){const response=await fetch(path,{cache:'no-store',...options});if(!response.ok){let err={};try{err=await response.json()}catch{}throw new Error(err.error||'Erreur de connexion.')}return response.json()}
function confirmations(){try{const x=JSON.parse(localStorage.getItem(storedKey)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
function saveConfirmation(){if(!prepared||prepared.confirmed)return;let list=confirmations();list.unshift({id:prepared.id,title:prepared.title,at:new Date().toISOString()});list=list.slice(0,100);try{localStorage.setItem(storedKey,JSON.stringify(list))}catch{}prepared.confirmed=true;renderDeclared();message('Story déclarée publiée sur cet appareil. Instagram ne confirme pas cette action.')}
function renderDeclared(){const n=confirmations().length;$('stat-stories').textContent=number.format(n)}
function toggleStory(open){$('story-toggle').setAttribute('aria-expanded',String(open));$('story-collapse').classList.toggle('open',open);$('story-panel').setAttribute('aria-hidden',String(!open));$('story-panel').inert=!open}
$('story-toggle').addEventListener('click',()=>toggleStory($('story-toggle').getAttribute('aria-expanded')!=='true'));
function clearPrepared(){prepared=null;pendingLink=null;lastShare=false;if(objectURL)URL.revokeObjectURL(objectURL);objectURL=null}
function imageFallback(label){const thumb=node('span','thumbnail','▧');thumb.title=label;return thumb}
function renderList(name,items){
 const root=$(name);root.replaceChildren();if(!items.length){root.append(node('p','empty',name==='campaigns'?'Aucune offre active actuellement.':(catalog.trackedAvailable?'Aucun lien suivi disponible.':'Liens suivis : connexion privée LinKs à finaliser.')));return}
 for(const item of items){
  const card=node('article','selection-card'),button=node('button','selection-button');button.type='button';button.setAttribute('aria-expanded',String(selected===name+':'+item.id));
  const thumb=imageFallback(item.title);if(item.image&&item.image.startsWith('/')){const img=node('img');img.alt='';img.loading='lazy';img.src='/api/visual?id='+encodeURIComponent(item.id);img.onerror=()=>img.remove();thumb.replaceChildren(img)}
  const copy=node('span','selection-copy');copy.append(node('strong','',item.title),node('small','',item.description||((item.promoCode?'Code : '+item.promoCode:'')||(name==='campaigns'?'Campagne active':'Lien suivi LinKs'))));
  button.append(thumb,copy,node('span','chev','›'));
  const detail=node('div','selection-detail');detail.hidden=selected!==name+':'+item.id;
  button.onclick=()=>{
   const previous=selected;selected=previous===name+':'+item.id?null:name+':'+item.id;clearPrepared();renderEverything();
   if(selected)prepareItem(item);else message('');
  };
  card.append(button,detail);root.append(card);
  if(selected===name+':'+item.id)renderSelectionDetail(item,detail);
 }
}
function renderEverything(){renderList('campaigns',catalog.campaigns);renderList('tracked-links',filterLinks());$('offers-count').textContent=catalog.campaigns.length;$('links-count').textContent=catalog.trackedLinks.length;$('stat-offers').textContent=number.format(catalog.campaigns.length);const chooser=$('personal-existing'),saved=chooser.value;chooser.replaceChildren(new Option('Aucun lien',''));for(const item of [...catalog.campaigns,...catalog.trackedLinks])chooser.add(new Option((item.type==='independent'?'Lien suivi : ':'Offre : ')+item.title,(item.type==='independent'?'independent:':'campaign:')+item.id));if([...chooser.options].some(x=>x.value===saved))chooser.value=saved}
function filterLinks(){const q=$('link-search').value.trim().toLocaleLowerCase('fr');return q?catalog.trackedLinks.filter(x=>(x.title+' '+x.description).toLocaleLowerCase('fr').includes(q)):catalog.trackedLinks.slice(0,25)}
$('link-search').addEventListener('input',()=>renderList('tracked-links',filterLinks()));
function mkButton(text,cb,cls=''){const b=node('button',cls,text);b.type='button';b.onclick=cb;return b}
function actions(container){
 container.replaceChildren();if(!prepared){container.append(node('p','small-note','Préparation du visuel…'));return}
 const copy=mkButton('⧉ Copier le lien',()=>copyLink());copy.disabled=!prepared.url;
 const share=mkButton('↗ Partager l’image',()=>shareImage());share.disabled=!canShareFile(prepared.file);
 const download=mkButton('↓ Enregistrer le visuel',()=>{const a=node('a');a.href=objectURL;a.download=prepared.file.name;a.click()},'ghost');
 container.append(copy,share,download);
 if(lastShare&&!prepared.confirmed)container.append(mkButton('✓ Je l’ai publiée',saveConfirmation,'ghost'));
}
function renderSelectionDetail(item,container){
 container.replaceChildren();
 if(item.promoCode)container.append(node('div','offer-tag','Code promo : '+item.promoCode));
 const ready=prepared?.id===item.id,needsPhoto=pendingLink?.id===item.id;
 const info=ready?(prepared.tracked?'Lien suivi LinKs préparé.':'Lien direct de la campagne (tracking Story à connecter).'):needsPhoto?'Choisis une photo pour utiliser ce contenu en Story.':'Récupération du visuel et du lien…';
 container.append(node('p','small-note',info));
 if(needsPhoto){
  const file=node('input');file.type='file';file.accept='image/*';file.id='selected-story-photo';
  const label=node('label','file-button','＋ Choisir une photo');label.htmlFor=file.id;
  file.addEventListener('change',async()=>{
   const picked=file.files?.[0],link=pendingLink;
   if(!picked||!link||link.id!==item.id)return;
   try {message('Préparation de ta photo…');await composeImage(picked,link.id,link.title,link.url,link.tracked);renderEverything();message('Prêt : copie le lien puis partage l’image.');}
   catch(e){message('Impossible de préparer cette image : '+e.message)}
  });
  container.append(label,file);return;
 }
 const holder=node('div','actions');container.append(holder);actions(holder);
}
async function copyLink(){if(!prepared?.url)return;try{await navigator.clipboard.writeText(prepared.url);message(prepared.tracked?'Lien suivi copié. Ajoute-le avec le sticker Instagram.':'Lien direct copié (sans suivi Story). Ajoute-le avec le sticker Instagram.')}catch{message('Copie refusée par le navigateur. Sélectionne le lien ci-dessous.');const promptNode=prompt('Copie ce lien :',prepared.url);void promptNode}}
function shareImage(){if(!prepared)return;const file=prepared.file;const data={files:[file]};if(!canShareFile(file)){message('Partage natif indisponible. Enregistre le visuel puis ouvre Instagram.');return}
 // No await before navigator.share: preserve user activation on Samsung.
 navigator.share(data).then(()=>{lastShare=true;message('Partage remis à Android. Après publication réelle, tu peux la déclarer dans PulSe.');refreshActions()}).catch(error=>{message(error?.name==='AbortError'?'Partage annulé.':'Partage refusé. Essaie « Enregistrer le visuel ».')});
}
function refreshActions(){if(selected){renderEverything()}else actions($('personal-actions'))}
async function fileToCanvas(file){if(file.size>25*1024*1024)throw new Error('Image trop lourde (25 Mo maximum).');const object=URL.createObjectURL(file);try{const img=new Image();img.src=object;await img.decode();return img}finally{URL.revokeObjectURL(object)}}
function canvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Encodage JPEG impossible.')),'image/jpeg',.92))}
async function composeImage(source,id,title,url,tracked){
 const image=await fileToCanvas(source),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#111b2a';ctx.fillRect(0,0,1080,1920);
 // Soft blurred background fills spare space, image itself is never cropped.
 const cover=Math.max(1080/image.naturalWidth,1920/image.naturalHeight),bgw=image.naturalWidth*cover,bgh=image.naturalHeight*cover;
 ctx.save();ctx.filter='blur(48px) brightness(.55)';ctx.drawImage(image,(1080-bgw)/2,(1920-bgh)/2,bgw,bgh);ctx.restore();
 const contain=Math.min(1080/image.naturalWidth,1920/image.naturalHeight),w=image.naturalWidth*contain,h=image.naturalHeight*contain;
 ctx.drawImage(image,(1080-w)/2,(1920-h)/2,w,h);
 const blob=await canvasBlob(canvas);clearPrepared();const file=new File([blob],'pulse-story-'+Date.now()+'.jpg',{type:'image/jpeg'});
 prepared={id,title,url,tracked,file,confirmed:false};objectURL=URL.createObjectURL(file);
}
async function prepareItem(item){
 message('Préparation en cours…');try{
  const group=item.type==='independent'?'independent':'campaign';
  const linkData=await api('/api/story-link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,type:group})});
  if(!item.image?.startsWith('/')){pendingLink={id:item.id,title:item.title,url:linkData.url,tracked:linkData.tracked};renderEverything();message('Choisis une photo pour illustrer cette Story.');return}
  const resp=await fetch('/api/visual?id='+encodeURIComponent(item.id),{cache:'no-store'});if(!resp.ok)throw new Error('Visuel non disponible dans LinKs.');
  const blob=await resp.blob();await composeImage(new File([blob],'visuel', {type:blob.type}),item.id,item.title,linkData.url,linkData.tracked);
  renderEverything();message('Prêt : copie le lien puis partage l’image.');
 }catch(e){renderEverything();message(e.message+' Tu peux sélectionner une photo personnelle à la place.')}
}
$('photo').addEventListener('change',async()=>{
 const file=$('photo').files?.[0];if(!file)return;selected=null;clearPrepared();renderEverything();$('personal-options').hidden=false;$('photo-name').textContent=file.name;$('personal-existing').value='';personalTracked=false;personalURL='';
 await preparePersonal();
});
async function preparePersonal(){const file=$('photo').files?.[0];if(!file)return;const url=personalURL;
 try{message('Préparation de ta photo…');await composeImage(file,'photo-'+Date.now(),'Photo personnelle',url,personalTracked);actions($('personal-actions'));message('Photo prête. '+(url?'Lien personnel non suivi.':'Aucun lien associé.'))}
 catch(e){message('Cette image ne peut pas être préparée : '+e.message)}
}
$('personal-existing').addEventListener('change',async()=>{const value=$('personal-existing').value;if(!value){personalTracked=false;personalURL='';await preparePersonal();return}const [type,id]=value.split(':');const item=(type==='independent'?catalog.trackedLinks:catalog.campaigns).find(x=>x.id===id);if(!item)return;try{const link=await api('/api/story-link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,id})});personalTracked=!!link.tracked;personalURL=link.url;await preparePersonal()}catch(e){message(e.message)}});
function updateChart(days){const root=$('chart');root.replaceChildren();if(!days?.length){root.append(node('span','','Aucune donnée graphique.'));return}
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 320 150');svg.setAttribute('role','img');svg.setAttribute('aria-label','Clics quotidiens');
 const max=Math.max(1,...days.map(x=>x.clicks));const width=320/days.length;
 days.forEach((d,i)=>{const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');const h=100*d.clicks/max;rect.setAttribute('x',String(i*width+2));rect.setAttribute('y',String(130-h));rect.setAttribute('width',String(Math.max(2,width-4)));rect.setAttribute('height',String(Math.max(1,h)));rect.setAttribute('rx','2');rect.setAttribute('fill','#6bb9e4');const t=document.createElementNS('http://www.w3.org/2000/svg','title');t.textContent=d.date+' : '+d.clicks+' clics';rect.append(t);svg.append(rect)});root.append(svg)
}
async function refresh(){
 $('connection-status').textContent='Actualisation…';
 try {catalog=await api('/api/catalog?refresh=1');renderEverything();$('connection-status').textContent=catalog.trackedAvailable?'Offres et liens suivis synchronisés avec LinKs':'Offres synchronisées · liens suivis à connecter';}
 catch(e){$('connection-status').textContent='LinKs inaccessible';message(e.message);catalog={campaigns:[],trackedLinks:[]};renderEverything()}
 try{const s=await api('/api/stats');if(!s.available){$('chart-caption').textContent='Passerelle non connectée';return}$('stat-today').textContent=s.today==null?'—':number.format(s.today);$('stat-week').textContent=s.last7==null?'—':number.format(s.last7);$('chart-caption').textContent='Données LinKs';updateChart(s.days)}catch{$('chart-caption').textContent='Statistiques indisponibles'}
}
$('refresh').addEventListener('click',refresh);
toggleStory(false);renderDeclared();refresh();
if(isSecureContext&&'serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
