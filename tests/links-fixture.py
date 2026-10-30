"""Run the real LinKs components against disposable fixture data for PulSe tests."""
import json
import os
import sys
import threading
from pathlib import Path
repo, root = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
sys.path.insert(0,str(repo/'scripts'))
os.environ['ANALYTICS_DB']=str(root/'analytics.db')
os.environ['UPLOAD_DIR']=str(root/'uploads')
from fixtures import prepare
prepare(os.environ['ANALYTICS_DB'])
import analytics as a
import affiliate_partners
import tracked_links
a.init()
public=a.serve(0,False,'127.0.0.1');admin=a.serve(0,True,'127.0.0.1')
a.ORIGIN='http://127.0.0.1:'+str(public.server_port)
with a.connection() as db:
    a.instance.put(db,'site.url',a.ORIGIN)
    a.instance.put(db,'video.enabled','false')
    old=affiliate_partners.save_tracked(db,{'name':'Lien historique','url':'https://shop.example/historical','notes':'Notes à conserver'},a.story_url_valid,a.now_iso())
    source=tracked_links.publication_source(db,old['id'])
    short=tracked_links.token_link(db,old['id'],source['id'],a.ORIGIN,a.now_iso())
    campaign=a.save_content(db,a.block_data({'type':'promo','internal_name':'Offre de recette','title':'Offre de recette','url':'https://shop.example/campaign'}))
for server in [public,admin]:threading.Thread(target=server.serve_forever,daemon=True).start()
print(json.dumps({'public':a.ORIGIN,'bridge':'http://127.0.0.1:'+str(admin.server_port),'legacy':old,'short':short['url']}),flush=True)
try:sys.stdin.readline()
finally:
    for server in [public,admin]:server.shutdown();server.server_close()
