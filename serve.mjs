import http from 'node:http';
import https from 'node:https';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { httpURL, normalizeCatalog, normalizeTrackedLinks, normalizeStats, normalizeVideo, safeImageRef } from './catalog.mjs';

const ROOT = new URL('./', import.meta.url);
const STATIC = new Set(['index.html','app.js','pwa.mjs','style.css','brand-pulse.png','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','icon-maskable-192.png','icon-maskable-512.png','sw.js','offline.html','offline.css']);
// Public installation metadata only; application HTML, scripts and all APIs stay authenticated.
const PUBLIC_PWA = new Set(['/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/icon-maskable-192.png','/icon-maskable-512.png','/sw.js','/offline.html','/offline.css']);
const MIME = {html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png'};
const HEADERS = {
  'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
  'Permissions-Policy':'web-share=(self), clipboard-write=(self)',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
};
function sameSecret(a,b) {
  const left=Buffer.from(a||''),right=Buffer.from(b||'');
  return left.length===right.length&&timingSafeEqual(left,right);
}
function responseJson(res,code,body){const payload=Buffer.from(JSON.stringify(body));res.writeHead(code,{...HEADERS,'Content-Type':'application/json; charset=utf-8','Content-Length':payload.length});res.end(payload)}
async function readJson(req,max=4096){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>max)throw new Error('Corps de requête trop volumineux.')}return JSON.parse(raw||'{}')}
function fixedURL(base,path) {return new URL(path,base).href}
async function boundedBytes(response,limit){
 if(Number(response.headers.get('content-length')||0)>limit)throw Error('Réponse trop volumineuse.');
 const chunks=[];let size=0;const reader=response.body.getReader();
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('Réponse trop volumineuse.')}chunks.push(value)}}finally{reader.releaseLock()}
 return Buffer.concat(chunks,size);
}
export function createPulseServer({ user='',password='', linksURL='http://domotik-links:8080',bridgeToken='',bridgeURL='', cert,key,fetcher=fetch }={}) {
  if(Boolean(user)!==Boolean(password)||user.includes(':'))throw new Error('Identifiants invalides.');
  if(!httpURL(linksURL))throw new Error('LINKS_PUBLIC_URL doit être une URL HTTP(S) valide.');
  if(bridgeToken&&(!httpURL(bridgeURL||linksURL)))throw new Error('URL de passerelle invalide.');
  const linkBase=new URL(linksURL), privateBase=new URL(bridgeURL||linksURL);
  let catalogCache={value:null,until:0,promise:null};
  const authValue='Basic '+Buffer.from(user+':'+password).toString('base64');
  async function requestLinks(path,{method='GET',data,privateAccess=false}={}) {
    const destination=fixedURL(privateAccess?privateBase:linkBase,path);
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5500);
    try {
      const headers={Accept:'application/json'};
      if(privateAccess)headers.Authorization='Bearer '+bridgeToken;
      if(data)headers['Content-Type']='application/json';
      const r=await fetcher(destination,{method,headers,body:data?JSON.stringify(data):undefined,redirect:'error',signal:controller.signal,cache:'no-store'});
      if(!r.ok){
        const error=new Error('LinKs a répondu HTTP '+r.status);error.status=r.status;
        // Match only known public errors; never relay an upstream body or secret.
        try{const body=JSON.parse((await boundedBytes(r,8192)).toString('utf8'));
          error.unsupported=body.error==='Type PulSe invalide';
          error.changed=body.error==='La dernière vidéo a changé : actualisez PulSe';
        }catch{}
        throw error;
      }
      return JSON.parse((await boundedBytes(r,1024*1024)).toString('utf8'));
    }finally {clearTimeout(timeout)}
  }
  async function loadCatalog(force=false) {
    if(!force&&catalogCache.value&&catalogCache.until>Date.now())return catalogCache.value;
    if(catalogCache.promise)return catalogCache.promise;
    catalogCache.promise=(async()=>{
      const publicData=normalizeCatalog(await requestLinks('/api/public-config'));
      try{publicData.video=normalizeVideo(await requestLinks('/latest-video.json'));}
      catch{publicData.video=null;publicData.videoReason='Vidéo momentanément indisponible dans LinKs.';}
      if(bridgeToken){
        try {
          const extra=await requestLinks('/api/pulse/links',{privateAccess:true});
          publicData.trackedLinks=normalizeTrackedLinks(extra);
          publicData.trackedAvailable=true;
          publicData.source='links-bridge';
        }catch { /* Never display or silently replace tracked links with classic ones. */ }
      }
      catalogCache={value:publicData,until:Date.now()+20000,promise:null};return publicData;
    })();
    try{return await catalogCache.promise}finally{catalogCache.promise=null}
  }
  const handler=async (req,res)=>{
    let route;try{route=new URL(req.url,'http://localhost')}catch{return responseJson(res,400,{error:'Adresse invalide.'})}
    if(req.method==='GET'&&route.pathname==='/healthz')return responseJson(res,200,{status:'ok',version:'1.1.2'});
    if(user && !(req.method==='GET'&&PUBLIC_PWA.has(route.pathname)) && !sameSecret(req.headers.authorization,authValue)) {
      res.writeHead(401,{...HEADERS,'WWW-Authenticate':'Basic realm="PulSe", charset="UTF-8"'});return res.end('Connexion requise.');
    }
    try {
      if(req.method==='GET'&&route.pathname==='/api/catalog') {
        try{return responseJson(res,200,await loadCatalog(route.searchParams.get('refresh')==='1'))}
        catch{return responseJson(res,503,{error:'LinKs momentanément inaccessible : vérifie LINKS_PUBLIC_URL.'})}
      }
      if(req.method==='GET'&&route.pathname==='/api/stats') {
        const requested=route.searchParams.getAll('days');
        if(requested.length>1||(requested.length&&!['7','30'].includes(requested[0])))return responseJson(res,400,{error:'Choisissez 7 ou 30 jours.'});
        const period=Number(requested[0]||7);
        if(!bridgeToken)return responseJson(res,200,{available:false,reason:'Connexion sécurisée des statistiques LinKs à finaliser.'});
        try {const stats=normalizeStats(await requestLinks('/api/pulse/stats?days='+period,{privateAccess:true}),period);return responseJson(res,200,{available:true,...stats})}
        catch {return responseJson(res,200,{available:false,reason:'La passerelle statistique LinKs ne répond pas.'})}
      }
      if(req.method==='POST'&&route.pathname==='/api/story-link') {
        if(!req.headers['content-type']?.startsWith('application/json'))return responseJson(res,415,{error:'JSON requis.'});
        if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin).host}catch{return responseJson(res,403,{error:'Origine invalide.'})}if(origin!==req.headers.host)return responseJson(res,403,{error:'Origine externe interdite.'})}
        if(req.headers['sec-fetch-site']==='cross-site'||req.headers['x-pulse-request']!=='1')return responseJson(res,403,{error:'Requête PulSe requise.'});
        let body;try{body=await readJson(req)}catch{return responseJson(res,400,{error:'Demande JSON invalide ou trop volumineuse.'})}
        if(!body||!['campaign','independent','youtube'].includes(body.type)||typeof body.id!=='string'||body.id.length>100)return responseJson(res,400,{error:'Contenu PulSe invalide.'});
        const cat=await loadCatalog();
        if(body.type==='independent'&&(!bridgeToken||!cat.trackedAvailable))return responseJson(res,503,{error:'Liens suivis indisponibles : passerelle LinKs non connectée.'});
        const group=body.type==='campaign'?cat.campaigns:body.type==='youtube'?[cat.video].filter(Boolean):cat.trackedLinks;
        const item=group.find(x=>x.id===body.id);
        if(!item)return responseJson(res,404,{error:'Contenu indisponible.'});
        if(bridgeToken) {
          try {
            const result=await requestLinks('/api/pulse/story-link',{method:'POST',data:{type:body.type,id:item.id},privateAccess:true});
            if(httpURL(result.url))return responseJson(res,200,{url:result.url,tracked:true});
          }catch(error){
            if(error.status===401||error.status===403)return responseJson(res,503,{code:'BRIDGE_AUTH',error:'LinKs refuse la connexion sécurisée. Vérifiez la configuration de la liaison.'});
            if(body.type==='youtube'&&(error.unsupported||error.status===404))return responseJson(res,503,{code:'VIDEO_BRIDGE_REQUIRED',error:'La connexion LinKs doit être mise à jour pour préparer une Story YouTube.'});
            if(error.changed)return responseJson(res,409,{code:'VIDEO_CHANGED',error:'La dernière vidéo a changé. Actualisez PulSe puis sélectionnez la nouvelle vidéo.'});
          }
          return responseJson(res,503,{error:'Impossible de créer le lien suivi LinKs. Réessaie plus tard.'});
        }
        if(body.type==='independent')return responseJson(res,503,{error:'Génération du lien suivi indisponible : réessaie plus tard.'});
        return responseJson(res,503,{error:'Connexion sécurisée LinKs nécessaire pour préparer un lien suivi.'});
      }
      if(req.method==='GET'&&route.pathname==='/api/visual') {
        const id=route.searchParams.get('id');
        const cat=await loadCatalog();
        const video=route.searchParams.get('type')==='youtube';
        const item=video&&cat.video?.id===id?cat.video:!video?cat.campaigns.find(x=>x.id===id):null;
        if(!item||(video?!item.thumbnail:!safeImageRef(item.image)))return responseJson(res,404,{error:'Aucun visuel compatible.'});
        // The client supplies only an ID. The URL is validated metadata, never an arbitrary proxy URL.
        const dest=video?item.thumbnail:fixedURL(linkBase,item.image);
        const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5000);
        try {
          const r=await fetcher(dest,{redirect:'error',signal:controller.signal});
          if(!r.ok||!['image/png','image/jpeg','image/webp','image/gif'].includes((r.headers.get('content-type')||'').split(';')[0]))return responseJson(res,502,{error:'Visuel indisponible.'});
          if(Number(r.headers.get('content-length')||0)>8*1024*1024)return responseJson(res,413,{error:'Visuel trop lourd.'});
          const bytes=await boundedBytes(r,8*1024*1024);
          res.writeHead(200,{...HEADERS,'Content-Type':r.headers.get('content-type').split(';')[0],'Content-Length':bytes.length});return res.end(bytes);
        }finally {clearTimeout(timeout)}
      }
      if(req.method!=='GET')return responseJson(res,405,{error:'Méthode non autorisée.'});
      const name=route.pathname==='/'?'index.html':route.pathname.slice(1);
      if(!STATIC.has(name))return responseJson(res,404,{error:'Introuvable.'});
      const bytes=await readFile(new URL(name,ROOT));res.writeHead(200,{...HEADERS,'Content-Type':MIME[name.split('.').pop()]||'application/octet-stream','Content-Length':bytes.length});return res.end(bytes);
    }catch (error) {return responseJson(res,500,{error:error?.message==='Corps de requête trop volumineux.'?error.message:'Une erreur est survenue.'})}
  };
  return cert&&key?https.createServer({cert,key,minVersion:'TLSv1.2'},handler):http.createServer(handler);
}
export async function startFromEnvironment(env=process.env) {
  if(env.PULSE_REQUIRE_AUTH!=='0'&&(!env.PULSE_TEST_USER||!env.PULSE_TEST_PASSWORD))throw new Error('Identifiants PulSe requis.');
  if(env.PULSE_REQUIRE_AUTH!=='0'&&(env.PULSE_TEST_PASSWORD.length<12||env.PULSE_TEST_PASSWORD==='REMPLACER_PAR_UN_SECRET_ALEATOIRE'))throw new Error('Mot de passe de test : 12 caractères minimum.');
  if(env.PULSE_BRIDGE_TOKEN&&env.PULSE_BRIDGE_TOKEN.length<32)throw new Error('Secret de passerelle : 32 caractères minimum.');
  if(env.PULSE_REQUIRE_AUTH==='0'&&!['127.0.0.1','localhost','::1'].includes(env.PULSE_HOST||'127.0.0.1'))throw new Error('Authentification obligatoire hors boucle locale.');
  const server=createPulseServer({user:env.PULSE_TEST_USER||'',password:env.PULSE_TEST_PASSWORD||'',linksURL:env.LINKS_PUBLIC_URL||'http://domotik-links:8080',bridgeToken:env.PULSE_BRIDGE_TOKEN||'',bridgeURL:env.LINKS_BRIDGE_URL||''});
  const host=env.PULSE_HOST||'127.0.0.1',port=Number(env.PULSE_PORT||4173);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve)});
  console.log(`PulSe V1.1.2 : HTTP sur ${host}:${port}`);
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)startFromEnvironment().catch(e=>{console.error('Démarrage refusé :',e.message);process.exitCode=1});
