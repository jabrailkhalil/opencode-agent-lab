
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {savedOpenCodeReply} from './saved-opencode-reply.mjs';
import {nextPrompt} from '../ui/demo-flow.js';

const root=path.resolve(import.meta.dirname,'..');
const port=Number(process.env.DEMO_CONSOLE_PORT||4201);
const setupFile=path.join(root,'data/live-preparation.json');
const stateFile=path.join(root,'data/checkpoint-console-state.json');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const catalogFile=path.join(root,'data/checkpoints.json');
let catalog=read(catalogFile),catalogTime=fs.statSync(catalogFile).mtimeMs;
const insight=read(path.join(root,'data/run-insights.json'));
const recordings={claude:read(path.join(root,'data/claude-observer.json')),qwen:read(path.join(root,'data/observer.json'))};
const names={operator:'Старт / итог',analyst:'Аналитик',designer:'Дизайнер',developer:'Разработчик',tester:'Тестировщик'};
const managed=['docs','dist','tests','reports','openspec'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const guarded=(base,relative)=>{const p=path.resolve(base,relative);if(!p.toLowerCase().startsWith(path.resolve(base).toLowerCase()+path.sep))throw new Error('Путь вне рабочей папки');return p;};
const redact=text=>String(text||'').replace(/sk-[A-Za-z0-9_-]{16,}/g,'[REDACTED]');
let busy=false;
// The two chats can answer together. Restore their files in a queue because
// setup and cursor JSON are shared; never reject the other model's transition.
let restoreQueue=Promise.resolve();
const pendingProfiles=new Set();
function target(profile){
 if(!['claude','qwen'].includes(profile))throw new Error('Неизвестная команда');
 const setup=read(setupFile),plan=setup.profiles.find(p=>p.profile===profile);
 if(!plan)throw new Error('Рабочая папка не подготовлена');
 const workspace=fs.realpathSync(plan.workspace),home=fs.realpathSync(path.join(root,'.runtime/workspaces')); 
 if(path.dirname(workspace).toLowerCase()!==home.toLowerCase()||!['claude','qwen'].includes(path.basename(workspace)))throw new Error('Рабочая папка вне подготовленного стенда');
 return {setup,plan,workspace};
}
function state(){return fs.existsSync(stateFile)?read(stateFile):{claude:null,qwen:null};}
function route(profile,mode){return catalog.filter(p=>mode==='errors'?p.group==='errors'&&!p.id.startsWith('ui-review-'):p.group===profile);}
function imagesIn(dir,prefix=''){
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  if(entry.isSymbolicLink())return [];
  const relative=prefix+entry.name;
  return entry.isDirectory()?imagesIn(path.join(dir,entry.name),relative+'/'):/\.(png|jpe?g|webp)$/i.test(entry.name)?[relative]:[];
 });
}
function pointData(point,profile){
 const source=path.join(root,'checkpoints',point.id),manifest=read(path.join(source,'manifest.json'));
 const event=recordings[profile]?.events?.find(e=>e.checkpoint===point.id);
 const usage=insight.runs?.[profile]?.stages?.[point.id]||insight.runs?.[profile]?.followups?.[point.id]||null;
 const report=({analyst:'ANALYSIS.md',designer:point.id.endsWith('-12')?'DESIGN-REVIEW.md':'DESIGN-PLAN.md',developer:'DEVELOPMENT.md',tester:'QA-RESULTS.md'})[point.role];
 return {id:point.id,title:point.title,role:point.role,roleName:names[point.role]||point.role,
  kind:point.kind,application:!!point.application,description:point.description,
  prompt:redact(event?.prompt||point.specification||''),output:redact(point.id==='claude-03'?'Сохранённая попытка разработчика прервалась из-за обрыва API. Готовая реализация находится в следующем чекпоинте claude-04. Чтобы продолжить в OpenCode, оставь Developer и отправь: «Продолжи реализацию после обрыва API».':event?.output||point.message||point.description||''),
  elapsedMs:usage?.elapsedMs??event?.elapsedMs??point.recordedElapsedMs??null,
  timeBasis:usage?.elapsedMs!=null||event?.elapsedMs!=null?'stage':'cumulative',
  usage,finding:usage?.finding||null,recordedModel:manifest.model||(typeof recordings[profile]?.model==='string'?recordings[profile].model:null),
  files:manifest.files.filter(f=>managed.includes(f.path.split('/')[0])).map(f=>f.path),
  screenshots:imagesIn(path.join(source,'screenshots')).sort((a,b)=>Number(!a.startsWith('application'))-Number(!b.startsWith('application'))||a.localeCompare(b)),
  report:point.report||(report&&fs.existsSync(path.join(source,'code/reports',report))?'reports/'+report:null)};
}
function view(profile,mode='base'){
 const {plan,workspace}=target(profile),current=state()[profile];
 const points=route(profile,mode).map(p=>pointData(p,profile));
 return {profile,workspace,model:plan.model,openCodeMode:plan.openCodeMode||'live',opencodeUrl:'http://127.0.0.1:'+plan.agentPort+'/',productUrl:'http://127.0.0.1:'+plan.appPort+'/',current,
  points,index:points.findIndex(p=>p.id===current?.checkpoint),apiCalls:0};
}
async function apply(profile,id,options={}){
 if(pendingProfiles.has(profile))throw new Error('Эта команда уже переключает этап. Дождись завершения.');
 pendingProfiles.add(profile);
 const task=restoreQueue.then(()=>applyNow(profile,id,options));
 restoreQueue=task.catch(()=>{});
 try{return await task;}finally{pendingProfiles.delete(profile);}
}
async function applyNow(profile,id,options={}){
 if(busy)throw new Error('Уже выполняется переход. Дождись завершения.');
 busy=true;
 try{
  const {setup,plan,workspace}=target(profile);
  const point=catalog.find(p=>p.id===id&&(p.group===profile||p.group==='errors'));
  if(!point)throw new Error('Нет такого чекпоинта для этой команды');
  const response=await fetch('http://127.0.0.1:'+plan.agentPort+'/session/status',{headers:{'x-opencode-directory':workspace},signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw new Error('OpenCode недоступен: запусти стенд');
  const statuses=await response.json();
  if(!options.recordedReply&&Object.values(statuses).some(s=>s.type&&s.type!=='idle'))throw new Error('Агент работает. Сначала нажми остановку в OpenCode.');
  const source=path.join(root,'checkpoints',id),manifest=read(path.join(source,'manifest.json'));
  for(const [folder,entries]of [['code',manifest.files],['screenshots',manifest.screenshots||[]]])for(const entry of entries){
   const bytes=fs.readFileSync(guarded(path.join(source,folder),entry.path));
   if(bytes.length!==entry.bytes||sha(bytes)!==entry.sha256)throw new Error('Повреждён чекпоинт: '+entry.path);
  }
  const stamp=Date.now()+'-'+crypto.randomBytes(3).toString('hex');
  const label='before-ui-jump-'+stamp;
  const saved=spawnSync(setup.nodeExecutable,[path.join(root,'tools/save-live-checkpoint.mjs'),profile,label],{cwd:root,windowsHide:true,encoding:'utf8'});
  if(saved.status!==0)throw new Error('Не удалось сохранить текущую версию: '+redact(saved.stderr));
  const staging=guarded(workspace,'artifacts/control-staging/'+stamp);
  const backup=guarded(workspace,'artifacts/control-backups/'+stamp);
  fs.mkdirSync(staging,{recursive:true});fs.mkdirSync(backup,{recursive:true});
  for(const dir of managed)fs.mkdirSync(path.join(staging,dir));
  const selected=manifest.files.filter(f=>managed.includes(f.path.split('/')[0]));
  for(const entry of selected){const dest=guarded(staging,entry.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(guarded(path.join(source,'code'),entry.path),dest);}
  // Only the launch description is adapted; the product, fixtures and reports stay exact.
  const spec=path.join(staging,'docs/SPEC.md');
  if(fs.existsSync(spec))fs.writeFileSync(spec,fs.readFileSync(spec,'utf8').replace(/^Нужно с нуля написать[^\r\n]+/m,'Нужно с нуля написать работающий локальный веб-сервис «Поток». Он объединяет трекер задач и недельный планировщик загрузки сотрудников. Модель текущей команды задана в opencode.json. Переходы выполняются по сохранённым чекпоинтам.'));
  const moved=[];
  try{
   for(const dir of managed){
    const live=guarded(workspace,dir),old=guarded(backup,dir),ready=guarded(staging,dir);
    if(fs.existsSync(live)){if(fs.lstatSync(live).isSymbolicLink())throw new Error('Нельзя заменять ссылку: '+dir);fs.renameSync(live,old);}
    moved.push(dir);fs.renameSync(ready,live);
   }
  }catch(error){
   for(const dir of moved.reverse()){
    const live=guarded(workspace,dir),old=guarded(backup,dir);
    if(fs.existsSync(live))fs.renameSync(live,guarded(staging,'rollback-'+dir));
    if(fs.existsSync(old))fs.renameSync(old,live);
   }
   throw error;
  }
  for(const entry of selected.filter(f=>f.path!=='docs/SPEC.md'))if(sha(fs.readFileSync(guarded(workspace,entry.path)))!==entry.sha256)throw new Error('Проверка восстановленных файлов не прошла: '+entry.path);
  const record={checkpoint:id,at:new Date().toISOString(),version:stamp,backupCheckpoint:label,verifiedFiles:selected.length,apiCalls:0};
  const next=nextPrompt(profile,id)?.role||'завершено';
  fs.writeFileSync(path.join(workspace,'STAGE-TASK.md'),'# Продолжение после '+id+'\n\nЗагружена сохранённая версия. Следующая роль: '+next+'. Перед новым запросом прочитай документы и актуальные отчёты. Для просмотра и перехода вызов модели не нужен.\n\nТекущий продукт: http://127.0.0.1:'+plan.appPort+'/. Старые сообщения и порты в отчётах относятся к записанному прогону.\n');
  fs.writeFileSync(path.join(workspace,'CHECKPOINT-CURRENT.json'),JSON.stringify(record,null,2)+'\n');
  Object.assign(plan,{source:id,applicationExists:fs.existsSync(path.join(workspace,'dist/index.html')),sourceHashes:['docs/SPEC.md','docs/DOMAIN-CONTRACT.md','docs/seed-state.json','tests/acceptance.test.mjs'].filter(f=>fs.existsSync(path.join(workspace,f))).map(file=>({file,sha256:sha(fs.readFileSync(path.join(workspace,file)))}))});
  fs.writeFileSync(setupFile,JSON.stringify(setup,null,2)+'\n');
  const current=state();current[profile]=record;fs.writeFileSync(stateFile,JSON.stringify(current,null,2)+'\n');
  return {...record,workspace};
 }finally{busy=false;}
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 try{
  const freshTime=fs.statSync(catalogFile).mtimeMs;if(freshTime!==catalogTime){catalog=read(catalogFile);catalogTime=freshTime;}
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  if(await savedOpenCodeReply(req,res,url,{root,catalog,state,apply,pointData}))return;
  if(url.pathname==='/api/cursor'&&req.method==='GET'){
   const setup=read(setupFile);json(200,{current:state(),modes:Object.fromEntries(setup.profiles.map(p=>[p.profile,p.openCodeMode||'live']))});return;
  }
  if(url.pathname==='/api/opencode-link'&&req.method==='GET'){
   const {plan,workspace}=target(url.searchParams.get('profile')||'claude'),base='http://127.0.0.1:'+plan.agentPort;
   let href=base+'/';
   try{
    const response=await fetch(base+'/session?directory='+encodeURIComponent(workspace)+'&limit=40',{signal:AbortSignal.timeout(2500)});
    if(response.ok){
     const sessions=await response.json(),session=sessions.find(s=>!s.time?.archived&&path.resolve(s.directory||'').toLowerCase()===workspace.toLowerCase());
     if(session)href=base+'/server/'+Buffer.from(base).toString('base64url')+'/session/'+encodeURIComponent(session.id);
    }
   }catch{}
   json(200,{href});return;
  }
  if(url.pathname==='/api/state'&&req.method==='GET'){json(200,view(url.searchParams.get('profile')||'claude',url.searchParams.get('mode')||'base'));return;}
  if(url.pathname==='/api/opencode-mode'&&req.method==='POST'){json(200,{mode:'recording',apiCalls:0});return;}
  if(url.pathname==='/api/apply'&&req.method==='POST'){
   if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:'+port)throw new Error('Запрос не из пульта');
   if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('Нужен JSON');
   let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)throw new Error('Слишком большой запрос');}
   const {profile,checkpoint}=JSON.parse(body);json(200,await apply(profile,checkpoint));return;
  }
  if(url.pathname==='/api/validate-spec'&&req.method==='POST'){
   if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:'+port)throw new Error('Запрос не из пульта');
   let text='';for await(const c of req){text+=c;if(text.length>1024)throw new Error('Слишком большой запрос');}
   const {checkpoint}=JSON.parse(text);if(!['sdd-06','sdd-07','sdd-19','release-01'].includes(checkpoint)&&!(typeof checkpoint==='string'&&/^qspec-\d{2}$/.test(checkpoint)&&catalog.some(p=>p.id===checkpoint)&&fs.existsSync(path.join(root,'checkpoints',checkpoint,'code/openspec/changes/build-tracker'))))throw new Error('Недопустимая версия');
   const r=spawnSync(read(setupFile).nodeExecutable,[path.join(root,'tools/validate-replay-spec.mjs'),path.join(root,'checkpoints',checkpoint,'code')],{cwd:root,windowsHide:true,encoding:'utf8',timeout:20000});
   json(200,{valid:r.status===0,output:redact((r.stdout||'')+(r.stderr||'')),executor:'локальная проверка структуры сохранённой спецификации',apiCalls:0});return;
  }
  if(url.pathname.startsWith('/api/interactive/')){json(404,{error:'New API runs use the separate templates; see docs/LIVE-API.md.'});return;}
  if(req.method!=='GET'){json(405,{error:'Метод не поддерживается'});return;}
  if(url.pathname==='/health'){json(200,{app:'opencode-agent-lab',root,mode:'recording'});return;}
  if(url.pathname==='/api/workshop'){json(200,read(path.join(root,'data/workshop.json')));return;}
  if(url.pathname==='/api/legacy-qwen'){json(200,read(path.join(root,'data/legacy-qwen.json')));return;}
  if(url.pathname==='/guide.pdf'){
   const bytes=fs.readFileSync(path.join(root,'docs/pdf/OpenCode-Guide-with-Workflows.pdf'));
   res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="OpenCode-Guide-with-Workflows.pdf"','Cache-Control':'no-store'});res.end(bytes);return;
  }
  let file,body;
  const product=url.pathname.match(/^\/product\/(claude|qwen)\/(.*)$/);
  const preview=url.pathname.match(/^\/preview\/([a-z0-9-]+)\/(.*)$/);
  if(preview){
   if(!catalog.some(p=>p.id===preview[1]&&p.application))throw new Error('Нет приложения в этом чекпоинте');
   const relative=decodeURIComponent(preview[2]||'index.html');
   file=guarded(path.join(root,'checkpoints',preview[1],'code',relative.startsWith('docs/')?'':'dist'),relative);body=fs.readFileSync(file);
   if(file.endsWith('.html')){
    const isolation=`<script>(()=>{const prefix=${JSON.stringify('preview-'+preview[1]+':')};const native=window.localStorage;const scoped={getItem:k=>native.getItem(prefix+k),setItem:(k,v)=>native.setItem(prefix+k,v),removeItem:k=>native.removeItem(prefix+k),clear:()=>Object.keys(native).filter(k=>k.startsWith(prefix)).forEach(k=>native.removeItem(k)),key:i=>Object.keys(native).filter(k=>k.startsWith(prefix))[i]?.slice(prefix.length)??null,get length(){return Object.keys(native).filter(k=>k.startsWith(prefix)).length}};Object.defineProperty(window,'localStorage',{value:scoped});})();</script>`;
    body=Buffer.from(body.toString().replace(/<head[^>]*>/i,m=>m+isolation));
   }
   if(file.endsWith('app.js')){let source=body.toString();for(const storageKey of ['taskTrackerState','potok.state.v1'])for(const quote of ["'",'"'])source=source.replaceAll(quote+storageKey+quote,JSON.stringify('preview-'+preview[1]));body=Buffer.from(source);}
  }else if(product){
   const {workspace}=target(product[1]),dir=path.join(workspace,'dist');
   file=guarded(dir,decodeURIComponent(product[2]||'index.html'));body=fs.readFileSync(file);
   const current=state()[product[1]],key='console-'+product[1]+'-'+(current?.version||'start');
   if(file.endsWith('app.js')){
    let source=body.toString();
    for(const storageKey of ['taskTrackerState','potok.state.v1'])for(const quote of ["'",'"'])source=source.replaceAll(quote+storageKey+quote,JSON.stringify(key));
    body=Buffer.from(source);
   }
  }else if(url.pathname.startsWith('/recorded/')){
   const match=url.pathname.match(/^\/recorded\/([a-z0-9-]+)\/(code|screenshots)\/(.+)$/);
   if(!match||!catalog.some(p=>p.id===match[1]))throw new Error('Неизвестный артефакт');
   const dir=path.join(root,'checkpoints',match[1],match[2]);file=guarded(dir,decodeURIComponent(match[3]));
   if(match[2]==='code'&&!managed.includes(path.relative(dir,file).split(path.sep)[0]))throw new Error('Артефакт закрыт');
   body=fs.readFileSync(file);
  }else{
   const files={'/comparison':'comparison.html','/comparison.js':'comparison.js','/comparison.css':'comparison.css','/demo-clock.js':'demo-clock.js','/workshop-extras.js':'workshop-extras.js','/':'workshop.html','/archive':'checkpoint-console.html','/workshop.js':'workshop.js','/workshop.css':'workshop.css','/workshop-flow.js':'workshop-flow.js','/demo-flow.js':'demo-flow.js','/checkpoint-console.js':'checkpoint-console.js','/checkpoint-console.css':'checkpoint-console.css','/checkpoint-results.js':'checkpoint-results.js','/checkpoint-markdown.js':'checkpoint-markdown.js'};
   Object.assign(files,{'/run-metrics.js':'run-metrics.js','/agent-flow-spec.svg':'agent-flow-spec.svg','/agent-flow-direct.svg':'agent-flow-direct.svg','/spec-ui-contract.md':'spec-ui-contract.md','/material-routes.js':'material-routes.js','/comparison-sections.js':'comparison-sections.js','/parallel':'parallel.html','/parallel.js':'parallel.js','/parallel.css':'parallel.css','/legacy-qwen.js':'legacy-qwen.js','/legacy-qwen.css':'legacy-qwen.css'});
   files['/welcome']='welcome.html';
   files['/agent-workflows.js']='agent-workflows.js';
   for(const id of ['sonnet-spec','sonnet-direct','qwen-spec','qwen-direct'])files['/agent-flow-'+id+'.svg']='agent-flow-'+id+'.svg';
   if(url.pathname==='/'&&!url.searchParams.has('profile')&&!url.searchParams.has('run'))files['/']='welcome.html';
   if(!files[url.pathname]){json(404,{error:'Не найдено'});return;}
   file=path.join(root,'ui',files[url.pathname]);body=fs.readFileSync(file);
  }
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch(error){json(400,{error:redact(error.message)});}
});
server.listen(port,'127.0.0.1',()=>console.log('Checkpoint console: http://127.0.0.1:'+port+'/ · API calls: 0'));
