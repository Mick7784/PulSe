// Real service-worker lifecycle with Basic Auth, two tabs and changing server builds.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const {readFile,mkdtemp}=require('node:fs/promises');
const {resolve}=require('node:path');
module.exports=async function(){
 const {createPulseServer}=await import('../serve.mjs');
 const source=await readFile(resolve(__dirname,'../sw.js'),'utf8');
 const legacySource=await readFile(resolve(__dirname,'fixtures/sw-phase2.js'),'utf8');
 const image=await readFile(resolve(__dirname,'../icon-192.png'));
 let build=0,failAsset=false,context;
 const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 const pulse=createPulseServer({user:'admin',password:'long-password-123',linksURL:'http://links.test',bridgeToken:'s'.repeat(64),fetcher:async(url)=>{
  const path=new URL(url).pathname;
  if(path==='/api/public-config')return json({links:[]});
  if(path==='/latest-video.json')return json(null);
  if(path==='/api/pulse/links')return json({links:[{id:'draft',name:'Lien de recette',url:'https://example.com',enabled:true,archived:false}]});
  if(path==='/api/pulse/link-manager')return json({version:1,items:[{id:'draft',name:'Lien de recette',url:'https://example.com',original_url:'https://example.com',revision:'test'}],partners:[],sources:[{id:'discord',name:'Discord',platform:'discord'}]});
  if(path==='/api/pulse/link-token')return json({url:'https://links.example/discord12',source_id:'discord'});
  if(path==='/api/pulse/story-link')return json({url:'https://links.example/test12345'});
  if(path==='/api/pulse/stats')return json({period:7,total:0,today:0,last7:0,stories:0,days:Array.from({length:7},(_,i)=>({date:'2026-10-'+(20+i),clicks:0}))});
  return new Response('{}',{status:404});
 }});
 const handler=pulse.listeners('request')[0];
 const server=http.createServer((req,res)=>{
  if(req.url==='/sw.js'){
   res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
   return res.end(build===0?legacySource:source.replace(/const VERSION = '[^']+';/,`const VERSION = 'pwa3-test-${build}';`));
  }
  if(req.url==='/icon-maskable-512.png'&&failAsset){res.writeHead(503);return res.end('unavailable')}
  handler(req,res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const update=page=>page.evaluate(async()=>{
  const reg=await navigator.serviceWorker.getRegistration();await reg.update();
  const worker=reg.installing;
  if(worker&&!['installed','activated','redundant'].includes(worker.state))await new Promise(resolve=>worker.addEventListener('statechange',()=>{if(['installed','activated','redundant'].includes(worker.state))resolve()}));
  return worker?.state;
 });
 try{
  context=await chromium.launchPersistentContext(await mkdtemp(resolve(__dirname,'../../pulse-pwa-profile-')),{headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),httpCredentials:{username:'admin',password:'long-password-123'},viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{
   window.addEventListener('beforeinstallprompt',e=>e.preventDefault());
   Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.resolve()}});
   Object.defineProperty(navigator,'canShare',{value:()=>true});
   Object.defineProperty(navigator,'share',{value:data=>{window.__lastSharedFiles=data.files;return Promise.resolve()}});
  });
  const page=await context.newPage(),other=await context.newPage();
  let loads=0,otherLoads=0;
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())loads++});
  other.on('framenavigated',frame=>{if(frame===other.mainFrame())otherLoads++});
  await page.goto(base);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.equal(await page.locator('#update-notice').isVisible(),false,'initial install must be silent');
  const maskableSafe=await page.evaluate(async()=>{
   for(const size of [192,512]){
    const bitmap=await createImageBitmap(await(await fetch('/icon-maskable-'+size+'.png')).blob());
    if(bitmap.width!==size||bitmap.height!==size)return false;
    const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
    const {data}=ctx.getImageData(0,0,size,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
     const p=(y*size+x)*4;if(data[p+3]!==255)return false;
     if((x-size/2)**2+(y-size/2)**2>(size*.4)**2&&
       (data[p]!==7||data[p+1]!==12||data[p+2]!==20))return false;
    }bitmap.close();
   }return true;
  });assert.equal(maskableSafe,true,'the complete artwork must stay within the Android safe circle');
  await other.goto(base);await other.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.evaluate(async()=>{
   const legacy=await caches.open('pulse-shell-legacy');await legacy.put('/app.js',new Response('old shell'));
   const foreign=await caches.open('another-app');await foreign.put('/foreign',new Response('unrelated'));
  });
  await page.locator('#nav-stories').click();await page.locator('#tracked-links button').click();
  await page.locator('#story-media').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:image});
  await page.waitForFunction(()=>!document.getElementById('preview').hidden&&!!document.getElementById('story-link').value);
  const draft=await page.locator('#preview').getAttribute('src'),link=await page.locator('#story-link').inputValue(),before=loads;

  build=2;failAsset=true;
  assert.equal(await update(page),'redundant','failed precache may not replace a working version');
  assert.equal(await page.locator('#update-notice').isVisible(),false);
  assert.equal(await page.evaluate(async()=>(await caches.keys()).includes('pulse-public-pwa3-test-2')),false);
  assert.equal(await page.locator('#preview').getAttribute('src'),draft);

  build=3;failAsset=false;await update(page);
  await page.waitForFunction(()=>!document.getElementById('update-notice').hidden);
  await other.waitForFunction(()=>!document.getElementById('update-notice').hidden);
  assert.equal(await page.locator('#update-apply').isDisabled(),true,'in-progress image blocks reload');
  assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),true);
  assert.equal(loads,before,'waiting update must not reload');
  await page.locator('#update-later').click();assert.equal(await page.locator('#update-notice').isVisible(),false);
  const otherBefore=otherLoads;
  await Promise.all([
   other.waitForEvent('framenavigated',frame=>frame===other.mainFrame()),
   other.locator('#update-apply').click()
  ]);
  await other.waitForFunction(()=>!!navigator.serviceWorker.controller&&document.getElementById('stat-today')?.textContent==='0');
  await page.waitForFunction(()=>!document.getElementById('update-notice').hidden);
  assert.equal(loads,before,'another tab may not reload the draft');
  assert.equal(otherLoads,otherBefore+1,'one explicit confirmation, one reload');
  assert.equal(await page.locator('#preview').getAttribute('src'),draft);
  assert.equal(await page.locator('#story-link').inputValue(),link);
  assert.equal(await page.locator('#update-apply').isDisabled(),true);

  await page.locator('#copy').click();await page.locator('#download').click();
  await page.locator('#publication-check').check();await page.locator('#confirm-publication').click();
  assert.equal(await page.locator('#update-apply').isEnabled(),true);
  await Promise.all([
   page.waitForEvent('framenavigated',frame=>frame===page.mainFrame()),
   page.locator('#update-apply').click()
  ]);
  await page.waitForFunction(()=>document.getElementById('stat-today')?.textContent==='0'&&document.getElementById('editor').hidden);
  assert.equal(loads,before+1,'completed draft permits a confirmed reload');

  await other.locator('#nav-stories').click();await other.locator('#tracked-links button').click();
  await other.locator('#story-media').setInputFiles({name:'video.mp4',mimeType:'video/mp4',buffer:Buffer.from('video-sharing-contract')});
  await other.waitForFunction(()=>document.getElementById('media-name').textContent.includes('Vidéo originale'));
  const video=await other.locator('#video-preview').getAttribute('src'),videoLoads=otherLoads;
  // Activation can race with starting a new preparation after the confirmation.
  build=4;await update(page);await page.waitForFunction(()=>!document.getElementById('update-notice').hidden);
  await page.locator('#nav-stories').click();
  const raceLoads=loads;
  await page.evaluate(()=>{document.getElementById('update-apply').click();document.querySelector('#tracked-links button').click()});
  await page.waitForFunction(async()=>{const reg=await navigator.serviceWorker.getRegistration();return !reg.waiting&&reg.active?.state==='activated'&&document.getElementById('update-apply').disabled});
  assert.equal(loads,raceLoads,'a newly started preparation must survive activation');
  assert.equal(await page.locator('#editor').isVisible(),true);
  assert.equal(otherLoads,videoLoads,'a video in another tab must not be reloaded');
  assert.equal(await other.locator('#video-preview').getAttribute('src'),video);
  assert.equal(await other.locator('#update-apply').isDisabled(),true);

  // A denied/private connection and a network drop must not clear an open Story.
  const networkDraft=await context.newPage();let networkLoads=0,storyRequests=0;
  networkDraft.on('framenavigated',frame=>{if(frame===networkDraft.mainFrame())networkLoads++});
  networkDraft.on('request',req=>{if(new URL(req.url()).pathname==='/api/story-link')storyRequests++});
  await networkDraft.goto(base);await networkDraft.waitForFunction(()=>document.getElementById('stat-today')?.textContent==='0');
  await networkDraft.route('**/api/story-link',route=>route.fulfill({status:403,contentType:'text/html',body:'Denied by private gateway'}));
  await networkDraft.locator('#nav-stories').click();await networkDraft.locator('#tracked-links button').click();
  await networkDraft.waitForFunction(()=>document.getElementById('story-status').textContent.includes('Accès refusé'));
  assert.match(await networkDraft.locator('#story-status').textContent(),/Accès refusé/);
  await networkDraft.locator('#story-media').setInputFiles({name:'network-photo.png',mimeType:'image/png',buffer:image});
  await networkDraft.waitForFunction(()=>!document.getElementById('preview').hidden&&!document.getElementById('retry-link').hidden);
  const networkPhoto=await networkDraft.locator('#preview').getAttribute('src'),networkBefore=networkLoads;
  await networkDraft.unroute('**/api/story-link');
  let stalled;
  await networkDraft.route('**/api/story-link',route=>{stalled=route});
  await networkDraft.locator('#retry-link').click();
  await networkDraft.waitForFunction(()=>document.getElementById('story-status').textContent.includes('Reconnectez Pangolin'),{},{timeout:16000});
  assert.equal(await networkDraft.locator('#preview').getAttribute('src'),networkPhoto,'a stalled tunnel times out without losing media');
  if(stalled)await stalled.abort().catch(()=>{});
  await networkDraft.unroute('**/api/story-link');
  await context.setOffline(true);
  await networkDraft.locator('#retry-link').click();
  await networkDraft.waitForFunction(()=>document.getElementById('story-status').textContent.includes('Reconnectez Pangolin'));
  await networkDraft.locator('#refresh').click();
  await networkDraft.waitForFunction(()=>document.getElementById('connection-status').textContent.includes('inaccessible'));
  assert.equal(await networkDraft.locator('#preview').getAttribute('src'),networkPhoto);
  assert.equal(await networkDraft.locator('#editor').isVisible(),true);
  assert.equal(await other.locator('#video-preview').getAttribute('src'),video);
  assert.equal(otherLoads,videoLoads);assert.equal(networkLoads,networkBefore);
  assert.equal(await networkDraft.locator('#preview').evaluate(img=>img.complete&&img.naturalWidth===1080),true);
  const requestsBeforeReconnect=storyRequests;
  await context.setOffline(false);
  // Reconnection may check a worker, but must not automatically repeat a POST.
  await networkDraft.waitForFunction(()=>navigator.onLine);
  assert.equal(storyRequests,requestsBeforeReconnect);
  await networkDraft.locator('#retry-link').click();
  await networkDraft.waitForFunction(()=>!!document.getElementById('story-link').value);
  assert.equal(await networkDraft.locator('#preview').getAttribute('src'),networkPhoto);
  await networkDraft.locator('#copy').click();await networkDraft.locator('#share').click();
  assert.equal(await networkDraft.evaluate(async()=>window.__lastSharedFiles[0].type==='image/jpeg'&&(await window.__lastSharedFiles[0].arrayBuffer()).byteLength>0),true);
  await other.locator('#copy').click();await other.locator('#share').click();
  assert.equal(await other.evaluate(async()=>new TextDecoder().decode(await window.__lastSharedFiles[0].arrayBuffer())),'video-sharing-contract');
  await networkDraft.locator('#refresh').click();
  await networkDraft.waitForFunction(()=>document.getElementById('connection-status').textContent==='Synchronisé avec LinKs');
  assert.equal(await networkDraft.locator('#preview').getAttribute('src'),networkPhoto);
  assert.equal(networkLoads,networkBefore);assert.equal(otherLoads,videoLoads);
  await networkDraft.close();

  // A link form is also a private draft, protected across another tab's real activation.
  const linkDraft=await context.newPage(),clean=await context.newPage();let linkLoads=0;
  linkDraft.on('framenavigated',frame=>{if(frame===linkDraft.mainFrame())linkLoads++});
  await linkDraft.goto(base);await clean.goto(base);
  await linkDraft.locator('#nav-links').click();await linkDraft.locator('#link-new').click();
  await linkDraft.locator('#link-name').fill('Saisie à conserver pendant une mise à jour');
  const linkBefore=linkLoads;
  build=5;await update(clean);await linkDraft.waitForFunction(()=>!document.getElementById('update-notice').hidden);
  assert.equal(await linkDraft.locator('#update-apply').isDisabled(),true);
  await Promise.all([clean.waitForEvent('framenavigated',frame=>frame===clean.mainFrame()),clean.locator('#update-apply').click()]);
  await linkDraft.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()).waiting);
  assert.equal(linkLoads,linkBefore);assert.equal(await linkDraft.locator('#link-name').inputValue(),'Saisie à conserver pendant une mise à jour');
  assert.equal(await linkDraft.locator('#update-apply').isDisabled(),true);
  linkDraft.once('dialog',dialog=>dialog.dismiss());await linkDraft.locator('#link-close').click();
  assert.equal(await linkDraft.locator('#link-form').isVisible(),true,'cancel discard retains draft');
  linkDraft.once('dialog',dialog=>dialog.accept());await linkDraft.locator('#link-close').click();
  assert.equal(await linkDraft.locator('#update-apply').isEnabled(),true);
  await Promise.all([linkDraft.waitForEvent('framenavigated',frame=>frame===linkDraft.mainFrame()),linkDraft.locator('#update-apply').click()]);
  assert.equal(linkLoads,linkBefore+1);
  await linkDraft.locator('#nav-links').click();await linkDraft.locator('.managed-link').getByRole('button',{name:'Partager',exact:true}).click();await linkDraft.locator('#link-source').selectOption('discord');await linkDraft.locator('#link-generate').click();await linkDraft.waitForFunction(()=>!!document.getElementById('link-short').value);
  await linkDraft.locator('#publication-text').fill('Texte privé à conserver');const publicationLoads=linkLoads;
  build=6;await update(clean);await linkDraft.waitForFunction(()=>!document.getElementById('update-notice').hidden);assert.equal(await linkDraft.locator('#update-apply').isDisabled(),true);
  await Promise.all([clean.waitForEvent('framenavigated',frame=>frame===clean.mainFrame()),clean.locator('#update-apply').click()]);
  await linkDraft.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()).waiting);
  assert.equal(linkLoads,publicationLoads);assert.equal(await linkDraft.locator('#publication-text').inputValue(),'Texte privé à conserver');assert.equal(await linkDraft.locator('#update-apply').isDisabled(),true);
  await linkDraft.locator('#publication-copy').click();await linkDraft.locator('#publication-confirm-check').check();await linkDraft.locator('#publication-confirm').click();assert.equal(await linkDraft.locator('#update-apply').isEnabled(),true);
  await linkDraft.close();await clean.close();

  // Real offline navigation and exclusion of all private or query-bearing requests.
  const offline=await context.newPage();await offline.goto(base);await offline.waitForFunction(()=>document.getElementById('stat-today')?.textContent==='0');
  await offline.evaluate(async()=>{await Promise.all(['/api/catalog','/api/stats','/api/visual?id=test','/app.js','/style.css','/brand-pulse.png','/manifest.webmanifest?private=1'].map(url=>fetch(url).catch(()=>{})))});
  const cacheState=await offline.evaluate(async()=>{
   const keys=await caches.keys(),assets=[];
   for(const key of keys.filter(key=>key.startsWith('pulse-')))for(const req of await(await caches.open(key)).keys())assets.push(new URL(req.url).pathname);
   return {keys,assets,local:localStorage.length,databases:(await indexedDB.databases()).length};
  });
  assert.deepEqual(cacheState.keys.sort(),['another-app','pulse-public-pwa3-test-6']);
  assert.deepEqual(cacheState.assets.sort(),['/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/icon-maskable-192.png','/icon-maskable-512.png','/offline.html','/offline.css'].sort());
  assert.equal(cacheState.local,0);assert.equal(cacheState.databases,0);
  await context.setOffline(true);await offline.reload();
  assert.equal(await offline.locator('h1').textContent(),'Connexion indisponible');
  assert.equal(await offline.locator('body').evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(7, 12, 20)');
  assert.equal(await offline.locator('img').evaluate(img=>img.complete&&img.naturalWidth===512),true);
  const unavailable=await offline.evaluate(async()=>{
   const result=[];for(const path of ['/api/stats','/app.js','/icon-192.png?private=1']){try{await fetch(path);result.push(false)}catch{result.push(true)}}return result;
  });assert.deepEqual(unavailable,[true,true,true]);
  await context.setOffline(false);
  console.log('PASS PWA: maskable safe circle, waiting update, failed installation rollback, explicit reload, image/video drafts across tabs and activation race, denied access and offline/reconnection draft preservation, cache cleanup, private cache exclusion, styled offline fallback. No physical Samsung validation.');
 }finally{if(context)await context.close();await new Promise(r=>server.close(r))}
};
