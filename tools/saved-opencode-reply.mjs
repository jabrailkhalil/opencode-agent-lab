import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {nextPrompt,roleLabels,recordedPromptSteps} from '../ui/demo-flow.js';

const replies=new Map();
const pending=new Map();

export function expectedRecordedCheckpoint(catalog,profile,current){
 if(current==='ui-review-before')return catalog.find(p=>p.id==='ui-review-after');
 if(/^error-0[1-4]-before$/.test(current||''))return catalog.find(p=>p.id===current.replace('-before','-after'));
 if(current?.startsWith('error-')||current==='ui-review-after')return null;
 const next=nextPrompt(profile,current||profile+'-00');
 return next?catalog.find(p=>p.id===next.id):null;
}

export function selectRecordedCheckpoint(catalog,profile,current,role){
 const next=expectedRecordedCheckpoint(catalog,profile,current);
 return next?.role===role?next:null;
}

export async function savedOpenCodeReply(req,res,url,context){
 if(!url.pathname.startsWith('/v1/'))return false;
 const models=[{id:'claude-recording',name:'Claude Sonnet 5.5 · запись'},{id:'qwen-recording',name:'Qwen 3.8 Flash · запись'}];
 const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 try{
  if(url.pathname==='/v1/models'&&req.method==='GET'){json(200,{object:'list',data:models.map(m=>({id:m.id,object:'model',owned_by:'local-recording'}))});return true;}
  if(url.pathname!=='/v1/chat/completions'||req.method!=='POST'){json(404,{error:{message:'Локальный сервер поддерживает только сохранённые ответы.'}});return true;}
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4*1024*1024)throw new Error('Слишком большой контекст');}
  const request=JSON.parse(raw),profile=request.model==='claude-recording'?'claude':request.model==='qwen-recording'?'qwen':null;
  if(!profile)throw new Error('Неизвестная модель записи');
  const content=m=>typeof m.content==='string'?m.content:(m.content||[]).filter(p=>p.type==='text').map(p=>p.text).join('\n');
  const system=(request.messages||[]).filter(m=>m.role==='system'||m.role==='developer').map(content).join('\n');
  const marker=system.match(/\[DEMO_ROLE=(analyst|designer|developer|tester)\]/);
  let output,checkpoint=null;
  if(!marker){
   output=/title|заголовок|название сессии/i.test(system)?'Демо: сохранённый этап':'Сохранённый прогон. Выбери Analyst, Designer, Developer или Tester.';
  }else{
   const role=marker[1],fingerprint=crypto.createHash('sha256').update(context.root+JSON.stringify(request.messages)+request.model).digest('hex');
   if(pending.has(fingerprint))await pending.get(fingerprint);
   const current=context.state()[profile],cached=replies.get(fingerprint);
   if(cached&&cached.version===current?.version&&cached.checkpoint===current?.checkpoint){output=cached.output;checkpoint=cached.checkpoint;}
   else{
    const next=expectedRecordedCheckpoint(context.catalog,profile,current?.checkpoint);
    const lastUser=(request.messages||[]).filter(m=>m.role==='user').at(-1);
    const task=content(lastUser||{}),requested=task.match(/\[Шаг:\s*([a-z0-9-]+)\]/)?.[1];
    // Support old conversations, but new drafts contain just the task. Match
    // known tasks internally so resending an earlier task cannot skip a step.
    const taskSteps=recordedPromptSteps(profile,task.replace(/\s*\[Шаг:\s*[a-z0-9-]+\]\s*$/,''));
    if(!next)output='Прогон завершён. Итоговые материалы доступны в пульте. Для повторения нажми «Начать с нуля». Для новой задачи нужен режим живого API.';
    else if(next.role!==role||(requested&&requested!==next.id)||(taskSteps.length&&!taskSteps.includes(next.id)))output='Этап не изменён. Следующий шаг: '+next.id+' — '+(roleLabels[next.role]||next.role)+'. Выбери эту роль и отправь промпт этого шага из сценария.';
    else{
     let release;pending.set(fingerprint,new Promise(resolve=>{release=resolve;}));
     try{
      checkpoint=next.id;
      await context.apply(profile,next.id,{recordedReply:true});
      const point=context.pointData(next,profile);
      output=point.output||point.description||'Этап восстановлен.';
      if(point.kind==='prepared-error')output='Подготовленная сцена · '+point.id+'\n\n'+output;
      replies.set(fingerprint,{output,checkpoint,version:context.state()[profile]?.version});
     }finally{pending.delete(fingerprint);release();}
    }
   }
  }
  const event={at:new Date().toISOString(),profile,role:marker?.[1]||'service',checkpoint,model:request.model,paidApiCalls:0};
  fs.appendFileSync(path.join(context.root,'data/opencode-recording-events.jsonl'),JSON.stringify(event)+'\n');
  const id='chatcmpl-recording-'+crypto.randomBytes(8).toString('hex'),created=Math.floor(Date.now()/1000),usage={prompt_tokens:0,completion_tokens:0,total_tokens:0};
  if(!request.stream){json(200,{id,object:'chat.completion',created,model:request.model,choices:[{index:0,message:{role:'assistant',content:output},finish_reason:'stop'}],usage});return true;}
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache','Connection':'keep-alive'});
  const send=(delta,finish_reason=null,extra={})=>res.write('data: '+JSON.stringify({id,object:'chat.completion.chunk',created,model:request.model,choices:[{index:0,delta,finish_reason}],...extra})+'\n\n');
  send({role:'assistant',content:''});
  for(let offset=0;offset<output.length;offset+=600)send({content:output.slice(offset,offset+600)});
  send({},'stop',{usage});res.end('data: [DONE]\n\n');return true;
 }catch(error){json(400,{error:{message:error.message,type:'recording_error'}});return true;}
}
