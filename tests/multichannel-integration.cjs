const assert=require('node:assert/strict');
const {join}=require('node:path');
module.exports=async function({page,context,api,fixture}){
 let accept=true;page.removeAllListeners('dialog');page.on('dialog',dialog=>accept?dialog.accept():dialog.dismiss());
 const manager=(await api('link-manager')).data,source=platform=>manager.sources.find(s=>s.platform===platform).id;
 const baseline=(await api('stats')).data;
 await page.evaluate(()=>{window.textShares=[];window.cancelTextShare=false;Object.defineProperty(navigator,'share',{configurable:true,value:data=>{window.textShares.push({data,active:navigator.userActivation.isActive});return window.cancelTextShare?Promise.reject(new DOMException('cancelled','AbortError')):Promise.resolve()}})});
 await page.locator('#nav-links').click();await page.locator('.managed-link').filter({hasText:'Lien historique'}).getByRole('button',{name:'Partager',exact:true}).click();
 const generate=async platform=>{await page.locator('#link-source').selectOption(source(platform));await page.locator('#link-generate').click();await page.waitForFunction(()=>!!document.getElementById('link-short').value);return page.locator('#link-short').inputValue()};
 const youtube=await generate('youtube');await page.locator('#publication-text').fill('Découvrez mon installation !');
 assert.equal(await page.locator('#link-form-dot').isVisible(),true,'text draft is indicated in the navigation');
 await page.locator('#nav-stats').click();assert.equal(await page.locator('#link-form-dot').isVisible(),true);await page.locator('#nav-links').click();
 assert.equal(await page.locator('#publication-output').inputValue(),'Découvrez mon installation !\n\n'+youtube);
 assert.match(await page.locator('#publication-hint').textContent(),/Shorts/);assert.equal(await page.locator('#publication-open').getAttribute('href'),'https://www.youtube.com/');
 await page.evaluate(()=>window.denyClipboard=true);await page.locator('#publication-copy').click();await page.locator('#publication-manual').waitFor({state:'visible'});await page.locator('#publication-manual').click();
 assert.equal(await page.locator('#publication-confirm-check').isEnabled(),true);
 const discord=await generate('discord');assert.notEqual(discord,youtube);assert.equal(await page.locator('#publication-text').inputValue(),'Découvrez mon installation !');assert.equal(await page.locator('#publication-confirm-check').isDisabled(),true);
 const complete='Découvrez mon installation !\n\n'+discord;assert.equal(await page.locator('#publication-output').inputValue(),complete);
 await page.evaluate(()=>window.denyClipboard=false);await page.locator('#publication-copy').click();await page.waitForFunction(()=>window.copiedLink===document.getElementById('publication-output').value);assert.equal(await page.evaluate(()=>window.copiedLink),complete);
 await page.locator('#publication-text').fill('Texte révisé');assert.equal(await page.locator('#publication-confirm-check').isDisabled(),true);
 await page.evaluate(()=>window.cancelTextShare=true);await page.locator('#publication-share').click();await page.waitForFunction(()=>document.getElementById('publication-status').textContent.includes('annulé'));
 assert.equal(await page.locator('#publication-confirm-check').isDisabled(),true);assert.equal(await page.locator('#publication-text').inputValue(),'Texte révisé');
 await page.evaluate(()=>window.cancelTextShare=false);await page.locator('#publication-share').click();await page.waitForFunction(()=>!document.getElementById('publication-confirm-check').disabled);
 assert.equal(await page.evaluate(()=>textShares.at(-1).active),true);assert.deepEqual(await page.evaluate(()=>Object.keys(textShares.at(-1).data)),['text']);assert.equal(await page.evaluate(()=>textShares.at(-1).data.text),'Texte révisé\n\n'+discord);
 await page.locator('#publication-confirm-check').check();await page.locator('#publication-confirm').click();assert.match(await page.locator('#text-publication-receipt').textContent(),/déclarée par vous/);
 assert.equal(await page.locator('#link-form-dot').isVisible(),false,'completed preparation clears its indicator');
 await page.locator('#publication-text').fill('x'.repeat(2000));assert.equal(await page.locator('#publication-copy').isDisabled(),true);assert.equal(await page.locator('#publication-share').isDisabled(),true);
 await page.locator('#publication-text').fill('Message conservé hors connexion');
 accept=false;await page.locator('#link-new').click();accept=true;assert.equal(await page.locator('#link-share-panel').isVisible(),true);
 await context.setOffline(true);await page.locator('#nav-stats').click();await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('insights-status').textContent.includes('indisponible'));
 assert.equal(await page.locator('#insights-content').isVisible(),false);await page.locator('#nav-links').click();assert.equal(await page.locator('#publication-text').inputValue(),'Message conservé hors connexion');
 await page.locator('#link-source').selectOption(source('youtube'));assert.equal(await page.locator('#publication-output').inputValue(),'');await page.locator('#link-generate').click();await page.waitForFunction(()=>document.getElementById('link-share-status').textContent.includes('conservée'));assert.equal(await page.locator('#publication-text').inputValue(),'Message conservé hors connexion');
 await context.setOffline(false);await page.locator('#link-generate').click();await page.waitForFunction(()=>!!document.getElementById('link-short').value);assert.equal(await page.locator('#link-short').inputValue(),youtube);
 const unchanged=(await api('stats')).data;delete unchanged.updatedAt;delete baseline.updatedAt;assert.deepEqual(unchanged,baseline,'preparation/share declarations never count clicks');
 // Real redirects create the measured visits; this is not an invented stats response.
 for(const url of [youtube,discord,discord])assert.equal((await fetch(url,{redirect:'manual'})).status,302);
 const insights=(await api('insights?days=7')).data;assert.equal(insights.available,true);assert.equal(insights.activeCampaigns,4);
 assert.equal(insights.topLinks[0].id,fixture.legacy.id);assert.equal(insights.topLinks[0].clicks,4);assert.equal(insights.sources.find(x=>x.platform==='discord').clicks,2);assert.equal(insights.sources.find(x=>x.platform==='youtube').clicks,1);
 await page.locator('#nav-stats').click();await page.locator('#refresh').click();await page.waitForFunction(()=>!document.getElementById('insights-content').hidden);assert.match(await page.locator('#insights-summary').textContent(),/4 clics/);
 const today=(await api('today')).data;assert.equal(today.available,true);assert.equal(today.trackedTotal,4);assert.equal(today.topLinks[0].clicks,4);assert.ok(today.today>=today.trackedTotal);
 await page.route('**/api/today',route=>route.abort());await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('insights-status').textContent.includes('indisponible'));assert.equal(await page.locator('#insights-content').isVisible(),false);await page.unroute('**/api/today');
 await page.locator('#refresh').click();await page.waitForFunction(()=>!document.getElementById('insights-content').hidden);
 // Explicitly accept replacement of a text draft when using a dashboard shortcut.
 await page.locator('#insights-content summary').click();await page.locator('#insights-links button').first().click();await page.locator('#link-share-panel').waitFor({state:'visible'});assert.equal(await page.locator('#link-share-title').textContent(),'Lien historique');
 await generate('discord');await page.locator('#publication-text').fill('À découvrir sur Discord');
 for(const width of [320,390,480]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}
 await page.setViewportSize({width:390,height:844});
 if(process.env.PULSE_SCREENSHOT_DIR){await page.locator('#publication-kit').scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.PULSE_SCREENSHOT_DIR,'pulse-discord-preparation.png')});await page.locator('#nav-stats').click();await page.locator('#insights-content').scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.PULSE_SCREENSHOT_DIR,'pulse-insights.png')})}
 const stored=await page.evaluate(async()=>({local:localStorage.length,dbs:(await indexedDB.databases()).length,paths:(await Promise.all((await caches.keys()).map(async k=>(await(await caches.open(k)).keys()).map(r=>new URL(r.url).pathname)))).flat()}));
 assert.equal(stored.local,0);assert.equal(stored.dbs,0);assert.ok(!stored.paths.some(p=>p.startsWith('/api/')||p==='/publication.js'));
 console.log('PASS REAL Phase 7: YouTube/Discord source tokens, editable text, native share activation/cancellation, clipboard fallback, explicit declaration, offline drafts, length checks, actual clicks and 7/30 insights, unavailable data and private cache. No real publication or physical Samsung test.');
};
