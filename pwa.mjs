export function installationHelp(userAgent='',touchPoints=0){
 const ios=/iPad|iPhone|iPod/.test(userAgent)||(/Macintosh/.test(userAgent)&&touchPoints>1);
 if(ios)return /CriOS|FxiOS|EdgiOS/.test(userAgent)?'Ouvrez cette page dans Safari, puis Partager → Sur l’écran d’accueil.':'Dans Safari : Partager → Sur l’écran d’accueil → Ajouter.';
 if(/Android/.test(userAgent))return 'Dans Chrome : menu ⋮ → Installer l’application ou Ajouter à l’écran d’accueil. Si PulSe est déjà installée, ouvrez-la depuis son icône.';
 return 'Utilisez l’option Installer dans la barre d’adresse ou le menu de Chrome ou Edge. Si elle manque, réessayez en HTTPS dans un navigateur compatible.';
}

// No draft, media, API response or user preference is persisted by this module.
export function watchUpdates({hasDraft}) {
 const notice=document.getElementById('update-notice'),text=document.getElementById('update-message');
 const apply=document.getElementById('update-apply'),later=document.getElementById('update-later');
 let registration,waiting,reloadReady=false,applying=false,dismissed=false,reloaded=false,timer;
 let controller=navigator.serviceWorker.controller,lastCheck=0;
 const available=()=>reloadReady||waiting?.state==='installed';
 function render(){
  notice.hidden=!available()||dismissed;
  apply.disabled=applying||hasDraft()||!navigator.onLine;
  text.textContent=hasDraft()?'Terminez votre Story avant de mettre à jour. Votre préparation reste ouverte.':
   !navigator.onLine?'Reconnectez-vous pour appliquer la mise à jour.':
   applying?'Mise à jour en cours…':'Une nouvelle version est prête. Rechargez PulSe quand vous le souhaitez.';
 }
 function reload(){
  clearTimeout(timer);applying=false;
  // Check again at activation: a Story may have started while the worker was waiting.
  if(hasDraft()||!navigator.onLine){render();return}
  if(!reloaded){reloaded=true;window.location.reload()}
 }
 function offer(worker){
  if(worker!==waiting){waiting=worker;dismissed=false}
  render();
 }
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  const updating=!!controller;controller=navigator.serviceWorker.controller;
  if(!updating)return; // Initial installation must not reload or interrupt a Story.
  waiting=null;reloadReady=true;dismissed=false;
  if(applying)reload();else render(); // Other tabs never reload without their own confirmation.
 });
 apply.onclick=()=>{
  if(!available()||applying||hasDraft()||!navigator.onLine)return;
  applying=true;render();
  if(reloadReady){reload();return}
  timer=setTimeout(()=>{
   applying=false;render();text.textContent='La mise à jour n’a pas pu être appliquée. Réessayez.';
  },10000);
  try{waiting.postMessage({type:'PULSE_ACTIVATE_UPDATE'})}
  catch{clearTimeout(timer);applying=false;render()}
 };
 later.onclick=()=>{dismissed=true;notice.hidden=true};
 async function check(){
  if(!registration||!navigator.onLine||document.visibilityState!=='visible'||Date.now()-lastCheck<60000)return;
  lastCheck=Date.now();try{await registration.update()}catch{/* Keep the running version available. */}
 }
 window.addEventListener('online',()=>{render();check()});
 window.addEventListener('offline',render);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){render();check()}});
 window.addEventListener('focus',check);
 navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{
  registration=reg;
  if(reg.waiting)offer(reg.waiting);
  const follow=worker=>worker?.addEventListener('statechange',()=>{
   if(worker.state==='installed'&&navigator.serviceWorker.controller)offer(reg.waiting||worker);
   if(worker.state==='redundant'&&waiting===worker){waiting=null;render()}
  });
  follow(reg.installing);reg.addEventListener('updatefound',()=>follow(reg.installing));
  check();
 }).catch(()=>{/* Installation help remains available if registration fails. */});
 setInterval(check,60*60*1000);
 return {refreshDraft:render};
}
