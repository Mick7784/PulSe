// Mobile client only: all affiliation, duplicate and token decisions come from LinKs.
export function initLinkManager({onDraft,onSaved}){
 const $=id=>document.getElementById(id),form=$('link-form');
 let data={items:[],partners:[],sources:[]},current=null,shareItem=null,receipt=null,preview=null,dirty=false,busy=false,loaded=false,ticket=0,shareTicket=0,debounce;
 const status=text=>{$('links-status').textContent=text};
 const draft=()=>{onDraft();$('link-form-dot').hidden=!dirty};
 const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el};
 async function api(action,body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch('/api/'+action,{method:body?'POST':'GET',cache:'no-store',signal:controller.signal,headers:body?{'Content-Type':'application/json','X-PulSe-Request':'1'}:{},body:body?JSON.stringify(body):undefined});
   let result;try{result=await response.json()}catch{throw Error('Connexion privée ou authentification requise. Votre saisie est conservée.')}
   if(!response.ok){const error=Error(result.error||'Connexion indisponible.');error.code=result.code;error.duplicates=result.duplicates;throw error}return result;
  }catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw Error('Connexion indisponible. Votre saisie est conservée. Réessayez après reconnexion.');throw error}
  finally{clearTimeout(timer)}
 }
 const post=(action,body)=>api(action,body);
 function setBusy(value){busy=value;$('link-fields').disabled=value;$('link-new').disabled=value||!loaded;$('link-close').disabled=value;draft()}
 function clearPreview(){ticket++;receipt=preview=null;$('link-preview-panel').hidden=true;$('link-save').disabled=true;$('link-reviewed').checked=false;$('link-destination-confirm').checked=false;$('link-duplicates').replaceChildren()}
 function clearShare(){shareTicket++;$('link-short').value='';$('link-copy').disabled=true;$('link-copy-manual').hidden=true;$('link-share-status').textContent=''}
 function renderList(){
  const query=$('manage-search').value.trim().toLocaleLowerCase('fr'),root=$('managed-links');root.replaceChildren();
  const rows=data.items.filter(row=>(row.name+' '+row.url+' '+row.original_url).toLocaleLowerCase('fr').includes(query));
  if(!rows.length)root.append(node('p','Aucun lien correspondant.'));
  for(const row of rows){const card=node('article','');card.className='managed-link';card.append(node('strong',row.name),node('p',row.url));const actions=node('div','');actions.className='link-actions';
   for(const [label,handler] of [['Modifier',()=>open(row)],['Partager',()=>share(row)]]){const b=node('button',label);b.type='button';b.className='secondary';b.onclick=handler;actions.append(b)}card.append(actions);root.append(card)}
 }
 async function load(){
  status('Connexion à LinKs…');$('links-retry').disabled=true;
  try{const next=await api('link-manager');data=next;loaded=true;
   const choice=$('link-partner').value,source=$('link-source').value;
   $('link-partner').replaceChildren(new Option('Détection automatique','auto'),new Option('Aucun',''),...data.partners.map(p=>new Option(p.name,p.id)));
   $('link-partner').value=[...$('link-partner').options].some(o=>o.value===choice)?choice:'auto';
   $('link-source').replaceChildren(new Option('Choisir une source…',''),...data.sources.map(s=>new Option(s.name+(s.historical?' · historique':''),s.id)));
   $('link-source').value=data.sources.some(s=>s.id===source)?source:'';clearShare();renderList();status('Liens synchronisés avec LinKs.');
  }catch(error){status(error.message)}finally{$('links-retry').disabled=false;$('link-new').disabled=!loaded||busy}
 }
 function mayReplace(){return !busy&&(!dirty||window.confirm('Abandonner cette saisie non enregistrée ?'))}
 function open(row=null){
  if(!mayReplace())return;clearTimeout(debounce);clearPreview();current=row;dirty=false;
  $('link-name').value=row?.name||'';$('link-url').value=row?.original_url||row?.url||'';$('link-partner').value=row?.partner_id??'auto';
  $('link-form-title').textContent=row?'Modifier le lien':'Nouveau lien';form.hidden=false;$('link-share-panel').hidden=true;$('link-form-status').textContent='Vérifiez l’URL finale avant d’enregistrer.';
  $('link-name').focus();draft();if(row)verify();
 }
 function fields(){return {id:current?.id||'',revision:current?.revision||'',name:$('link-name').value.trim(),url:$('link-url').value.trim(),notes:current?.notes||'',partner_id:$('link-partner').value==='auto'?'':$('link-partner').value,detect:$('link-partner').value==='auto',apply_partner:false}}
 function saveState(){$('link-save').disabled=busy||!receipt||!$('link-reviewed').checked||(preview.changed&&!$('link-destination-confirm').checked)||preview.duplicate_confirmation_required}
 function duplicates(rows){
  const root=$('link-duplicates');root.replaceChildren();if(!rows?.length)return;
  root.append(node('strong','Cette destination existe déjà dans LinKs.'));
  for(const row of rows){const b=node('button','Réutiliser « '+row.name+' »'+(!row.enabled||row.archived?' · indisponible':''));b.type='button';b.className='secondary';b.disabled=!row.enabled||row.archived;b.onclick=async()=>{
   if(!mayReplace())return;
   // Reuse selects the existing identity; it never renames or overwrites it.
   const existing=data.items.find(item=>item.id===row.id);if(!existing){await load();}
   const found=data.items.find(item=>item.id===row.id);if(!found){status('Lien indisponible. Actualisez la liste dans LinKs.');return}
   dirty=false;form.hidden=true;draft();share(found);status('Lien existant réutilisé. Aucune destination modifiée.');
  };root.append(b)}
 }
 async function verify(){
  clearTimeout(debounce);clearPreview();const request=fields(),mine=ticket;
  if(!request.name||!request.url){$('link-form-status').textContent='Renseignez le nom et l’URL pour obtenir l’aperçu.';return}
  $('link-form-status').textContent='Vérification dans LinKs…';
  try{const result=await post('link-preview',request);if(mine!==ticket)return;
   receipt=result.receipt;preview=result.preview;
   $('link-final').textContent=preview.url;$('link-final').href=preview.url;
   $('link-detected').textContent='Partenaire : '+(data.partners.find(p=>p.id===preview.partner_id)?.name||'Aucun');
   $('link-previous').textContent=preview.previous_url;
   $('link-change-warning').hidden=!preview.changed;duplicates(preview.duplicates);
   $('link-preview-panel').hidden=false;$('link-form-status').textContent='Aperçu calculé par LinKs. Vérifiez la destination ci-dessous.';saveState();
  }catch(error){if(mine===ticket)$('link-form-status').textContent=error.message}
 }
 for(const id of ['link-name','link-url','link-partner'])$(id).addEventListener(id==='link-partner'?'change':'input',()=>{dirty=true;clearPreview();draft();clearTimeout(debounce);debounce=setTimeout(verify,350)});
 $('link-verify').onclick=verify;$('link-reviewed').onchange=saveState;$('link-destination-confirm').onchange=saveState;
 form.onsubmit=async event=>{
  event.preventDefault();if($('link-save').disabled||!receipt)return;
  clearTimeout(debounce);setBusy(true);$('link-form-status').textContent='Enregistrement dans LinKs…';
  try{const result=await post('link-save',{...receipt,confirm_destination:$('link-destination-confirm').checked});
   current=result.item;data.items=[result.item,...data.items.filter(row=>row.id!==result.item.id)];dirty=false;form.hidden=true;clearPreview();renderList();share(result.item,true);status('Lien enregistré dans LinKs. Choisissez sa source de suivi.');onSaved();
  }catch(error){$('link-form-status').textContent=error.message;if(error.code==='DUPLICATE'){receipt=null;$('link-save').disabled=true;duplicates(error.duplicates)}if(error.code==='REVIEW_REQUIRED')clearPreview();}
  finally{setBusy(false);if(receipt)saveState()}
 };
 function share(row,afterSave=false){
  if(!afterSave&&!mayReplace())return;
  dirty=false;clearTimeout(debounce);clearPreview();form.hidden=true;shareItem=row;clearShare();
  $('link-share-title').textContent=row.name;$('link-share-destination').textContent=row.url;$('link-share-panel').hidden=false;
  $('link-share-panel').scrollIntoView({block:'start',behavior:'smooth'});draft();
 }
 $('link-source').onchange=clearShare;
 $('link-generate').onclick=async()=>{
  if(busy||!shareItem)return;clearShare();const mine=shareTicket,source=$('link-source').value,selected=shareItem;
  if(!source){$('link-share-status').textContent='Choisissez une plateforme/source.';return}
  setBusy(true);$('link-generate').disabled=true;
  try{const result=await post('link-token',{id:selected.id,expected_url:selected.url,source_id:source});if(mine!==shareTicket)return;
   $('link-short').value=result.url;$('link-copy').disabled=false;$('link-share-status').textContent='Lien court prêt pour cette source. Vous pouvez le copier.';
  }catch(error){if(mine===shareTicket)$('link-share-status').textContent=error.message}
  finally{setBusy(false);$('link-generate').disabled=false}
 };
 function manual(){const input=$('link-short');input.focus();input.select();input.setSelectionRange(0,input.value.length);$('link-copy-manual').hidden=false;$('link-share-status').textContent='Copie automatique refusée. Appui long sur le lien, puis Copier et confirmer.'}
 $('link-copy').onclick=()=>{const url=$('link-short').value,mine=shareTicket;if(!url)return;try{navigator.clipboard.writeText(url).then(()=>{if(mine===shareTicket)$('link-share-status').textContent='Lien copié.'},()=>{if(mine===shareTicket)manual()})}catch{manual()}};
 $('link-copy-manual').onclick=()=>{$('link-share-status').textContent='Copie manuelle confirmée.';$('link-copy-manual').hidden=true};
 $('link-new').onclick=()=>open();$('links-retry').onclick=()=>{if(!busy)load()};$('manage-search').oninput=renderList;
 $('link-close').onclick=()=>{if(!mayReplace())return;dirty=false;clearTimeout(debounce);clearPreview();form.hidden=true;draft()};
 return {enter:()=>{if(!loaded)load()},hasDraft:()=>dirty||busy};
}
