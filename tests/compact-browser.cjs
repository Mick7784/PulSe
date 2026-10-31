const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {mkdir}=require('node:fs/promises');const {resolve}=require('node:path');
module.exports=async()=>{
 const {createPulseServer}=await import('../serve.mjs');let rows=100,slow=false;
 const json=x=>new Response(JSON.stringify(x));
 const pulse=createPulseServer({linksURL:'http://links.test',bridgeToken:'s'.repeat(64),fetcher:async url=>{
  const path=new URL(url).pathname;
  if(path==='/api/public-config')return json({links:[]});if(path==='/latest-video.json')return json(null);if(path==='/api/pulse/links')return json({links:[]});
  if(path==='/api/pulse/today'){if(slow)await new Promise(r=>setTimeout(r,250));return json({version:1,available:true,timezone:'Europe/Paris',date:'2026-10-30',yesterday_date:'2026-10-29',generated_at:'2026-10-30T12:00:00Z',scope:'all-clicks',comparison:'yesterday-full-day',analytics_enabled:true,today:0,yesterday:0,ranking_scope:'tracked-links',tracked_total:0,top_links:[],sources:[]})}
  if(path==='/api/pulse/link-manager')return json({version:1,items:Array.from({length:rows},(_,i)=>({id:String(i),name:'Lien '+i+' · Écran & été <spécial> '+('très long '.repeat(14)),url:'https://example.test/target/'+i,original_url:'https://example.test/target/'+i,revision:'fixture'})),partners:[],sources:[]});
  return new Response('{}',{status:404});
 }});await new Promise(r=>pulse.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+pulse.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const out=process.env.PULSE_SCREENSHOT_DIR||resolve(__dirname,'../../screenshots');await mkdir(out,{recursive:true});
 try{for(const standalone of [false,true]){
  const context=await browser.newContext({isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
  if(standalone)await context.addInitScript(()=>{const original=window.matchMedia.bind(window);window.matchMedia=q=>q==='(display-mode: standalone)'?{matches:true,addEventListener(){},removeEventListener(){}}:original(q)});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForFunction(()=>document.getElementById('stat-today').textContent==='0');
  assert.equal(await page.locator('#install').isHidden(),standalone);
  const startsOnStories=async()=>{assert.equal(await page.locator('#nav-stories').getAttribute('aria-current'),'page');assert.equal(await page.locator('#stories-view').isVisible(),true);assert.equal(await page.locator('#stats-view').isHidden(),true);assert.equal(await page.title(),'PulSe — Stories');assert.equal(await page.locator('.skip-link').getAttribute('href'),'#view-stories-title')};
  await startsOnStories();
  await page.locator('#nav-links').click();await page.locator('#nav-stats').click();
  await page.goBack();assert.equal(await page.locator('#links-view').isVisible(),true);
  await page.goBack();await startsOnStories();
  await page.locator('#nav-stats').click();await page.reload();await startsOnStories();
  const reopened=await context.newPage();await reopened.goto(base);assert.equal(await reopened.locator('#stories-view').isVisible(),true);await reopened.close();
  for(const width of [320,360,390,412,480]){
   await page.setViewportSize({width,height:844});await page.locator('#nav-stats').click();await page.screenshot({path:resolve(out,`stats-${width}-${standalone?'pwa':'browser'}.png`)});
   await page.locator('#nav-links').click();await page.waitForFunction(()=>document.querySelectorAll('.managed-link').length===100);
   assert.equal(await page.locator('.managed-link p').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=visualViewport.width+1),true);
   const geometry=await page.locator('.managed-link').first().evaluate(el=>({height:el.getBoundingClientRect().height,actions:[...el.querySelectorAll('button')].map(b=>({label:b.getAttribute('aria-label'),w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})),title:getComputedStyle(el.querySelector('strong')).textOverflow}));
   assert.ok(geometry.height>=48&&geometry.height<=52);assert.equal(geometry.title,'ellipsis');assert.deepEqual(geometry.actions.map(x=>x.label),['Modifier','Partager']);assert.ok(geometry.actions.every(x=>x.w>=44&&x.h>=44));
   await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));assert.equal(Math.round((await page.locator('header').boundingBox()).y),0);
   await page.locator('.managed-link').last().getByRole('button',{name:'Modifier'}).focus();assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Modifier');
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(out,`links-${width}-${standalone?'pwa':'browser'}.png`)});
  }
  await page.locator('#nav-stats').click();await page.goBack();await page.locator('#links-view').waitFor({state:'visible'});
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=visualViewport.width+1),true);await page.evaluate(()=>document.documentElement.style.fontSize='');
  rows=0;await page.locator('#links-retry').click();await page.waitForFunction(()=>document.querySelectorAll('.managed-link').length===0);rows=1;await page.locator('#links-retry').click();await page.waitForFunction(()=>document.querySelectorAll('.managed-link').length===1);rows=100;await page.locator('#links-retry').click();await page.waitForFunction(()=>document.querySelectorAll('.managed-link').length===100);
  await page.locator('#manage-search').fill('/target/99');assert.equal(await page.locator('.managed-link').count(),1);await page.locator('#manage-search').fill('absent');assert.equal(await page.locator('.managed-link').count(),0);await page.locator('#manage-search').fill('');
  await page.locator('#link-new').click();await page.locator('#link-name').fill('Brouillon clavier');await page.setViewportSize({width:320,height:430});await page.locator('#link-url').focus();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=visualViewport.width+1),true);await page.screenshot({path:resolve(out,`keyboard-${standalone?'pwa':'browser'}.png`)});
  await page.locator('#nav-stats').click();await page.locator('#nav-links').click();assert.equal(await page.locator('#link-name').inputValue(),'Brouillon clavier');
  await page.locator('#nav-stories').click();await page.locator('#story-create-link').click();assert.equal(await page.getByRole('button',{name:'Choisir pour ma Story',exact:true}).count(),100);assert.equal(await page.getByRole('button',{name:'Partager',exact:true}).count(),0);
  await page.locator('#nav-stats').click();slow=true;await page.locator('#refresh').click();await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('stat-today').textContent==='0');assert.equal(await page.locator('.today-bar').count(),2);slow=false;
  assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close();await new Promise(r=>pulse.close(r))}
 console.log('PASS compact: 5 widths x browser/standalone simulation, 100 long/special links, icon targets/focus, fixed header, URL search, empty results, keyboard resize, draft preservation, Story selection, zero and concurrent refresh.');
};
