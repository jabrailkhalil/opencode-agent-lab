import test from 'node:test';
import assert from 'node:assert/strict';
import {ReplayGate} from '../tools/replay-gate.mjs';
function fixture(){
 const cursors={claude:{checkpoint:'qspec-00',version:'v1',epoch:'run-1',sessionId:'ses_left'},qwen:{checkpoint:'flash-02',version:'r1',epoch:'run-1',sessionId:'ses_right'}};
 const next={claude:{id:'qspec-01',role:'analyst',prompt:'Проверь требования.'},qwen:{id:'flash-03',role:'analyst',prompt:'Подготовь анализ.'}};
 const gate=new ReplayGate(p=>cursors[p],p=>next[p]);
 const prepare=p=>gate.prepare(p,{sessionId:cursors[p].sessionId,version:cursors[p].version,checkpoint:next[p].id});
 const request=p=>({agent:next[p].role,model:{providerID:'demo-recording',modelID:p+'-recording'},parts:[{type:'text',text:next[p].prompt}]});
 return {gate,cursors,next,prepare,request};
}
test('one prepared draft can advance only once; repeated prepare is idempotent',()=>{
 const {gate,prepare,request}=fixture();const intent=prepare('claude');assert.equal(prepare('claude').id,intent.id);
 gate.claim('claude','ses_left',request('claude'));assert.throws(()=>gate.claim('claude','ses_left',request('claude')));
 assert.throws(()=>prepare('claude'));gate.authorize('claude','analyst','Проверь требования.');assert.throws(()=>gate.authorize('claude','analyst','Проверь требования.'));
 gate.finish('claude',intent.id);assert.equal(gate.active('claude'),false);
});
test('unprepared submission and old sessions cannot use a current intent',()=>{
 const {gate,prepare,request}=fixture();assert.throws(()=>gate.claim('claude','ses_left',request('claude')));prepare('claude');
 assert.throws(()=>gate.claim('claude','ses_old',request('claude')));assert.equal(gate.peek('claude').status,'prepared');
});
test('wrong role, model, task and attachments never consume a prepared draft',()=>{
 const {gate,prepare,request}=fixture();prepare('claude');
 for(const change of [r=>r.agent='tester',r=>r.model.modelID='qwen-recording',r=>r.parts[0].text='Привет',r=>r.parts.push({type:'file',url:'file:///old.md'})]){
  const r=request('claude');change(r);assert.throws(()=>gate.claim('claude','ses_left',r));assert.equal(gate.peek('claude').status,'prepared');
 }
});
test('checkpoint version and run epoch invalidate old drafts',()=>{
 for(const key of ['version','epoch','sessionId']){const {gate,prepare,request,cursors}=fixture();prepare('claude');cursors.claude[key]='changed';assert.throws(()=>gate.claim('claude','ses_left',request('claude')),key);}
});
test('sending the left branch leaves a previously prepared right branch untouched',()=>{
 const {gate,prepare,request}=fixture();prepare('qwen');prepare('claude');gate.claim('claude','ses_left',request('claude'));gate.authorize('claude','analyst','Проверь требования.');
 assert.equal(gate.peek('qwen').status,'prepared');assert.equal(gate.active('qwen'),false);
});
test('reset and incomplete reset block both preparation and submission',()=>{
 const {gate,prepare,request}=fixture();prepare('claude');gate.resetting=true;assert.throws(()=>prepare('qwen'));assert.throws(()=>gate.claim('claude','ses_left',request('claude')));
 gate.resetting=false;gate.resetError='Сброс не завершён';assert.throws(()=>prepare('qwen'));assert.throws(()=>gate.claim('claude','ses_left',request('claude')));
});
