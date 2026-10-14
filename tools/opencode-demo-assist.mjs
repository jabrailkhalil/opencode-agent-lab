import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,''));
export const assistPorts={claude:4216,qwen:4217};
export function nextAssignment(workshop,cursors,profile){
 const current=cursors[profile];
 const run=workshop.runs.find(r=>r.profile===profile&&r.stages.some(s=>s.id===current?.checkpoint));
 if(!run)return {current:current?.checkpoint||null,next:null,error:'Выбери ветку в пульте и нажми «Начать эту ветку».'};
 const index=run.stages.findIndex(s=>s.id===current.checkpoint),stage=run.stages.slice(index+1).find(s=>s.role!=='operator');
 const calls=run.stages.filter(s=>s.role!=='operator');
 return {current:current.checkpoint,version:current.version,run:run.id,label:run.label,model:run.model,spec:run.spec,total:calls.length,
  next:stage?{id:stage.id,role:stage.role,title:stage.title,number:calls.findIndex(s=>s.id===stage.id)+1,prompt:stage.prompt}:null};
}

// A narrow adapter for the installed OpenCode web build. Abort if either anchor
// changes; the original bundle and all recorded artifacts remain untouched.
export function patchOpenCodeBundle(source){
 const patches=[
  ['return{ready:p,capture:v=>m(v).capture()',
   'window.__AGENT_LAB__&&be(window.__AGENT_LAB__.register("prompt",{ready:()=>p(),get:()=>g().current(),set:text=>g().set([{type:"text",content:text,start:0,end:text.length}],text.length),directory:()=>t().directory,session:()=>e.id}));return{ready:p,capture:v=>m(v).capture()'],
  ['return{slug:E(()=>cn(t().directory)),model:D,agent:C,session:',
   'window.__AGENT_LAB__&&be(window.__AGENT_LAB__.register("local",{agent:C,model:D,directory:()=>t().directory,session:()=>e.id}));return{slug:E(()=>cn(t().directory)),model:D,agent:C,session:']
 ];
 for(const [from,to]of patches){
  if(source.split(from).length!==2)throw new Error('Версия интерфейса OpenCode изменилась. Автоподстановка отключена; обычный OpenCode доступен на 4096/4097.');
  source=source.replace(from,to);
 }
 return source;
}

