import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const [directory,rawPort]=process.argv.slice(2),root=path.resolve(directory),port=Number(rawPort);
if(!fs.existsSync(root)||!Number.isInteger(port))throw new Error('static-server.mjs <directory> <port>');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1'),relative=decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.slice(1));
  const file=path.resolve(root,relative);
  if(file!==root&&!file.startsWith(root+path.sep))throw new Error('Path outside product');
  const body=fs.readFileSync(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('Product: http://127.0.0.1:'+port));

