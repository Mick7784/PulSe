"""Run the real LinKs components against disposable fixture data for PulSe tests."""
import json
import os
import sys
import threading
import uuid
from PIL import Image
from pathlib import Path
repo, root = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
sys.path.insert(0,os.environ.get('LINKS_ENGINE_PATH',str(repo/'scripts')))
os.environ['ANALYTICS_DB']=str(root/'analytics.db')
os.environ['UPLOAD_DIR']=str(root/'uploads')
from fixtures import prepare
prepare(os.environ['ANALYTICS_DB'])
import analytics as a
import affiliate_partners
import tracked_links
a.init()
host=os.environ.get('LINKS_FIXTURE_HOST','127.0.0.1')
public=a.serve(int(os.environ.get('LINKS_FIXTURE_PUBLIC_PORT','0')),False,host)
admin=a.serve(int(os.environ.get('LINKS_FIXTURE_ADMIN_PORT','0')),True,host)
a.ORIGIN=os.environ.get('LINKS_FIXTURE_ORIGIN','http://127.0.0.1:'+str(public.server_port))
bridge=os.environ.get('LINKS_FIXTURE_BRIDGE','http://127.0.0.1:'+str(admin.server_port))
default_image='/uploads/'+str(uuid.uuid4())+'.png'
specific_image='/uploads/'+str(uuid.uuid4())+'.png'
for path,color in [(default_image,(180,30,60)),(specific_image,(30,60,180))]:
    Image.new('RGB',(480,320),color).save(a.UPLOADS/path.removeprefix('/uploads/'))
a.save_campaign_image({'image':default_image})
with a.connection() as db:
    a.instance.put(db,'site.url',a.ORIGIN)
    a.instance.put(db,'video.enabled','false')
    old=affiliate_partners.save_tracked(db,{'name':'Lien historique','url':'https://shop.example/historical','notes':'Notes à conserver'},a.story_url_valid,a.now_iso())
    source=tracked_links.publication_source(db,old['id'])
    short=tracked_links.token_link(db,old['id'],source['id'],a.ORIGIN,a.now_iso())
    campaign=a.save_content(db,a.block_data({'type':'promo','internal_name':'Offre de recette','title':'Offre de recette','url':'https://shop.example/campaign'}))
    campaigns={'default':campaign}
    for key,extra in [('specific',{'image':specific_image,'description':'Description campagne spécifique','promo_code':'MOBILE10'}),('featured',{'type':'featured'}),('waiting',{}),('remote',{'image':'https://outside.example/remote.png'}),('future',{'start_at':'2099-01-01T00:00:00Z'}),('ended',{'end_at':'2020-01-01T00:00:00Z'}),('disabled',{'active':False}),('draft',{'draft':True}),('classic',{'type':'classic'})]:
        campaigns[key]=a.save_content(db,a.block_data({'type':'promo','internal_name':key,'title':'Campagne '+key,'url':'https://shop.example/'+key,**extra}))
for server in [public,admin]:threading.Thread(target=server.serve_forever,daemon=True).start()
print(json.dumps({'public':a.ORIGIN,'bridge':bridge,'legacy':old,'short':short['url'],'campaigns':campaigns,'default_image':default_image,'specific_image':specific_image,'engine':str(Path(a.__file__).resolve()),'version':a.software_version(),'releaseId':os.environ.get('APP_RELEASE_ID')}),flush=True)
try:
    for line in sys.stdin:
        if not line.strip():break
        command=json.loads(line)
        # Fixture changes use the same SQLite database; business HTTP responses remain real.
        with a.connection() as db:db.execute('UPDATE content_blocks SET active=0 WHERE id=?',(command['disable'],))
        print(json.dumps({'control':command['request']}),flush=True)
finally:
    for server in [public,admin]:server.shutdown();server.server_close()