export async function startAssist(profile){
 const port=assistPorts[profile];
 if(!port)throw new Error('Unknown profile');
 const origin='http://127.0.0.1:'+port;
 const plan=()=>read('data/live-preparation.json').profiles.find(p=>p.profile===profile);
 const base=()=> 'http://127.0.0.1:'+plan().agentPort;
 const config=()=>JSON.parse(fs.readFileSync(path.join(plan().workspace,'opencode.json'),'utf8').replace(/^\uFEFF/,''));
 const recorded=()=>{const c=config();return c.model==='demo-recording/'+profile+'-recording'&&c.enabled_providers?.length===1&&c.enabled_providers[0]==='demo-recording';};
 const engine=async(route,body)=>{
  const response=await fetch(base()+route,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-opencode-directory':encodeURIComponent(plan().workspace)},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw new Error('OpenCode: HTTP '+response.status);
  return response.json();
 };
 const current=()=>nextAssignment(read('data/workshop.json'),read('data/checkpoint-console-state.json'),profile);
 const control=async(route,body)=>{const response=await fetch('http://127.0.0.1:4201/api/replay/'+route,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});const value=await response.json();if(!response.ok)throw Error(value.error||'Нет связи с пультом');return value;};
 // Download once at startup, locally from the running version, and pin its
 // exact asset URL. No network dependency is introduced by this adapter.
 const page=await fetch(base()+'/').then(r=>r.text());
 const asset=page.match(/<script type="module"[^>]+src="([^"]+)"/)[1];
 const patched=patchOpenCodeBundle(await fetch(base()+asset).then(r=>r.text()));
 const server=http.createServer(async(req,res)=>{
  const json=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
  try{
   const url=new URL(req.url,origin);
   if(url.pathname.startsWith('/__demo/')){
    if(req.headers.origin&&req.headers.origin!==origin&&req.headers.origin!=='http://127.0.0.1:4201'){json(403,{error:'Local demo only'});return;}
    if(url.pathname==='/__demo/health'){json(200,{healthy:true,profile,recording:recorded()});return;}
    if(url.pathname==='/__demo/next'){
     const [statuses,shared]=await Promise.all([engine('/session/status'),control('status?profile='+profile)]);
     json(200,{...current(),profile,workspace:plan().workspace,epoch:shared.current?.epoch,sessionId:shared.current?.sessionId,intent:shared.intent,resetting:shared.resetting,resetError:shared.error,recording:recorded(),busy:Object.values(statuses).some(s=>s.type&&s.type!=='idle')});return;
    }
    if(url.pathname==='/__demo/prepare'&&req.method==='POST'){let raw='';for await(const c of req){raw+=c;if(raw.length>4096)throw Error('Слишком большой запрос');}json(200,await control('prepare',{...JSON.parse(raw),profile}));return;}
    if(url.pathname==='/__demo/open'){
     if(!recorded())throw new Error('Автоподстановка доступна только в режиме записи.');
     const bound=await control('session',{profile});
     res.writeHead(302,{Location:'/server/'+Buffer.from(origin).toString('base64url')+'/session/'+encodeURIComponent(bound.sessionId),'Cache-Control':'no-store'});res.end();return;
    }
    if(['/__demo/assist.js','/__demo/assist.css'].includes(url.pathname)){
     const suffix=url.pathname.endsWith('.js')?'js':'css';res.writeHead(200,{'Content-Type':suffix==='js'?'text/javascript; charset=utf-8':'text/css; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(root,'ui',suffix==='js'?'opencode-assist-client.js':'opencode-assist.css')));return;
    }
    json(404,{error:'Unknown assistant route'});return;
   }
   if(url.pathname===asset){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(patched);return;}
   let forwardedBody,claimed;
   const submission=url.pathname.match(/^\/(?:api\/)?session\/(ses_[a-zA-Z0-9]+)\/(?:prompt_async|prompt|message)$/);
   if(submission&&req.method==='POST'&&recorded()){
    const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>4*1024*1024)throw Error('Слишком большой запрос');chunks.push(chunk);}forwardedBody=Buffer.concat(chunks);
    try{claimed=await control('claim',{profile,sessionId:submission[1],request:JSON.parse(forwardedBody.toString())});}catch(error){json(409,{error:error.message});return;}
   }
   const headers={...req.headers,host:new URL(base()).host,'accept-encoding':'identity'};
   delete headers['if-none-match'];delete headers['if-modified-since'];
   const upstream=http.request(base()+req.url,{method:req.method,headers},response=>{
    if(claimed&&response.statusCode>=400)control('failed',{profile,id:claimed.id}).catch(()=>{});
    const html=response.headers['content-type']?.includes('text/html');
    const out={...response.headers};delete out['content-length'];delete out['content-encoding'];
    if(html){
     const chunks=[];response.on('data',c=>chunks.push(c));response.on('end',()=>{
      const source=Buffer.concat(chunks).toString();
      const extra='<link rel="stylesheet" href="/__demo/assist.css"><script src="/__demo/assist.js"></script>';
      out['cache-control']='no-store';res.writeHead(response.statusCode,out);res.end(source.replace('</head>',extra+'</head>'));
     });
    }else{res.writeHead(response.statusCode,out);response.pipe(res);}
   });
   upstream.on('error',()=>{if(claimed)control('failed',{profile,id:claimed.id}).catch(()=>{});if(!res.headersSent)json(502,{error:'OpenCode недоступен'});else res.destroy();});
   res.on('close',()=>upstream.destroy());if(forwardedBody)upstream.end(forwardedBody);else req.pipe(upstream);
  }catch(error){json(503,{error:error.message});}
 });
 server.on('upgrade',(req,socket,head)=>{
  const target=net.connect(plan().agentPort,'127.0.0.1',()=>{
   target.write(req.method+' '+req.url+' HTTP/1.1\r\n'+Object.entries({...req.headers,host:new URL(base()).host}).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n');
   if(head.length)target.write(head);socket.pipe(target);target.pipe(socket);
  });
  target.on('error',()=>socket.destroy());socket.on('error',()=>target.destroy());socket.on('close',()=>target.destroy());
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 console.log(profile+' OpenCode assistant '+origin+' (recorded drafts only)');
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 for(const profile of ['claude','qwen'])await startAssist(profile);
}
