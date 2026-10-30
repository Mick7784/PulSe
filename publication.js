// Local preparation only: source identities and short URLs always come from LinKs.
export function initPublication({onDraft}){
 const $=id=>document.getElementById(id),root=$('publication-kit'),input=$('publication-text'),output=$('publication-output');
 let source=null,url='',dirty=false,busy=false,copied=false,handed=false,completed=false,revision=0;
 const supported=()=>['youtube','discord'].includes(source?.platform);
 const content=()=>url?[input.value.trim(),url].filter(Boolean).join('\n\n'):'';
 const valid=()=>supported()&&!!url&&content().length<=2000;
 const status=text=>{$('publication-status').textContent=text};
 function render(){
  root.hidden=!supported()&&!dirty;output.value=content();input.disabled=busy;
  $('publication-count').textContent=output.value.length+' / 2 000 caractères, lien inclus';
  $('publication-copy').disabled=!valid()||busy;$('publication-share').disabled=!valid()||busy||!navigator.share;
  $('publication-confirm-check').disabled=busy||!valid()||(!copied&&!handed)||completed;
  $('publication-confirm').disabled=$('publication-confirm-check').disabled||!$('publication-confirm-check').checked;
  $('publication-open').hidden=!supported();$('publication-open').href=source?.platform==='discord'?'https://discord.com/channels/@me':'https://www.youtube.com/';
  $('publication-open').textContent='Ouvrir '+(source?.platform==='discord'?'Discord':'YouTube');
  $('publication-target').textContent='Texte pour '+(source?.name||'');
  $('publication-hint').textContent=!supported()?'Choisissez la source YouTube ou Discord pour reprendre ce texte.':source.platform==='youtube'?'Collez le texte à l’emplacement prévu sur YouTube. Les liens des Shorts et des posts ne sont pas cliquables ; les descriptions et commentaires de vidéos longues dépendent des fonctionnalités avancées de votre chaîne.':'Collez le message dans le salon ou la conversation Discord choisi. Vérifiez le destinataire avant de publier.';
  onDraft();
 }
 function clearActions(){revision++;busy=false;copied=handed=completed=false;$('publication-confirm-check').checked=false;$('publication-manual').hidden=true;$('text-publication-receipt').textContent=''}
 input.oninput=()=>{dirty=true;clearActions();status(content().length>2000?'Raccourcissez le texte avant de le copier ou partager.':'Texte modifié : vérifiez et copiez à nouveau.');render()};
 function manual(){output.focus();output.select();output.setSelectionRange(0,output.value.length);$('publication-manual').hidden=false;status('Copie refusée. Sélectionnez le texte, copiez-le puis confirmez la copie manuelle.')}
 $('publication-copy').onclick=()=>{
  if(!valid()||busy)return;const mine=revision,value=content();dirty=true;busy=true;render();
  try{navigator.clipboard.writeText(value).then(()=>{if(mine===revision){copied=true;status('Texte et lien copiés. Collez-les dans la plateforme choisie.')}},()=>{if(mine===revision)manual()}).finally(()=>{if(mine===revision){busy=false;render()}})}catch{busy=false;manual();render()}
 };
 $('publication-manual').onclick=()=>{if(!valid())return;copied=true;dirty=true;$('publication-manual').hidden=true;status('Copie manuelle confirmée.');render()};
 $('publication-share').onclick=()=>{
  if(!valid()||busy||!navigator.share)return;const mine=revision;dirty=true;busy=true;render();
  // No asynchronous preparation before the native share call: retain touch activation.
  try{navigator.share({text:content()}).then(()=>{if(mine===revision){handed=true;status('Texte remis au partage système. Vérifiez puis publiez dans l’application choisie.')}},error=>{if(mine===revision)status(error.name==='AbortError'?'Partage annulé. Votre texte est conservé.':'Partage indisponible. Copiez le texte pour continuer.')}).finally(()=>{if(mine===revision){busy=false;render()}})}catch{busy=false;status('Partage indisponible. Copiez le texte pour continuer.');render()}
 };
 $('publication-open').onclick=()=>status('Collez le texte, vérifiez le lien puis publiez. Revenez ensuite confirmer ici.');
 $('publication-confirm-check').onchange=render;
 $('publication-confirm').onclick=()=>{if($('publication-confirm').disabled)return;completed=true;dirty=false;$('text-publication-receipt').textContent='Publication déclarée par vous sur cet appareil. Aucun envoi ni contrôle de publication automatique.';render()};
 return {
  reset(title=''){source=null;url='';input.value=title;dirty=false;clearActions();status('');render()},
  select(next){dirty=dirty||completed;source=next;url='';clearActions();status('Obtenez le lien court de cette source pour compléter le texte.');render()},
  ready(value){url=value;clearActions();status(content().length>2000?'Raccourcissez le texte avant de le copier ou partager.':'Vérifiez le texte et le lien avant de les copier.');render()},
  hasDraft:()=>dirty||busy,pending:()=>busy
 };
}
