import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {ReplayGate} from './replay-gate.mjs';
import {nextAssignment} from './opencode-demo-assist.mjs';

export function createReplayControl({root,state,stateFile,target,catalog,apply,validate}){
 const workshop=()=>JSON.parse(fs.readFileSync(path.join(root,'data/workshop.json'),'utf8'));
 const gate=new ReplayGate(p=>state()[p],p=>nextAssignment(workshop(),state(),p).next);
 const creating=new Map(),resets=new Map();
 async function engine(profile,route,body){const {plan,workspace}=target(profile);const r=await fetch('http://127.0.0.1:'+plan.agentPort+route,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-opencode-directory':encodeURIComponent(workspace)},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('OpenCode: '+r.status);return r.json();}
 async function isIdle(profiles){for(const p of profiles){const statuses=await engine(p,'/session/status');if(gate.active(p)||Object.values(statuses).some(s=>s.type&&s.type!=='idle'))throw Error('Агент отвечает. Дождитесь завершения, затем начните новый прогон.');}}
 const write=records=>fs.writeFileSync(stateFile,JSON.stringify(records,null,2)+'\n');
 async function session(profile){
  if(gate.resetting||gate.resetError)throw Error(gate.resetError||'Идёт сброс прогона.');
  const existing=state()[profile];if(existing?.sessionId)return existing;
  if(creating.has(profile))return creating.get(profile);
  const task=(async()=>{await isIdle([profile]);const before=state()[profile],label=nextAssignment(workshop(),state(),profile).label;const s=await engine(profile,'/session',{title:label||'Сохранённый прогон'});const all=state();if(all[profile].version!==before.version)throw Error('Этап изменился при открытии чата. Повторите открытие.');all[profile]={...before,epoch:before.epoch||crypto.randomUUID(),sessionId:s.id};write(all);return all[profile];})();
  creating.set(profile,task);try{return await task;}finally{creating.delete(profile);}
 }
 async function reset(body={}){
  const requestId=body.requestId||crypto.randomUUID();if(resets.has(requestId))return resets.get(requestId);
  if(gate.resetting)throw Error('Другой сброс уже выполняется.');
  const plans=body.profiles?.length?body.profiles.map(p=>({profile:p.profile,checkpoint:p.checkpoint})):['claude','qwen'].map(profile=>{const w=workshop(),r=w.runs.find(r=>r.profile===profile&&r.stages.some(s=>s.id===state()[profile]?.checkpoint))||w.runs.find(r=>r.id===w.presentation[profile==='claude'?'leftRun':'rightRun']);return {profile,checkpoint:r.stages[0].id};});
  if(!plans.length||plans.length>2||new Set(plans.map(p=>p.profile)).size!==plans.length)throw Error('Недопустимые ветки для сброса.');
  for(const p of plans){target(p.profile);validate(p.profile,p.checkpoint);}
  gate.resetting=true;
  const task=(async()=>{
   try{
    await isIdle(plans.map(p=>p.profile));const epoch=crypto.randomUUID(),fresh=[];
    for(const p of plans){const label=workshop().runs.find(r=>r.stages.some(s=>s.id===p.checkpoint))?.label;fresh.push({...p,session:await engine(p.profile,'/session',{title:(label||p.profile)+' · новый прогон'})});}
    const records={};
    for(const p of fresh){records[p.profile]=await apply(p.profile,p.checkpoint,{internalReset:true,epoch,sessionId:p.session.id});gate.clear(p.profile);}
    gate.resetError='';return {records,epoch,apiCalls:0};
   }catch(error){gate.resetError='Сброс не завершён: '+error.message+' Повторите «Новый прогон». До этого отправка заблокирована.';throw error;}
   finally{gate.resetting=false;}
  })();resets.set(requestId,task);while(resets.size>20)resets.delete(resets.keys().next().value);return task;
 }
 async function handle(req,res,url){
  if(!url.pathname.startsWith('/api/replay/'))return false;
  const json=(code,value)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));};
  try{
   if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:4201')throw Error('Запрос не из локального пульта.');
   if(req.method==='GET'&&url.pathname==='/api/replay/status'){const profile=url.searchParams.get('profile');if(profile)target(profile);json(200,{resetting:gate.resetting,error:gate.resetError,current:profile?state()[profile]:state(),intent:profile?gate.peek(profile):null});return true;}
   if(req.method!=='POST')throw Error('Нужен POST.');
   let raw='';for await(const c of req){raw+=c;if(raw.length>4*1024*1024)throw Error('Слишком большой запрос.');}const body=JSON.parse(raw||'{}');
   if(url.pathname==='/api/replay/reset')json(200,await reset(body));
   else if(url.pathname==='/api/replay/session')json(200,await session(body.profile));
   else if(url.pathname==='/api/replay/prepare'){await isIdle([body.profile]);json(200,gate.prepare(body.profile,body));}
   else if(url.pathname==='/api/replay/claim'){target(body.profile);json(200,gate.claim(body.profile,body.sessionId,body.request));}
   else if(url.pathname==='/api/replay/failed'){gate.finish(body.profile,body.id,true);json(200,{ok:true});}
   else json(404,{error:'Неизвестная команда.'});
  }catch(error){json(409,{error:error.message});}
  return true;
 }
 return {gate,reset,session,handle};
}
