"""Run the real release script against local command doubles, never a registry."""
import json, os, subprocess, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
stub=r"""#!/usr/bin/env python3
import os,sys,json
from pathlib import Path
name=Path(sys.argv[0]).name;args=sys.argv[1:];mode=os.environ['CASE']
with open(os.environ['LOG'],'a') as f:f.write(name+' '+ ' '.join(args)+'\n')
if name=='gh':
 if args[0]=='api':
  endpoint=args[1]
  if 'git/ref/' in endpoint:print('old' if mode=='stale' else 'reviewed')
  elif endpoint.endswith('/releases'):print(json.dumps([{'tag_name':'v9.0.0','draft':False,'prerelease':False}] if mode=='newer' else []))
  elif endpoint.endswith('/tags'):print('[]')
 elif args[:2]==['release','view']:sys.exit(1)
elif name=='curl':print('{"token":"fixture-token"}' if any('/token?' in a for a in args) else '500' if mode=='registry-error' else '404' if mode=='missing' else '200')
elif name=='docker':
 if args[:3]==['buildx','imagetools','inspect']:
  print(json.dumps({'manifests':[{'platform':{'os':'linux','architecture':a},'digest':'sha256:'+a} for a in ['amd64','arm64']]}) if '--raw' in args else 'sha256:same')
 elif args[:2]==['image','inspect']:print(('wrong' if mode=='collision' else 'reviewed') if 'revision' in args[-1] else '1.1.5')
"""
for mode in ['stale','newer','registry-error','collision','existing','missing']:
 with tempfile.TemporaryDirectory() as directory:
  temp=Path(directory);(temp/'bin').mkdir();(temp/'package.json').write_text('{"version":"1.1.5"}');log=temp/'log'
  for name in ['gh','curl','docker']:
   p=temp/'bin'/name;p.write_text(stub);p.chmod(0o755)
  result=subprocess.run(['bash',str(root/'scripts/publish-release.sh')],cwd=temp,env={**os.environ,'PATH':str(temp/'bin')+os.pathsep+os.environ['PATH'],'CASE':mode,'LOG':str(log),'GITHUB_REPOSITORY':'fixture/PulSe','GITHUB_SHA':'reviewed','GITHUB_ACTOR':'fixture','GH_TOKEN':'fixture','GITHUB_STEP_SUMMARY':str(temp/'summary')},capture_output=True,text=True)
  calls=log.read_text()
  if mode in ['existing','missing']:
   assert result.returncode==0,(mode,result.stderr)
   assert 'imagetools create --tag ghcr.io/mick7784/links-pulse:latest' in calls
   assert ('buildx build' in calls)==(mode=='missing')
  else:
   assert result.returncode!=0,mode
   assert 'buildx build' not in calls and 'imagetools create' not in calls,mode
print('PASS release guard: stale/newer/refused registry/collision blocked; existing version reused; only 404 permits build; promotion after both architectures verified.')
