import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createReplayControl} from '../tools/replay-control.mjs';
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'replay-control-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'data'));fs.writeFileSync(path.join(root,'data/workshop.json'),JSON.stringify({presentation:{leftRun:'left',rightRun:'right'},runs:['claude','qwen'].map((p,i)=>({id:i?'right':'left',profile:p,label:p,stages:[{id:p+'-00',role:'operator'},{id:p+'-01',role:'analyst',prompt:'Анализ'}]}))}));
 const stateFile=path.join(root,'state.json');let data=Object.fromEntries(['claude','qwen'].map(p=>[p,{checkpoint:p+'-00',epoch:'old',version:p+'-v1',sessionId:'ses_'+p}]));let count=0,failApply=false,busy=false;
 const control=createReplayControl({root,state:()=>structuredClone(data),stateFile,target:p=>{assert.ok(['claude','qwen'].includes(p));return {};},validate:()=>{},engine:async(p,route)=>route==='/session/status'?(busy?{ses_busy:{type:'busy'}}:{}):{id:'ses_new'+(++count)},apply:async(p,id,o)=>{if(failApply)throw Error('disk write failed');data[p]={checkpoint:id,version:'v'+(++count),epoch:o.epoch,sessionId:o.sessionId};return data[p];}});
 return {control,current:()=>data,fail:()=>failApply=true,recover:()=>failApply=false,setBusy:v=>busy=v};
}
test('reset while a submitted request waits does not poison its authorization',async t=>{
 const {control,current}=fixture(t),c=current().claude;
 control.gate.prepare('claude',{sessionId:c.sessionId,version:c.version,checkpoint:'claude-01'});
 control.gate.claim('claude',c.sessionId,{agent:'analyst',model:{providerID:'demo-recording',modelID:'claude-recording'},parts:[{type:'text',text:'Анализ'}]});
 await assert.rejects(control.reset({requestId:'busy'}));assert.equal(control.gate.resetError,'');assert.equal(control.gate.resetting,false);
 assert.doesNotThrow(()=>control.gate.authorize('claude','analyst','Анализ'));
});
test('busy engine preflight leaves the previous run usable',async t=>{
 const {control,setBusy}=fixture(t);setBusy(true);await assert.rejects(control.reset());assert.equal(control.gate.resetError,'');setBusy(false);await control.reset();
});
test('idempotent reset creates one fresh pair and clears prepared drafts',async t=>{
 const {control,current}=fixture(t),old=structuredClone(current());
 const a=await control.reset({requestId:'same'}),b=await control.reset({requestId:'same'});assert.deepEqual(a,b);
 assert.equal(a.records.claude.epoch,a.records.qwen.epoch);assert.notEqual(a.records.claude.sessionId,old.claude.sessionId);assert.notEqual(a.records.qwen.sessionId,old.qwen.sessionId);
 assert.equal(control.gate.peek('claude'),null);
});
test('failed file restoration blocks sends until a successful recovery reset',async t=>{
 const {control,fail,recover}=fixture(t);fail();await assert.rejects(control.reset());assert.match(control.gate.resetError,/disk write failed/);recover();await control.reset();assert.equal(control.gate.resetError,'');
});
