const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const {readFile,mkdir,mkdtemp}=require('node:fs/promises');
const {resolve}=require('node:path');
const open=async s=>{await new Promise(r=>s.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+s.address().port};
const close=s=>new Promise(r=>s.close(r));
(async()=>{
 const {createPulseServer}=await import('../serve.mjs');
 const id='abcdefghijk',png=await readFile(resolve(__dirname,'../brand-pulse.png'));
 let failStats=false,failVideoLink=false;
 const fake=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');res.setHeader('Content-Type','application/json');
  const json=x=>res.end(JSON.stringify(x));
  if(u.pathname==='/api/public-config')return json({links:[{id:'offer',type:'promo',title:'Offre de test · capteur connecté',url:'https://partner.example/offer',image:'/uploads/test.png',description:'Cette description ne doit pas apparaître en ligne'}]});
  if(u.pathname==='/latest-video.json')return json({title:'Vidéo de test · une maison connectée plus simple',url:'https://youtu.be/'+id,thumbnail:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',published:'2026-10-01T12:00:00Z'});
  if(u.pathname==='/api/pulse/links')return json({links:Array.from({length:35},(_,i)=>({id:'link'+i,name:'Lien suivi '+i,url:'https://partner.example/'+i,enabled:true,archived:false}))});
  if(u.pathname==='/api/pulse/today'){if(failStats){res.statusCode=503;return json({})}return json({version:1,available:true,timezone:'Europe/Paris',date:'2026-10-30',yesterday_date:'2026-10-29',generated_at:'2026-10-30T12:00:00Z',scope:'all-clicks',comparison:'yesterday-full-day',analytics_enabled:true,today:6,yesterday:9,ranking_scope:'tracked-links',tracked_total:0,top_links:[],sources:[]})}
  if(u.pathname==='/api/pulse/stats'){if(failStats){res.statusCode=503;return json({})}const n=Number(u.searchParams.get('days')||7),days=Array.from({length:n},(_,i)=>({date:new Date(Date.UTC(2026,9,24-n+i)).toISOString().slice(0,10),clicks:i}));return json({period:n,total:days.reduce((s,d)=>s+d.clicks,0),today:n-1,last7:days.slice(-7).reduce((s,d)=>s+d.clicks,0),stories:3,days})}
  if(u.pathname==='/api/pulse/story-link'){if(failVideoLink){res.statusCode=400;return json({error:'Type PulSe invalide'})}return json({url:'https://links.example/a12345678'})}
  if(u.pathname==='/uploads/test.png'){res.setHeader('Content-Type','image/png');return res.end(png)}
  res.statusCode=404;json({});
 });
 const upstream=await open(fake),pulse=createPulseServer({linksURL:upstream,bridgeToken:'s'.repeat(64),user:'admin',password:'long-password-123',fetcher:(url,opts)=>new URL(url).hostname==='i.ytimg.com'?Promise.resolve(new Response(png,{headers:{'Content-Type':'image/png'}})):fetch(url,opts)}),base=await open(pulse);
 let browser;const errors=[];
 try{
  // A real profile permits installation checks; recent Chrome rejects incognito installation.
  const profile=await mkdtemp(resolve(__dirname,'../../pulse-browser-profile-'));
  const context=await chromium.launchPersistentContext(profile,{headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),httpCredentials:{username:'admin',password:'long-password-123'},viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  browser=context;
  await context.addInitScript(()=>{
   // Keep the real installability check, but exercise prompt responses with controlled events.
   window.addEventListener('beforeinstallprompt',event=>{if(event.isTrusted){event.preventDefault();event.stopImmediatePropagation()}});
   window.__shareCalls=[];window.__clipboard=[];window.__rejectCopy=false;window.__cancelShare=false;
   Object.defineProperty(navigator,'canShare',{value:data=>Array.isArray(data.files)&&data.files.length===1});
   Object.defineProperty(navigator,'share',{value:data=>{window.__shareCalls.push({type:data.files[0].type,size:data.files[0].size,keys:Object.keys(data),active:navigator.userActivation.isActive});return window.__cancelShare?Promise.reject(new DOMException('cancelled','AbortError')):Promise.resolve()}});
   Object.defineProperty(navigator,'clipboard',{value:{writeText:value=>{window.__clipboard.push(value);return window.__rejectCopy?Promise.reject(Error('denied')):Promise.resolve()}}});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
  await mkdir(process.env.PULSE_SCREENSHOT_DIR||resolve(__dirname,'../../screenshots'),{recursive:true});
  await page.goto(base);await page.waitForFunction(()=>document.getElementById('stat-today').textContent==='6');
  assert.equal(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);return ids.length===new Set(ids).size}),true,'unique IDs keep Story and text controls independent');
  await page.waitForFunction(()=>document.querySelector('.video-date')?.textContent.includes('2026'));
  // Real Chromium manifest/installability API: do not simulate beforeinstallprompt here.
  await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.active);
  const cdp=await context.newCDPSession(page);
  const manifestState=await cdp.send('Page.getAppManifest');
  assert.equal(manifestState.errors.length,0,'Chromium rejected PulSe manifest: '+JSON.stringify(manifestState.errors));
  const appManifest=JSON.parse(manifestState.data);
  assert.equal(appManifest.display,'standalone');
  assert.equal(appManifest.start_url,'/');
  assert.deepEqual(appManifest.icons.map(icon=>[icon.sizes,icon.purpose]),[['192x192','any'],['512x512','any'],['192x192','maskable'],['512x512','maskable']]);
  const installability=await cdp.send('Page.getInstallabilityErrors');
  assert.deepEqual(installability.installabilityErrors,[],'Chromium PWA installation errors');
  await cdp.detach();
  assert.equal(await page.locator('header .brand').getAttribute('alt'),'PulSe by DomotiK Studio');
  assert.equal(await page.locator('header .brand').evaluate(img=>img.complete&&img.naturalWidth===600&&img.naturalHeight===205),true);
  assert.equal(await page.locator('#nav-stats').getAttribute('aria-current'),'page');
  assert.equal(await page.locator('#story-panel').isVisible(),false);assert.equal(await page.locator('#stat-today').isVisible(),true);
  assert.equal(await page.getByText('Photo personnelle',{exact:true}).count(),0);assert.equal(await page.getByText('Stories déclarées',{exact:true}).count(),0);
  assert.deepEqual(await page.locator('.bottom-nav button').allTextContents(),['Stories','Liens','Stats']);
  assert.equal(await page.locator('[data-period]').count(),0);
  assert.match(await page.locator('#today-comparison').textContent(),/9 hier, journée complète/);
  failStats=true;await page.getByRole('button',{name:'Actualiser les données'}).click();await page.waitForFunction(()=>document.getElementById('chart-caption').textContent.includes('ne répond pas'));
  assert.equal(await page.locator('#stat-today').textContent(),'—');assert.equal(await page.locator('.today-bar').count(),0);
  failStats=false;await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('stat-today').textContent==='6');
  const out=process.env.PULSE_SCREENSHOT_DIR||resolve(__dirname,'../../screenshots');await mkdir(out,{recursive:true});
  await page.screenshot({path:resolve(out,'pulse-mobile-dashboard.png'),fullPage:true});
  await page.locator('#nav-stories').click();assert.equal(await page.locator('#tracked-links button').count(),35);
  assert.equal(await page.locator('#nav-stories').getAttribute('aria-current'),'page');
  assert.equal(await page.locator('#stats-view').isVisible(),false);
  assert.equal(await page.locator('#campaigns small').count(),0);assert.equal(await page.locator('#tracked-links .chain-icon').count(),35);
  await page.locator('#link-search').fill('Lien suivi 34');assert.equal(await page.locator('#tracked-links button').count(),1);
  await page.getByRole('button',{name:/Lien suivi 34/}).click();await page.waitForFunction(()=>document.getElementById('story-link').value==='https://links.example/a12345678');
  await page.locator('#story-media').setInputFiles({name:'phone.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>!document.getElementById('preview').hidden&&!document.getElementById('copy').disabled);assert.equal(await page.locator('#share').isDisabled(),true);
  assert.deepEqual(await page.locator('#preview').evaluate(img=>[img.naturalWidth,img.naturalHeight]),[1080,1920]);
  const draftBefore=await page.locator('#preview').getAttribute('src');
  await page.locator('#nav-stats').click();assert.equal(await page.locator('#draft-dot').isVisible(),true);
  await page.locator('#nav-stories').click();
  assert.equal(await page.locator('#preview').getAttribute('src'),draftBefore);
  assert.equal(await page.locator('#story-link').inputValue(),'https://links.example/a12345678');
  assert.equal(await page.locator('#editor-title').textContent(),'Lien suivi 34');
  await page.locator('#copy').click();await page.locator('#share').click();
  assert.deepEqual(await page.evaluate(()=>window.__shareCalls[0].keys),['files']);assert.equal(await page.evaluate(()=>window.__shareCalls[0].active),true);
  await page.evaluate(()=>window.__cancelShare=true);await page.locator('#share').click();await page.waitForFunction(()=>document.getElementById('story-status').textContent.includes('annulé'));
  assert.equal(await page.locator('#share').isEnabled(),true);await page.evaluate(()=>window.__rejectCopy=true);await page.locator('#copy').click();await page.waitForFunction(()=>document.getElementById('story-status').textContent.includes('appui long'));
  assert.equal(await page.locator('#story-link').evaluate(e=>e.selectionEnd-e.selectionStart),'https://links.example/a12345678'.length);
  await page.locator('#story-media').setInputFiles({name:'phone.mp4',mimeType:'video/mp4',buffer:Buffer.from('fake-video-for-sharing-contract')});await page.waitForFunction(()=>document.getElementById('media-name').textContent.includes('Vidéo originale'));
  await page.locator('#manual-copy').click();await page.evaluate(()=>window.__cancelShare=false);await page.locator('#share').click();assert.equal(await page.evaluate(()=>window.__shareCalls.at(-1).type),'video/mp4');
  await page.locator('#link-search').fill('');await page.locator('#latest-video button').click();await page.waitForFunction(()=>!document.getElementById('preview').hidden&&!document.getElementById('copy').disabled);
  assert.deepEqual(await page.locator('#preview').evaluate(img=>[img.naturalWidth,img.naturalHeight]),[1080,1920]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('#latest-video + #editor').count(),1);assert.equal(await page.locator('.publication-steps>li').count(),4);await page.locator('#link-search').fill('Lien suivi 34');await page.screenshot({path:resolve(out,'pulse-mobile-story.png'),fullPage:true});
  // Standalone detection and installation cancellation/acceptance use browser event contracts.
  await page.locator('#install').click();assert.equal(await page.locator('#install-help').isVisible(),true);
  await page.evaluate(()=>{const e=new Event('beforeinstallprompt');e.prompt=()=>Promise.resolve();e.userChoice=Promise.resolve({outcome:'dismissed'});dispatchEvent(e)});
  await page.locator('#install').click();assert.match(await page.locator('#install-help').textContent(),/annulée/);assert.equal(await page.locator('#install').isEnabled(),true);
  await page.evaluate(()=>dispatchEvent(new Event('appinstalled')));assert.equal(await page.locator('#install').isDisabled(),true);assert.equal(await page.locator('#install').textContent(),'App installée');
  // A legacy LinKs backend can display metadata but cannot create a YouTube Story link.
  failVideoLink=true;await page.locator('#latest-video button').click();await page.waitForFunction(()=>document.getElementById('story-status').textContent.includes('mise à jour')&&!document.getElementById('preview').hidden);
  assert.equal(await page.locator('#share').isDisabled(),true);assert.equal(await page.locator('#copy').isDisabled(),true);assert.equal(await page.locator('#retry-link').isVisible(),true);await page.locator('#download').click();assert.equal(await page.locator('#publication-check').isDisabled(),true);await page.screenshot({path:resolve(out,'pulse-video-bridge-missing.png'),fullPage:true});
  failVideoLink=false;await page.locator('#retry-link').click();await page.waitForFunction(()=>!document.getElementById('copy').disabled);assert.equal(await page.locator('#publication-check').isDisabled(),true);await page.locator('#latest-video button').click();await page.waitForFunction(()=>!document.getElementById('copy').disabled&&!document.getElementById('preview').hidden);
  await page.evaluate(()=>{window.__rejectCopy=false;window.__cancelShare=true});await page.locator('#copy').click();await page.locator('#share').click();await page.waitForFunction(()=>document.getElementById('story-status').textContent.includes('annulé'));
  assert.equal(await page.locator('#publication-check').isDisabled(),true);assert.equal(await page.locator('#confirm-publication').isDisabled(),true);
  await page.evaluate(()=>window.__cancelShare=false);await page.locator('#share').click();await page.waitForFunction(()=>!document.getElementById('publication-check').disabled);
  assert.equal(await page.locator('#confirm-publication').isDisabled(),true);assert.equal(await page.locator('#publication-receipt').textContent(),'');
  await page.locator('#publication-check').check();await page.locator('#confirm-publication').click();assert.match(await page.locator('#publication-receipt').textContent(),/déclarée par vous/);assert.equal(await page.locator('#stat-today').textContent(),'6');
  // Rapid selections may not let an earlier asynchronous image overwrite the new choice.
  await page.route('**/api/story-link',async route=>{const data=route.request().postDataJSON();if(data.type==='youtube')await new Promise(r=>setTimeout(r,200));await route.fulfill({json:{url:'https://links.example/'+(data.type==='youtube'?'video1234':'offer1234'),tracked:true}})});
  await page.locator('#latest-video button').click();assert.equal(await page.locator('#story-media').isEnabled(),true);await page.locator('#campaigns button').click();await page.waitForFunction(()=>document.getElementById('story-link').value.endsWith('offer1234')&&!document.getElementById('preview').hidden);await new Promise(r=>setTimeout(r,250));assert.match(await page.locator('#story-link').inputValue(),/offer1234$/);
  await page.locator('#latest-video button').click();await page.locator('#story-media').setInputFiles({name:'phone-before-link.mp4',mimeType:'video/mp4',buffer:Buffer.from('video-before-link')});await page.waitForFunction(()=>document.getElementById('story-link').value.endsWith('video1234')&&!document.getElementById('video-preview').hidden);assert.match(await page.locator('#media-name').textContent(),/Vidéo originale/);
  for(const width of [320,360,390,412,480]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Story width '+width);
   const searchSize=await page.locator('#link-search').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert.ok(searchSize>=16);
   await page.locator('#nav-stats').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Dashboard width '+width);
   await page.locator('#nav-stories').click();
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(out,'pulse-mobile-draft.png'),fullPage:true});
  await page.locator('#nav-stats').click();await page.screenshot({path:resolve(out,'pulse-mobile-dashboard-final.png'),fullPage:true});
  await page.goto(base);await page.waitForFunction(()=>document.getElementById('stat-today').textContent==='6');
  await page.screenshot({path:resolve(out,'pulse-ui-statistiques.png')});
  await page.locator('#nav-stories').click();await page.screenshot({path:resolve(out,'pulse-ui-stories.png')});
  // The worker must never cache private API data or media.
  await page.evaluate(()=>navigator.serviceWorker.ready);const cached=await page.evaluate(async()=>{const results=[];for(const key of await caches.keys()){for(const r of await(await caches.open(key)).keys())results.push(new URL(r.url).pathname)}return results});assert.ok(cached.length>0);assert.equal(cached.some(p=>p.startsWith('/api/')),false);
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS: publication steps, legacy bridge diagnostic/retry, explicit manual confirmation, 15px mobile chart values, daily comparison, 1080x1920, photo/video and races, activation, cancellation, clipboard fallback, PWA and private cache exclusion. Fixtures only; no physical Samsung test.');
 }finally{if(browser)await browser.close();await close(pulse);await close(fake)}
})().then(()=>require('./pwa-browser.cjs')()).then(()=>require('./compact-browser.cjs')()).catch(e=>{console.error(e);process.exitCode=1});

