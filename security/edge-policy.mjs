import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Offline generator only: no API calls, credentials or production defaults.
export function edgePolicy(input) {
 const names=(values,label,pattern)=>{
  if(!Array.isArray(values)||!values.length||values.some(v=>typeof v!=='string'||!pattern.test(v)))throw Error(label+' : liste explicite requise.');
  return [...new Set(values)];
 };
 const domain=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
 const pulse=names(input.pulseHosts,'Hôtes PulSe',domain),links=names(input.linksHosts,'Hôtes LinKs',domain);
 if(pulse.some(h=>links.includes(h)))throw Error('PulSe et LinKs doivent avoir des hôtes distincts.');
 if(!Array.isArray(input.publicEntryPoints)||!input.publicEntryPoints.length)throw Error('Entrées publiques requises.');
 const routers={},seen=new Set();
 for(const entry of input.publicEntryPoints){
  if(!entry||typeof entry.name!=='string'||!/^[a-zA-Z0-9_-]+$/.test(entry.name)||typeof entry.tls!=='boolean'||seen.has(entry.name))throw Error('Entrée publique invalide ou dupliquée.');
  seen.add(entry.name);
  const host=hosts=>'('+hosts.map(h=>'Host(`'+h+'`)').join(' || ')+')';
  const deny=rule=>({entryPoints:[entry.name],rule,priority:1000000000,service:'noop@internal',middlewares:['pulse-private-no-store'],...(entry.tls?{tls:{}}:{})});
  routers['pulse-private-deny-'+entry.name]=deny(host(pulse));
  routers['links-bridge-deny-'+entry.name]=deny(host(links)+' && PathRegexp(`(?i)^/+api/+pulse(/|$)`)');
 }
 return {http:{routers,middlewares:{'pulse-private-no-store':{headers:{customResponseHeaders:{'Cache-Control':'no-store'}}}}}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==4||!process.argv[3].endsWith('.yaml'))throw Error('Usage : node security/edge-policy.mjs inventaire.json sortie.yaml');
  const result=edgePolicy(JSON.parse(await readFile(process.argv[2],'utf8')));
  await writeFile(process.argv[3],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log('Configuration candidate créée. Aucun changement réseau effectué.');
 }catch(error){console.error(error.message);process.exitCode=1}
}
