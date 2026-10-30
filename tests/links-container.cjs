// Run the published engine; only disposable test drivers are mounted, never app code.
const assert=require('node:assert/strict');
const {execFileSync,spawn}=require('node:child_process');
const {resolve}=require('node:path');
const release=require('./links-release.json');
module.exports=function launchReleasedLinKs(repo,secret){
 assert.match(release.image,/^ghcr\.io\/mick7784\/links@sha256:[a-f0-9]{64}$/);
 assert.match(release.revision,/^[a-f0-9]{40}$/);
 assert.equal(execFileSync('git',['-C',resolve(repo),'rev-parse','HEAD'],{encoding:'utf8'}).trim(),release.revision,'Fixture helper must come from the released commit');
 execFileSync('docker',['pull',release.image],{stdio:'inherit'});
 const info=JSON.parse(execFileSync('docker',['image','inspect',release.image],{encoding:'utf8'}))[0];
 assert.ok(info.RepoDigests.includes(release.image),'Pulled digest must match the release lock');
 assert.equal(info.Config.Labels['org.opencontainers.image.revision'],release.revision);
 assert.equal(info.Config.Labels['org.opencontainers.image.version'],release.version);
 console.log('Verified LinKs release image:',JSON.stringify(release));
 const name='pulse-links-integration-'+process.pid;
 const args=['run','--rm','-i','--name',name,'--read-only',
  '--tmpfs','/data:rw,nosuid,size=64m,mode=1777','--tmpfs','/tmp:rw,noexec,nosuid,size=32m,mode=1777',
  '--cap-drop','ALL','--security-opt','no-new-privileges:true',
  '-p','127.0.0.1:18180:8080','-p','127.0.0.1:18181:8081',
  '--mount',`type=bind,src=${resolve(__dirname,'links-fixture.py')},dst=/fixtures/links-fixture.py,readonly`,
  '--mount',`type=bind,src=${resolve(repo,'scripts/fixtures.py')},dst=/fixtures/fixtures.py,readonly`,
  '-e','PULSE_BRIDGE_TOKEN','-e','LINKS_ENGINE_PATH=/app','-e','LINKS_FIXTURE_HOST=0.0.0.0',
  '-e','LINKS_FIXTURE_PUBLIC_PORT=8080','-e','LINKS_FIXTURE_ADMIN_PORT=8081',
  '-e','LINKS_FIXTURE_ORIGIN=http://127.0.0.1:18180','-e','LINKS_FIXTURE_BRIDGE=http://127.0.0.1:18181',
  '--entrypoint','python3',release.image,'-u','/fixtures/links-fixture.py','/app','/data'];
 const child=spawn('docker',args,{env:{...process.env,PULSE_BRIDGE_TOKEN:secret},stdio:['pipe','pipe','pipe']});
 return {child,release,cleanup(){
  // Scope cleanup to the unique disposable container owned by this test process.
  try{execFileSync('docker',['rm','-f',name],{stdio:'ignore'})}catch{}
 }};
};
