import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {inspectProcess,ownsProcess} from './runtime-platform.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),open=process.argv.includes('--open'),fresh=process.argv.includes('--fresh');
const lockFile=path.join(root,'.runtime/launch.lock');fs.mkdirSync(path.dirname(lockFile),{recursive:true});
const lock={id:crypto.randomUUID(),pid:process.pid,executable:process.execPath,startedAt:Date.now()};
try{fs.writeFileSync(lockFile,JSON.stringify(lock),{flag:'wx'});}catch(error){
 if(error.code!=='EEXIST')throw error;
 const previous=JSON.parse(fs.readFileSync(lockFile,'utf8'));
 if(ownsProcess(previous,inspectProcess(previous.pid))){console.log('Launch is already in progress. No second reset was started.');process.exit(0);}
 fs.unlinkSync(lockFile);fs.writeFileSync(lockFile,JSON.stringify(lock),{flag:'wx'});
}
process.on('exit',()=>{try{if(JSON.parse(fs.readFileSync(lockFile,'utf8')).id===lock.id)fs.unlinkSync(lockFile);}catch{}});
const ports=[4096,4097,4191,4192,4201,4216,4217];
const urls=['http://127.0.0.1:4201/welcome','http://127.0.0.1:4201/?profile=claude#intro','http://127.0.0.1:4201/?profile=qwen#intro','http://127.0.0.1:4201/parallel'];
function openTabs(){
 if(!open)return;
 if(process.platform==='win32')spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'tools/open-demo-tabs.ps1'),'-Urls',urls.join(',')],{windowsHide:true,detached:true,stdio:'ignore'}).unref();
 else if(process.platform==='darwin')spawn('open',urls,{detached:true,stdio:'ignore'}).unref();
 else for(const url of urls)spawn('xdg-open',[url],{detached:true,stdio:'ignore'}).unref();
}
async function freshPair(){
 if(!fresh)return;
 const workshop=JSON.parse(fs.readFileSync(path.join(root,'data/workshop.json'),'utf8'));
 const profiles=[workshop.presentation.leftRun,workshop.presentation.rightRun].map(id=>{const run=workshop.runs.find(r=>r.id===id);return {profile:run.profile,checkpoint:run.stages[0].id};});
 const r=await fetch('http://127.0.0.1:4201/api/replay/reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:lock.id,profiles}),signal:AbortSignal.timeout(30000)}),result=await r.json();
 if(!r.ok)throw Error(result.error||'Fresh start failed.');
 console.log('Fresh pair ready: new empty sessions, both branches at step zero, paid API calls: 0.');
}
const alive=port=>new Promise(resolve=>{const s=net.connect(port,'127.0.0.1');s.once('connect',()=>{s.destroy();resolve(true)});s.once('error',()=>resolve(false));setTimeout(()=>{s.destroy();resolve(false)},500)});
async function launch(){
const occupied=await Promise.all(ports.map(alive));
if(occupied.some(Boolean)){
 let own=false;try{const h=await fetch('http://127.0.0.1:4201/health',{signal:AbortSignal.timeout(2000)}).then(r=>r.json());own=h.app==='opencode-agent-lab'&&path.resolve(h.root)===root;}catch{}
 if(own&&occupied.every(Boolean)){await freshPair();openTabs();console.log((fresh?'Both branches reset.':'Already running. Progress preserved. For a new recording use «Начать оба с нуля» in /parallel.')+'\n'+urls.join('\n'));return;}
 throw new Error(own?'The previous launch is incomplete. Run npm stop, then npm start.':'A required port is occupied by another process. Use npm run doctor; do not stop unrelated services.');
}
try{
const reset=spawnSync(process.execPath,[path.join(root,'tools/reset.mjs')],{cwd:root,stdio:'inherit'});
if(reset.status!==0)throw new Error('Could not prepare clean workspaces.');
const setup=JSON.parse(fs.readFileSync(path.join(root,'data/live-preparation.json'),'utf8'));
const logs=path.join(root,'.runtime','logs');fs.mkdirSync(logs,{recursive:true});
const jobs=[['console',process.execPath,[path.join(root,'tools/checkpoint-console.mjs')]]];
for(const p of setup.profiles){
 jobs.push([p.profile+'-app',process.execPath,[path.join(root,'tools/static-server.mjs'),path.join(p.workspace,'dist'),String(p.appPort)]]);
 jobs.push([p.profile+'-opencode',setup.executable,['serve','--hostname','127.0.0.1','--port',String(p.agentPort)]]);
}
const services=[];
const serviceState=path.join(root,'.runtime/services.json');
const persist=()=>fs.writeFileSync(serviceState,JSON.stringify({startedAt:new Date().toISOString(),root,services},null,2)+'\n');
const env={...process.env,PATH:path.dirname(process.execPath)+path.delimiter+(process.env.PATH||''),XDG_DATA_HOME:path.join(root,'.runtime/opencode-data'),XDG_CONFIG_HOME:path.join(root,'.runtime/opencode-config'),XDG_CACHE_HOME:path.join(root,'.runtime/opencode-cache')};
function start(name,bin,args){
 const out=fs.openSync(path.join(logs,name+'.log'),'a');
 const child=spawn(bin,args,{cwd:name.includes('opencode')?setup.profiles.find(p=>name.startsWith(p.profile)).workspace:root,env,detached:true,windowsHide:true,stdio:['ignore',out,out]});services.push({name,pid:child.pid,executable:bin,startedAt:Date.now()});child.unref();fs.closeSync(out);persist();
}
for(const job of jobs){
 start(...job);
 if(job[0].endsWith('-opencode')){
  const p=setup.profiles.find(p=>job[0].startsWith(p.profile)),limit=Date.now()+45000;
  while(Date.now()<limit&&!await alive(p.agentPort))await new Promise(r=>setTimeout(r,250));
  if(!await alive(p.agentPort))throw new Error(job[0]+' did not start. See .runtime/logs.');
 }
}
const basePorts=[4096,4097,4191,4192,4201],baseDeadline=Date.now()+45000;
while(Date.now()<baseDeadline){if((await Promise.all(basePorts.map(alive))).every(Boolean))break;await new Promise(r=>setTimeout(r,300));}
if(!(await Promise.all(basePorts.map(alive))).every(Boolean))throw new Error('Base services did not start. See .runtime/logs.');
start('assist',process.execPath,[path.join(root,'tools/opencode-demo-assist.mjs')]);
persist();
const deadline=Date.now()+15000;
while(Date.now()<deadline){if((await Promise.all(ports.map(alive))).every(Boolean))break;await new Promise(r=>setTimeout(r,300));}
if(!(await Promise.all(ports.map(alive))).every(Boolean))throw new Error('Services did not start. See .runtime/logs.');
await freshPair();openTabs();
console.log(urls.join('\n'));
}catch(error){spawnSync(process.execPath,[path.join(root,'tools/stop.mjs')],{cwd:root,stdio:'inherit'});throw error;}
}
await launch();


