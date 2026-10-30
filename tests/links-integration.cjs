// Real browser -> PulSe HTTP -> LinKs HTTP -> shared engine -> disposable SQLite.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {mkdtemp,mkdir,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {resolve,join}=require('node:path');
const {createInterface}=require('node:readline');
const {chromium}=require('playwright');
(async()=>{
 const repo=process.env.LINKS_REPO;if(!repo)throw Error('LINKS_REPO must point to the real LinKs checkout. No mocked fallback.');
 const python=process.env.PYTHON_PATH||'python3',temp=await mkdtemp(join(tmpdir(),'pulse-links-'));
 const secret='integration-bridge-secret-'.repeat(3),password='integration-basic-password';
 const child=spawn(python,[resolve(__dirname,'links-fixture.py'),resolve(repo),temp],{windowsHide:true,env:{...process.env,PULSE_BRIDGE_TOKEN:secret},stdio:['pipe','pipe','pipe']});
 let logs='',context,pulse;child.stderr.on('data',b=>logs+=b);const exit=new Promise(r=>child.once('exit',r));
 try{
  const fixture=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('LinKs fixture startup timeout: '+logs)),20000);
   child.once('error',reject);child.once('exit',()=>{clearTimeout(timer);reject(Error('LinKs exited: '+logs))});
   createInterface({input:child.stdout}).on('line',line=>{try{const value=JSON.parse(line);if(value.bridge){clearTimeout(timer);resolve(value)}}catch{}});
  });
  const {createPulseServer}=await import('../serve.mjs');
  pulse=createPulseServer({user:'admin',password,bridgeToken:secret,linksURL:fixture.public,bridgeURL:fixture.bridge});
  await new Promise(r=>pulse.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+pulse.address().port;
  const api=async(action,body)=>{const r=await fetch(base+'/api/'+action,{method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from('admin:'+password).toString('base64'),'Content-Type':'application/json','X-PulSe-Request':'1'},body:body?JSON.stringify(body):undefined});const text=await r.text();assert.ok(!text.includes(secret));return {status:r.status,data:JSON.parse(text)}};
  for(const [path,method] of [['/api/link-manager','GET'],['/api/link-preview','POST'],['/api/link-save','POST'],['/api/link-token','POST'],['/link-manager.js','GET']])assert.equal((await fetch(base+path,{method})).status,401);
  const csrf=await fetch(base+'/api/link-save',{method:'POST',headers:{Authorization:'Basic '+Buffer.from('admin:'+password).toString('base64'),'Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
  const initial=(await api('link-manager')).data;
  const source=platform=>initial.sources.find(s=>s.platform===platform).id;
  // Count a genuine pre-existing visit, then verify all management operations preserve it.
  assert.equal((await fetch(fixture.short,{redirect:'manual'})).status,302);
  const statsBefore=(await api('stats')).data;assert.ok(statsBefore.total>0);
  context=await chromium.launchPersistentContext(join(temp,'chrome'),{headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),httpCredentials:{username:'admin',password},viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:value=>window.denyClipboard?Promise.reject(Error('denied')):Promise.resolve(window.copiedLink=value)}}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
  page.on('request',req=>assert.ok(!JSON.stringify(req.headers()).includes(secret),'Bearer must never reach the browser'));
  await page.goto(base);await page.locator('#nav-links').click();await page.waitForFunction(()=>!document.getElementById('link-new').disabled);
  assert.match(await page.locator('#managed-links').textContent(),/Lien historique/);
  const preview=async url=>page.waitForFunction(url=>!document.getElementById('link-preview-panel').hidden&&document.getElementById('link-final').textContent===url,url);
  const newForm=async(name,url)=>{await page.locator('#link-new').click();await page.locator('#link-name').fill(name);await page.locator('#link-url').fill(url)};
  const origin='https://www.domadoo.fr/mobile',final=origin+'?domid=117';
  await newForm('Caméra mobile',origin);await preview(final);
  assert.match(await page.locator('#link-detected').textContent(),/Domadoo/);
  await page.locator('#link-partner').selectOption('');await preview(origin);
  await page.locator('#link-partner').selectOption(initial.partners.find(p=>p.name==='Reolink').id);await preview(origin+'?aff=1404');
  await page.locator('#link-partner').selectOption('auto');await preview(final);
  assert.equal(await page.locator('#link-save').isDisabled(),true);await page.locator('#link-reviewed').check();
  for(const width of [320,390,480]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}
  await page.setViewportSize({width:390,height:844});
  if(process.env.PULSE_SCREENSHOT_DIR){await mkdir(process.env.PULSE_SCREENSHOT_DIR,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(process.env.PULSE_SCREENSHOT_DIR,'pulse-liens-apercu.png'),fullPage:true})}
  await page.locator('#link-save').click();await page.locator('#link-share-panel').waitFor({state:'visible'});
  let created=(await api('link-manager')).data.items.find(x=>x.name==='Caméra mobile');assert.equal(created.url,final);
  await page.locator('#link-source').selectOption(source('instagram'));await page.locator('#link-generate').click();await page.waitForFunction(()=>!!document.getElementById('link-short').value);
  const short=await page.locator('#link-short').inputValue();await page.locator('#link-generate').click();await page.waitForFunction(()=>!document.getElementById('link-generate').disabled);assert.equal(await page.locator('#link-short').inputValue(),short);
  await page.evaluate(()=>window.denyClipboard=true);await page.locator('#link-copy').click();await page.locator('#link-copy-manual').waitFor({state:'visible'});await page.locator('#link-copy-manual').click();assert.match(await page.locator('#link-share-status').textContent(),/manuelle confirmée/);
  await page.evaluate(()=>window.denyClipboard=false);await page.locator('#link-copy').click();await page.waitForFunction(()=>!!window.copiedLink);assert.equal(await page.evaluate(()=>window.copiedLink),short);
  await page.locator('#link-source').selectOption(source('discord'));assert.equal(await page.locator('#link-short').inputValue(),'');await page.locator('#link-generate').click();await page.waitForFunction(()=>!!document.getElementById('link-short').value);assert.notEqual(await page.locator('#link-short').inputValue(),short);
  await newForm('Doublon évité',origin);await preview(final);assert.equal(await page.locator('#link-save').isDisabled(),true);await page.locator('#link-duplicates button').click();await page.locator('#link-share-panel').waitFor({state:'visible'});assert.equal((await api('link-manager')).data.items.length,2);
  const card=()=>page.locator('.managed-link').filter({has:page.locator('strong',{hasText:'Caméra mobile'})});
  await card().getByRole('button',{name:'Modifier'}).click();await preview(final);await page.locator('#link-name').fill('Caméra renommée');await preview(final);assert.equal(await page.locator('#link-change-warning').isVisible(),false);await page.locator('#link-reviewed').check();await page.locator('#link-save').click();await page.locator('#link-share-panel').waitFor({state:'visible'});
  created=(await api('link-manager')).data.items.find(x=>x.id===created.id);
  await page.locator('.managed-link').filter({hasText:'Caméra renommée'}).getByRole('button',{name:'Modifier'}).click();await preview(final);
  await page.locator('#link-url').fill('https://www.domadoo.fr/changed');await preview('https://www.domadoo.fr/changed?domid=117');await page.locator('#link-reviewed').check();assert.equal(await page.locator('#link-save').isDisabled(),true);
  const review=await api('link-preview',{...created,url:'https://www.domadoo.fr/changed'});assert.equal((await api('link-save',review.data.receipt)).status,400);
  await page.locator('#link-destination-confirm').check();await page.locator('#link-save').click();await page.locator('#link-share-panel').waitFor({state:'visible'});
  const redirect=await fetch(short,{method:'HEAD',redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'https://www.domadoo.fr/changed?domid=117');
  assert.equal((await api('link-token',{id:created.id,source_id:source('instagram'),expected_url:'https://www.domadoo.fr/changed?domid=117'})).data.url,short);
  assert.equal((await api('link-token',{id:created.id,source_id:source('instagram'),expected_url:final})).status,409);
  // Lost response after a real committed create: retry cannot create a duplicate.
  await newForm('Réponse perdue','https://shop.example/lost');await preview('https://shop.example/lost');await page.locator('#link-reviewed').check();
  await page.route('**/api/link-save',async route=>{await route.fetch();await route.abort()});
  await page.locator('#link-save').click();await page.waitForFunction(()=>!document.getElementById('link-fields').disabled&&document.getElementById('link-form-status').textContent.includes('conservée'));
  assert.equal(await page.locator('#link-name').inputValue(),'Réponse perdue');await page.unroute('**/api/link-save');
  await page.locator('#link-save').click();await page.locator('#link-duplicates button').waitFor({state:'visible'});await page.locator('#link-duplicates button').click();await page.locator('#link-share-panel').waitFor({state:'visible'});assert.equal((await api('link-manager')).data.items.length,3);
  // No persistence and no replay on reconnect; navigation retains unsaved fields.
  await newForm('Saisie conservée','https://shop.example/offline');await preview('https://shop.example/offline');
  await context.setOffline(true);await page.locator('#link-verify').click();await page.waitForFunction(()=>document.getElementById('link-form-status').textContent.includes('conservée'));
  await page.locator('#nav-stats').click();await page.locator('#nav-links').click();assert.equal(await page.locator('#link-name').inputValue(),'Saisie conservée');assert.equal(await page.locator('#link-url').inputValue(),'https://shop.example/offline');
  await context.setOffline(false);await page.locator('#link-verify').click();await preview('https://shop.example/offline');
  assert.equal((await api('link-manager')).data.items.length,3);
  // Responses can arrive out of order; retain only the current field revision.
  let release,started;const pending=new Promise(r=>started=r);await page.route('**/api/link-preview',async route=>{const body=route.request().postDataJSON();if(body.url.endsWith('/slow')){const result=await route.fetch();await new Promise(r=>{release=r;started()});return route.fulfill({response:result})}return route.continue()});
  await page.locator('#link-url').fill('https://shop.example/slow');await pending;
  await page.locator('#link-url').fill('https://shop.example/newest');await preview('https://shop.example/newest');release();await page.unrouteAll({behavior:'wait'});assert.equal(await page.locator('#link-final').textContent(),'https://shop.example/newest');
  const statsAfter=(await api('stats')).data;delete statsBefore.updatedAt;delete statsAfter.updatedAt;
  assert.deepEqual(statsAfter,statsBefore,'creation/edit/copy preserve pre-existing clicks');
  const legacy=(await api('link-manager')).data.items.find(x=>x.id===fixture.legacy.id);assert.equal(legacy.notes,'Notes à conserver');assert.equal((await fetch(fixture.short,{method:'HEAD',redirect:'manual'})).headers.get('location'),fixture.legacy.url);
  const stored=await page.evaluate(async()=>({local:localStorage.length,dbs:(await indexedDB.databases()).length,paths:(await Promise.all((await caches.keys()).map(async k=>(await(await caches.open(k)).keys()).map(r=>new URL(r.url).pathname)))).flat()}));
  assert.equal(stored.local,0);assert.equal(stored.dbs,0);assert.ok(!stored.paths.some(p=>p.startsWith('/api/')||p==='/link-manager.js'));
  await page.locator('#link-close').click();if(process.env.PULSE_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.PULSE_SCREENSHOT_DIR,'pulse-liens-liste.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS REAL LinKs + PulSe + SQLite + Chromium: affiliation/manual/None, preview confirmation, create/edit, transaction duplicates and reuse, lost committed response, source tokens, legacy aliases/statistics, authentication, clipboard fallback, offline drafts, stale previews, mobile widths and no private cache. No physical Samsung test.');
 }finally{
  await context?.close();if(pulse)await new Promise(r=>pulse.close(r));
  child.stdin.end('\n');await Promise.race([exit,new Promise(r=>setTimeout(()=>{child.kill();r()},5000))]);
  await rm(temp,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1});
