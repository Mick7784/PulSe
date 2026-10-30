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
  if(path==='/api/pulse/story-link')return json({url:'https://links.example/test12345'});
  if(path==='/api/pulse/stats')return json({period:7,total:0,today:0,last7:0,stories:0,days:Array.from({length:7},(_,i)=>({date:'2026-10-'+(20+i),clicks:0}))});
  return new Response('{}',{status:404});
 }});
 const handler=pulse.listeners('request')[0];
 const server=http.createServer((req,res)=>{
  if(req.url==='/sw.js'){
   res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
   return res.end(build===0?legacySource:source.replace("const VERSION = 'pwa3-1';",`const VERSION = 'pwa3-test-${build}';`));
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
   Object.defineProperty(navigator,'share',{value:()=>Promise.resolve()});
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
  await other.locator('#update-apply').click();await other.waitForFunction(()=>!!navigator.serviceWorker.controller&&document.getElementById('stat-today')?.textContent==='0');
  await page.waitForFunction(()=>!document.getElementById('update-notice').hidden);
  assert.equal(loads,before,'another tab may not reload the draft');
  assert.equal(otherLoads,otherBefore+1,'one explicit confirmation, one reload');
  assert.equal(await page.locator('#preview').getAttribute('src'),draft);
  assert.equal(await page.locator('#story-link').inputValue(),link);
  assert.equal(await page.locator('#update-apply').isDisabled(),true);

  await page.locator('#copy').click();await page.locator('#download').click();
  await page.locator('#publication-check').check();await page.locator('#confirm-publication').click();
  assert.equal(await page.locator('#update-apply').isEnabled(),true);
  await page.locator('#update-apply').click();await page.waitForFunction(()=>document.getElementById('stat-today')?.textContent==='0'&&document.getElementById('editor').hidden);
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
  await page.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()).waiting&&document.getElementById('update-apply').disabled);
  assert.equal(loads,raceLoads,'a newly started preparation must survive activation');
  assert.equal(await page.locator('#editor').isVisible(),true);
  assert.equal(otherLoads,videoLoads,'a video in another tab must not be reloaded');
  assert.equal(await other.locator('#video-preview').getAttribute('src'),video);
  assert.equal(await other.locator('#update-apply').isDisabled(),true);

  // Real offline navigation and exclusion of all private or query-bearing requests.
  const offline=await context.newPage();await offline.goto(base);await offline.waitForFunction(()=>document.getElementById('stat-today')?.textContent==='0');
  await offline.evaluate(async()=>{await Promise.all(['/api/catalog','/api/stats','/api/visual?id=test','/app.js','/style.css','/brand-pulse.png','/manifest.webmanifest?private=1'].map(url=>fetch(url).catch(()=>{})))});
  const cacheState=await offline.evaluate(async()=>{
   const keys=await caches.keys(),assets=[];
   for(const key of keys.filter(key=>key.startsWith('pulse-')))for(const req of await(await caches.open(key)).keys())assets.push(new URL(req.url).pathname);
   return {keys,assets,local:localStorage.length,databases:(await indexedDB.databases()).length};
  });
  assert.deepEqual(cacheState.keys.sort(),['another-app','pulse-public-pwa3-test-4']);
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
  console.log('PASS PWA: maskable safe circle, waiting update, failed installation rollback, explicit reload, image/video drafts across tabs and activation race, cache cleanup, private cache exclusion, styled offline fallback. No physical Samsung validation.');
 }finally{if(context)await context.close();await new Promise(r=>server.close(r))}
};
