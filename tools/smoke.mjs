import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const base='http://127.0.0.1:4201',origins={claude:'http://127.0.0.1:4216',qwen:'http://127.0.0.1:4217'},full=process.argv.includes('--full');
async function call(url,body){const r=await fetch(url,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const text=await r.text(),value=text?JSON.parse(text):null;return {status:r.status,value};}
async function ok(url,body){const r=await call(url,body);assert.ok(r.status<300,JSON.stringify(r));return r.value;}
const reset=()=>ok(base+'/api/replay/reset',{requestId:crypto.randomUUID()});
const next=p=>ok(origins[p]+'/__demo/next');
const body=(p,s)=>({agent:s.next.role,model:{providerID:'demo-recording',modelID:p+'-recording'},parts:[{type:'text',text:s.next.prompt}]});
const submit=(p,s)=>call(origins[p]+'/session/'+s.sessionId+'/prompt_async',body(p,s));
async function prepare(p,s){return ok(origins[p]+'/__demo/prepare',{sessionId:s.sessionId,version:s.version,checkpoint:s.next.id});}
async function waitFor(p,id){const until=Date.now()+30000;while(Date.now()<until){const s=await next(p);if(s.current===id&&!s.busy)return s;await new Promise(r=>setTimeout(r,150));}throw Error(p+' did not reach '+id);}
const transitions=[];
try{
 const requestId=crypto.randomUUID(),original=await reset(),same=await ok(base+'/api/replay/reset',{requestId}),repeated=await ok(base+'/api/replay/reset',{requestId});
 assert.equal(same.epoch,repeated.epoch);assert.notEqual(original.epoch,same.epoch);
 let states=Object.fromEntries(await Promise.all(Object.keys(origins).map(async p=>[p,await next(p)])));
 const oldStates=structuredClone(states);
 for(const p of Object.keys(origins)){assert.equal((await submit(p,states[p])).status,409);assert.notEqual(states[p].sessionId,original.records[p].sessionId);}
 await prepare('qwen',states.qwen);await prepare('claude',states.claude);
 assert.equal((await submit('claude',states.claude)).status,204);
 assert.equal((await submit('claude',states.claude)).status,409);
 await waitFor('claude',states.claude.next.id);
 const rightStill=await next('qwen');assert.equal(rightStill.current,states.qwen.current);assert.equal(rightStill.intent.status,'prepared');
 transitions.push({profile:'claude',from:states.claude.current,to:states.claude.next.id});
 assert.equal((await submit('qwen',states.qwen)).status,204);await waitFor('qwen',states.qwen.next.id);
 transitions.push({profile:'qwen',from:states.qwen.current,to:states.qwen.next.id});
 if(full){
  for(let round=0;round<30;round++){
   states=Object.fromEntries(await Promise.all(Object.keys(origins).map(async p=>[p,await next(p)])));
   const ready=Object.keys(origins).filter(p=>states[p].next);if(!ready.length)break;
   await Promise.all(ready.map(p=>prepare(p,states[p])));
   const sent=await Promise.all(ready.map(p=>submit(p,states[p])));sent.forEach(r=>assert.equal(r.status,204));
   await Promise.all(ready.map(p=>waitFor(p,states[p].next.id)));
   ready.forEach(p=>transitions.push({profile:p,from:states[p].current,to:states[p].next.id}));
  }
  for(const p of Object.keys(origins))assert.equal((await next(p)).next,null,p+' must finish');
 }
 const fresh=await reset();
 for(const p of Object.keys(origins)){
  const s=await next(p);assert.equal(s.next.number,1);assert.equal(s.intent,null);assert.equal(s.busy,false);
  assert.equal((await submit(p,oldStates[p])).status,409,'old chat cannot submit after reset');
  const messages=await ok(origins[p]+'/session/'+fresh.records[p].sessionId+'/message');assert.equal(messages.length,0,'new session must be empty');
 }
 console.log(JSON.stringify({full,transitions,duplicateBlocked:true,oldSessionBlocked:true,singleSendIsolated:true,resetCreatesEmptyChats:true,paidApiCalls:0}));
}finally{await reset();}
