// Isolated LinKs contract fixture; no real tokens, campaigns, data or counters.
import http from 'node:http';
let bridgeCalls=0;
http.createServer((req,res)=>{
 // Nginx matches locations on decoded paths. Include that second-hop behavior.
 let path;try{path=decodeURIComponent(new URL(req.url,'http://links.test').pathname)}catch{res.writeHead(400);return res.end()}
 const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body))};
 if(path==='/fixture-count')return send(200,{bridgeCalls});
 if(path.startsWith('/api/pulse/')){
  bridgeCalls++;
  if(req.headers.authorization!=='Bearer '+process.env.PULSE_BRIDGE_TOKEN)return send(401,{error:'Denied'});
  if(path==='/api/pulse/links')return send(200,{links:[{id:'private',name:'Fixture private',url:'https://partner.test',enabled:true,archived:false}]});
  if(path==='/api/pulse/story-link')return send(200,{url:'https://links.test/abc123456'});
  if(path==='/api/pulse/stats')return send(200,{period:7,total:0,today:0,last7:0,stories:0,days:Array.from({length:7},(_,i)=>({date:'2026-10-'+(20+i),clicks:0}))});
 }
 if(path==='/api/public-config')return send(200,{links:[]});
 if(path==='/latest-video.json')return send(200,null);
 if(path==='/abc123456'||path==='/go/fixture'){res.writeHead(302,{Location:'https://partner.test/unchanged'});return res.end()}
 if(['/','/assets/fixture.css','/uploads/fixture.png','/api/pulse-other'].includes(path))return send(200,{public:true});
 send(404,{error:'Missing'});
}).listen(8080,'0.0.0.0');
