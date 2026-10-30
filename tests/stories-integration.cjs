// Phase 6 journey using the same real LinKs/PulSe/SQLite fixture as link management.
const assert=require('node:assert/strict');
const {readFile}=require('node:fs/promises');
const {join}=require('node:path');
module.exports=async function({page,context,api,fixture,control}){
 let accept=true;page.removeAllListeners('dialog');page.on('dialog',dialog=>accept?dialog.accept():dialog.dismiss());
 await page.evaluate(()=>{
  window.storyShares=[];window.cancelStoryShare=false;
  Object.defineProperty(navigator,'canShare',{value:()=>true});
  Object.defineProperty(navigator,'share',{value:data=>{window.storyShares.push({keys:Object.keys(data),files:data.files,active:navigator.userActivation.isActive});return window.cancelStoryShare?Promise.reject(new DOMException('cancelled','AbortError')):Promise.resolve()}});
 });
 const statsBefore=(await api('stats')).data;
 const cat=(await api('catalog?refresh=1')).data;
 assert.deepEqual(cat.campaigns.map(x=>x.id),['default','specific','featured','waiting','remote'].map(k=>fixture.campaigns[k]));
 assert.equal(cat.campaigns[0].image,fixture.default_image);assert.equal(cat.campaigns[1].image,fixture.specific_image);
 const publicConfig=await(await fetch(fixture.public+'/api/public-config')).json();assert.equal(publicConfig.visible_campaign_ids.length,3);assert.ok(!publicConfig.visible_campaign_ids.includes(fixture.campaigns.waiting));
 const ready=()=>page.waitForFunction(()=>!!document.getElementById('story-link').value&&!document.getElementById('preview').hidden&&!document.getElementById('copy').disabled);
 const preview=url=>page.waitForFunction(url=>!document.getElementById('link-preview-panel').hidden&&document.getElementById('link-final').textContent===url,url);
 const choose=async term=>{await page.locator('#campaign-search').fill(term);await page.locator('#campaigns .selection-button').click()};
 await page.locator('#link-close').click();await page.locator('#nav-stories').click();
 assert.equal(await page.locator('#offers-count').textContent(),'5');
 await choose('waiting');await ready();
 assert.equal(await page.locator('#editor-title').textContent(),'Campagne waiting');
 assert.deepEqual(await page.locator('#preview').evaluate(img=>[img.naturalWidth,img.naturalHeight]),[1080,1920]);
 // Both default and specific images travel through the real LinKs file handler/proxy.
 const center=()=>page.locator('#preview').evaluate(img=>{const c=document.createElement('canvas');c.width=1;c.height=1;const ctx=c.getContext('2d');ctx.drawImage(img,540,960,1,1,0,0,1,1);return [...ctx.getImageData(0,0,1,1).data]});
 assert.ok((await center())[0]>150);
 await choose('MOBILE10');await ready();assert.match(await page.locator('#campaign-details').textContent(),/Description campagne spécifique.*MOBILE10/);
 assert.ok((await center())[2]>150);
 const png=await readFile(join(__dirname,'../icon-192.png'));
 await page.locator('#story-media').setInputFiles({name:'personnelle.png',mimeType:'image/png',buffer:png});
 await page.waitForFunction(()=>document.getElementById('media-state').textContent==='Visuel prêt');
 const photo=await page.locator('#preview').getAttribute('src'),oldLink=await page.locator('#story-link').inputValue();
 await page.locator('#copy').click();await page.waitForFunction(()=>!document.getElementById('share').disabled);
 await page.locator('#story-media').setInputFiles({name:'corrompue.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
 await page.waitForFunction(()=>document.getElementById('story-status').textContent.includes('précédent est conservé'));
 assert.equal(await page.locator('#preview').getAttribute('src'),photo);assert.equal(await page.locator('#share').isEnabled(),true);
 accept=false;await choose('featured');accept=true;
 assert.equal(await page.locator('#preview').getAttribute('src'),photo);assert.equal(await page.locator('#story-link').inputValue(),oldLink);
 // Return/cancel and offline save retain both the Story and the new link form.
 await page.locator('#story-create-link').click();await page.locator('#link-story-context').waitFor({state:'visible'});await page.locator('#link-story-back').click();
 assert.equal(await page.locator('#preview').getAttribute('src'),photo);
 await page.locator('#story-create-link').click();await page.locator('#link-new').click();
 await page.locator('#link-name').fill('Lien de ma Story');await page.locator('#link-url').fill('https://shop.example/story-inline');await preview('https://shop.example/story-inline');await page.locator('#link-reviewed').check();
 await context.setOffline(true);await page.locator('#link-save').click();await page.waitForFunction(()=>document.getElementById('link-form-status').textContent.includes('conservée')&&!document.getElementById('link-fields').disabled);
 await page.locator('#link-story-back').click();assert.equal(await page.locator('#preview').getAttribute('src'),photo);assert.equal(await page.locator('#story-link').inputValue(),oldLink);
 await context.setOffline(false);await page.locator('#story-create-link').click();assert.equal(await page.locator('#link-name').inputValue(),'Lien de ma Story');
 await page.locator('#link-save').click();await page.waitForFunction(()=>!document.getElementById('stories-view').hidden&&document.getElementById('editor-title').textContent==='Lien de ma Story'&&!!document.getElementById('story-link').value);
 const newLink=await page.locator('#story-link').inputValue();assert.notEqual(newLink,oldLink);assert.equal(await page.locator('#preview').getAttribute('src'),photo);assert.equal(await page.locator('#share').isDisabled(),true);
 const manager=(await api('link-manager')).data,item=manager.items.find(x=>x.name==='Lien de ma Story'),instagram=manager.sources.find(x=>x.platform==='instagram');
 assert.equal((await api('link-token',{id:item.id,source_id:instagram.id,expected_url:item.url})).data.url,newLink);
 await page.locator('#story-create-link').click();await page.locator('#link-new').click();await page.locator('#link-name').fill('Réutilisation Story');await page.locator('#link-url').fill(item.url);await preview(item.url);
 await page.locator('#link-duplicates button').click();await page.waitForFunction(()=>!document.getElementById('stories-view').hidden&&!!document.getElementById('story-link').value);
 assert.equal(await page.locator('#story-link').inputValue(),newLink);assert.equal(await page.locator('#preview').getAttribute('src'),photo);assert.equal((await api('link-manager')).data.items.length,manager.items.length);
 // Clipboard and native-share boundaries are controlled contracts, not real Instagram.
 await page.evaluate(()=>window.denyClipboard=true);await page.locator('#copy').click();await page.locator('#manual-copy').waitFor({state:'visible'});await page.locator('#manual-copy').click();
 await page.evaluate(()=>window.cancelStoryShare=true);await page.locator('#share').click();await page.waitForFunction(()=>document.getElementById('story-status').textContent.includes('annulé'));
 assert.equal(await page.locator('#publication-check').isDisabled(),true);assert.equal(await page.locator('#preview').getAttribute('src'),photo);
 await page.evaluate(()=>window.cancelStoryShare=false);await page.locator('#share').click();await page.waitForFunction(()=>!document.getElementById('publication-check').disabled);
 assert.equal(await page.evaluate(()=>storyShares.at(-1).active),true);assert.deepEqual(await page.evaluate(()=>storyShares.at(-1).keys),['files']);
 assert.equal(await page.evaluate(async()=>storyShares.at(-1).files[0].type==='image/jpeg'&&(await storyShares.at(-1).files[0].arrayBuffer()).byteLength>0),true);
 await page.locator('#publication-check').check();await page.locator('#confirm-publication').click();assert.match(await page.locator('#publication-receipt').textContent(),/déclarée par vous/);
 await page.locator('#story-media').setInputFiles({name:'video.mp4',mimeType:'video/mp4',buffer:Buffer.from('original-video-contract')});await page.waitForFunction(()=>!document.getElementById('video-preview').hidden);
 const video=await page.locator('#video-preview').getAttribute('src');
 await page.locator('#story-create-link').click();await page.locator('.managed-link').filter({hasText:'Lien historique'}).getByRole('button',{name:'Choisir pour ma Story'}).click();
 await page.waitForFunction(()=>!document.getElementById('stories-view').hidden&&!!document.getElementById('story-link').value);assert.equal(await page.locator('#video-preview').getAttribute('src'),video);
 await page.evaluate(()=>window.denyClipboard=false);await page.locator('#copy').click();await page.locator('#share').click();await page.waitForFunction(()=>!document.getElementById('publication-check').disabled);
 assert.equal(await page.evaluate(async()=>new TextDecoder().decode(await storyShares.at(-1).files[0].arrayBuffer())),'original-video-contract');
 // A campaign withdrawn after selection is rejected by real fresh server data, media retained.
 await page.route('**/api/story-link',route=>route.abort());await choose('waiting');
 await page.waitForFunction(()=>!document.getElementById('preview').hidden&&!document.getElementById('retry-link').hidden);
 const waitingPhoto=await page.locator('#preview').getAttribute('src');await page.unroute('**/api/story-link');await control({disable:fixture.campaigns.waiting});
 await page.locator('#retry-link').click();await page.waitForFunction(()=>document.getElementById('story-status').textContent.includes('indisponible'));
 assert.equal(await page.locator('#preview').getAttribute('src'),waitingPhoto);assert.equal(await page.locator('#story-link').inputValue(),'');
 assert.equal((await api('story-link',{type:'campaign',id:fixture.campaigns.waiting})).status,404);
 for(const key of ['future','ended','disabled','draft','classic'])assert.equal((await api('story-link',{type:'campaign',id:fixture.campaigns[key]})).status,404);
 await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('offers-count').textContent==='4');
 assert.equal(await page.locator('#preview').getAttribute('src'),waitingPhoto);
 await choose('featured');await ready();assert.equal(await page.locator('#editor-title').textContent(),'Campagne featured');
 await page.locator('#campaign-search').fill('');
 for(const width of [320,390,480]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}
 await page.setViewportSize({width:390,height:844});
 if(process.env.PULSE_SCREENSHOT_DIR){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(process.env.PULSE_SCREENSHOT_DIR,'pulse-campagnes-story.png'),fullPage:true})}
 const statsAfter=(await api('stats')).data;delete statsBefore.updatedAt;delete statsAfter.updatedAt;assert.deepEqual(statsAfter,statsBefore);
 console.log('PASS REAL Phase 6: five eligible campaigns beyond three public slots, featured/default/custom visuals, excluded states, withdrawn source, exact Instagram token reuse, inline create/duplicate/return, offline drafts, atomic media replacement, cancel discard, preserved photo/video, native share contracts, unchanged clicks. No physical Instagram/Samsung validation.');
};
