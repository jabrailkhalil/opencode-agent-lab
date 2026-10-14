import crypto from 'node:crypto';

// A prepared draft belongs to exactly one session and one checkpoint version.
// UI readiness alone never authorizes an additional submission.
export class ReplayGate {
 constructor(cursor,next){this.cursor=cursor;this.next=next;this.intents=new Map();this.resetting=false;this.resetError='';}
 clear(profile){this.intents.delete(profile);}
 peek(profile){const i=this.intents.get(profile);return i?{id:i.id,epoch:i.epoch,version:i.version,sessionId:i.sessionId,checkpoint:i.checkpoint,status:i.status}:null;}
 prepare(profile,expected){
  if(this.resetting||this.resetError)throw Error(this.resetError||'Подождите завершения общего сброса.');
  const c=this.cursor(profile),n=this.next(profile);
  if(!c?.sessionId||expected.sessionId!==c.sessionId||expected.version!==c.version||expected.checkpoint!==n?.id)throw Error('Чат или этап изменился. Откройте текущий чат и вставьте задание заново.');
  const old=this.intents.get(profile);
  if(old&&['claimed','processing'].includes(old.status))throw Error('Задание уже отправлено. Дождитесь ответа.');
  if(old?.status==='prepared'&&old.version===c.version&&old.sessionId===c.sessionId)return this.peek(profile);
  this.intents.set(profile,{id:crypto.randomUUID(),epoch:c.epoch,version:c.version,current:c.checkpoint,checkpoint:n.id,sessionId:c.sessionId,role:n.role,prompt:n.prompt,status:'prepared'});
  return this.peek(profile);
 }
 claim(profile,sessionId,request){
  if(this.resetting||this.resetError)throw Error(this.resetError||'Идёт сброс прогона.');
  const c=this.cursor(profile),i=this.intents.get(profile);
  if(!i||i.status!=='prepared')throw Error('Задание уже отправлено или не подготовлено. Нажмите «Вставить промпт» для текущего этапа.');
  if(sessionId!==c?.sessionId||sessionId!==i.sessionId||i.epoch!==c.epoch||i.version!==c.version)throw Error('Это старый чат или черновик. Откройте текущий прогон.');
  const parts=request.parts||[],text=parts.filter(p=>p.type==='text').map(p=>p.text).join('');
  if(parts.some(p=>p.type!=='text')||text!==i.prompt||request.agent!==i.role||request.model?.providerID!=='demo-recording'||request.model?.modelID!==profile+'-recording')throw Error('Промпт, роль или модель отличаются от подготовленного этапа. Вставьте задание заново.');
  i.status='claimed';return {...i};
 }
 authorize(profile,role,prompt){
  const c=this.cursor(profile),i=this.intents.get(profile);
  if(this.resetting||this.resetError||!i||i.status!=='claimed'||i.epoch!==c?.epoch||i.version!==c.version||i.sessionId!==c.sessionId||i.role!==role||i.prompt!==prompt)throw Error('Нет одноразового разрешения для этого этапа. Подготовьте промпт в текущем окне OpenCode.');
  i.status='processing';return {...i};
 }
 finish(profile,id,failed=false){const i=this.intents.get(profile);if(i?.id===id)i.status=failed?'failed':'completed';}
 active(profile){return ['claimed','processing'].includes(this.intents.get(profile)?.status);}
}
