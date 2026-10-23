const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const {readFile,mkdir}=require('node:fs/promises');
const {resolve}=require('node:path');
const open=async s=>{await new Promise(r=>s.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+s.address().port};
const close=s=>new Promise(r=>s.close(r));
(async()=>{
 const {createPulseServer}=await import('../serve.mjs');
 const id='abcdefghijk',png=await readFile(resolve(__dirname,'../icon-192.png'));
 let failStats=false;
 const fake=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');res.setHeader('Content-Type','application/json');
  const json=x=>res.end(JSON.stringify(x));
  if(u.pathname==='/api/public-config')return json({links:[{id:'offer',type:'promo',title:'Offre de test · capteur connecté',url:'https://partner.example/offer',image:'/uploads/test.png',description:'Cette description ne doit pas apparaître en ligne'}]});
  if(u.pathname==='/latest-video.json')return json({title:'Vidéo de test · une maison connectée plus simple',url:'https://youtu.be/'+id,thumbnail:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg'});
  if(u.pathname==='/api/pulse/links')return json({links:Array.from({length:35},(_,i)=>({id:'link'+i,name:'Lien suivi '+i,category:i===34?'Éclairage':'Domotique',url:'https://partner.example/'+i,enabled:true,archived:false}))});
  if(u.pathname==='/api/pulse/stats'){if(failStats){res.statusCode=503;return json({})}const n=Number(u.searchParams.get('days')||7),days=Array.from({length:n},(_,i)=>({date:new Date(Date.UTC(2026,9,24-n+i)).toISOString().slice(0,10),clicks:i}));return json({period:n,total:days.reduce((s,d)=>s+d.clicks,0),today:n-1,last7:days.slice(-7).reduce((s,d)=>s+d.clicks,0),stories:3,days})}
  if(u.pathname==='/api/pulse/story-link')return json({url:'https://links.example/a12345678'});
  if(u.pathname==='/uploads/test.png'){res.setHeader('Content-Type','image/png');return res.end(png)}
  res.statusCode=404;json({});
 });
 const upstream=await open(fake),pulse=createPulseServer({linksURL:upstream,bridgeToken:'s'.repeat(64),user:'admin',password:'long-password-123',fetcher:(url,opts)=>new URL(url).hostname==='i.ytimg.com'?Promise.resolve(new Response(png,{headers:{'Content-Type':'image/png'}})):fetch(url,opts)}),base=await open(pulse);
 let browser;const errors=[];
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const context=await browser.newContext({httpCredentials:{username:'admin',password:'long-password-123'},viewport:{width:390,height:844}});
  await context.addInitScript(()=>{
   window.__shareCalls=[];window.__clipboard=[];window.__rejectCopy=false;window.__cancelShare=false;
   Object.defineProperty(navigator,'canShare',{value:data=>Array.isArray(data.files)&&data.files.length===1});
   Object.defineProperty(navigator,'share',{value:data=>{window.__shareCalls.push({type:data.files[0].type,size:data.files[0].size,keys:Object.keys(data),active:navigator.userActivation.isActive});return window.__cancelShare?Promise.reject(new DOMException('cancelled','AbortError')):Promise.resolve()}});
   Object.defineProperty(navigator,'clipboard',{value:{writeText:value=>{window.__clipboard.push(value);return window.__rejectCopy?Promise.reject(Error('denied')):Promise.resolve()}}});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>document.getElementById('stat-today').textContent==='6');
  assert.equal(await page.locator('header h1').textContent(),'PulSe');assert.equal(await page.locator('header img,header svg,.pill').count(),0);
  assert.equal(await page.locator('#story-panel').isVisible(),false);assert.equal(await page.locator('#stat-today').isVisible(),true);
  assert.equal(await page.getByText('Photo personnelle',{exact:true}).count(),0);assert.equal(await page.getByText('Stories déclarées',{exact:true}).count(),0);
  await page.getByRole('button',{name:'30 jours',exact:true}).click();await page.waitForFunction(()=>document.getElementById('stat-today').textContent==='29');
  assert.equal(await page.locator('#stat-period').textContent(),'435');assert.equal(await page.locator('#daily-values tr').count(),30);assert.equal(await page.locator('#chart rect.bar').count(),30);
  failStats=true;await page.getByRole('button',{name:'Actualiser les données'}).click();await page.waitForFunction(()=>document.getElementById('chart-caption').textContent.includes('ne répond pas'));
  assert.equal(await page.locator('#stat-today').textContent(),'—');assert.equal(await page.locator('#chart rect').count(),0);
  failStats=false;await page.getByRole('button',{name:'7 jours',exact:true}).click();await page.waitForFunction(()=>document.getElementById('stat-today').textContent==='6');
  const out=process.env.PULSE_SCREENSHOT_DIR||resolve(__dirname,'../../screenshots');await mkdir(out,{recursive:true});
  await page.screenshot({path:resolve(out,'pulse-mobile-dashboard.png'),fullPage:true});
  await page.getByRole('button',{name:'Préparer une Story',exact:true}).click();assert.equal(await page.locator('#tracked-links button').count(),35);
  assert.equal(await page.locator('#campaigns small').count(),0);assert.equal(await page.locator('#tracked-links .chain-icon').count(),35);
  await page.locator('#link-search').fill('Éclairage');assert.equal(await page.locator('#tracked-links button').count(),1);
  await page.getByRole('button',{name:/Lien suivi 34/}).click();await page.waitForFunction(()=>document.getElementById('story-link').value==='https://links.example/a12345678');
  await page.locator('#story-media').setInputFiles({name:'phone.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>!document.getElementById('share').disabled);
  assert.deepEqual(await page.locator('#preview').evaluate(img=>[img.naturalWidth,img.naturalHeight]),[1080,1920]);
  await page.locator('#copy').click();await page.locator('#share').click();
  assert.deepEqual(await page.evaluate(()=>window.__shareCalls[0].keys),['files']);assert.equal(await page.evaluate(()=>window.__shareCalls[0].active),true);
  await page.evaluate(()=>window.__cancelShare=true);await page.locator('#share').click();await page.waitForFunction(()=>document.getElementById('story-status').textContent.includes('annulé'));
  assert.equal(await page.locator('#share').isEnabled(),true);await page.evaluate(()=>window.__rejectCopy=true);await page.locator('#copy').click();await page.waitForFunction(()=>document.getElementById('story-status').textContent.includes('appui long'));
  assert.equal(await page.locator('#story-link').evaluate(e=>e.selectionEnd-e.selectionStart),'https://links.example/a12345678'.length);
  await page.locator('#story-media').setInputFiles({name:'phone.mp4',mimeType:'video/mp4',buffer:Buffer.from('fake-video-for-sharing-contract')});await page.waitForFunction(()=>document.getElementById('media-name').textContent.includes('Vidéo originale'));
  await page.evaluate(()=>window.__cancelShare=false);await page.locator('#share').click();assert.equal(await page.evaluate(()=>window.__shareCalls.at(-1).type),'video/mp4');
  await page.locator('#link-search').fill('');await page.locator('#latest-video button').click();await page.waitForFunction(()=>!document.getElementById('preview').hidden&&!document.getElementById('share').disabled);
  assert.deepEqual(await page.locator('#preview').evaluate(img=>[img.naturalWidth,img.naturalHeight]),[1080,1920]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('#latest-video + #editor').count(),1);await page.locator('#link-search').fill('Éclairage');await page.screenshot({path:resolve(out,'pulse-mobile-story.png'),fullPage:true});
  // Standalone detection and installation cancellation/acceptance use browser event contracts.
  await page.locator('#install').click();assert.equal(await page.locator('#install-help').isVisible(),true);
  await page.evaluate(()=>{const e=new Event('beforeinstallprompt');e.prompt=()=>Promise.resolve();e.userChoice=Promise.resolve({outcome:'dismissed'});dispatchEvent(e)});
  await page.locator('#install').click();assert.match(await page.locator('#install-help').textContent(),/annulée/);assert.equal(await page.locator('#install').isEnabled(),true);
  await page.evaluate(()=>dispatchEvent(new Event('appinstalled')));assert.equal(await page.locator('#install').isDisabled(),true);assert.equal(await page.locator('#install').textContent(),'App installée');
  // Rapid selections may not let an earlier asynchronous image overwrite the new choice.
  await page.route('**/api/story-link',async route=>{const data=route.request().postDataJSON();if(data.type==='youtube')await new Promise(r=>setTimeout(r,200));await route.fulfill({json:{url:'https://links.example/'+(data.type==='youtube'?'video1234':'offer1234'),tracked:true}})});
  await page.locator('#latest-video button').click();assert.equal(await page.locator('#story-media').isDisabled(),true);await page.locator('#campaigns button').click();await page.waitForFunction(()=>document.getElementById('story-link').value.endsWith('offer1234')&&!document.getElementById('share').disabled);await new Promise(r=>setTimeout(r,250));assert.match(await page.locator('#story-link').inputValue(),/offer1234$/);
  for(const width of [320,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}
  await page.screenshot({path:resolve(out,'pulse-desktop-story.png'),fullPage:true});
  await page.getByRole('button',{name:'Préparer une Story',exact:true}).click();await page.screenshot({path:resolve(out,'pulse-desktop-dashboard.png'),fullPage:true});
  // The worker must never cache private API data or media.
  await page.evaluate(()=>navigator.serviceWorker.ready);const cached=await page.evaluate(async()=>{const results=[];for(const key of await caches.keys()){for(const r of await(await caches.open(key)).keys())results.push(new URL(r.url).pathname)}return results});assert.ok(cached.length>0);assert.equal(cached.some(p=>p.startsWith('/api/')),false);
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS: mobile/desktop, catalogue, real-shaped 7/30 stats, unavailable state, 1080x1920, photo/video sharing contract, cancellation, copy fallback, installation events, races, private cache exclusion. Fixtures only; no physical Samsung test.');
 }finally{if(browser)await browser.close();await close(pulse);await close(fake)}
})().catch(e=>{console.error(e);process.exitCode=1});

