import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bindRolePaths} from './role-path-permissions.mjs';
import {openCodeExecutable} from './runtime-platform.mjs';
import crypto from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=path.join(root,'.runtime');
const workspaces=path.join(runtime,'workspaces');
const workshop=JSON.parse(fs.readFileSync(path.join(root,'data/workshop.json'),'utf8'));
const plans=[
  {profile:'claude',template:'qwen-spec',source:'qspec-00',model:'qwen/qwen3.8-flash',name:'Qwen 3.8 Flash + OpenSpec',agentPort:4096,appPort:4191},
  {profile:'qwen',template:'qwen-direct',source:'flash-02',model:'qwen/qwen3.8-flash',name:'Qwen 3.8 Flash — direct prompts',agentPort:4097,appPort:4192}
];
fs.mkdirSync(workspaces,{recursive:true});
for(const plan of plans){
  const workspace=path.join(workspaces,plan.profile);
  if(fs.existsSync(workspace)){
    const archive=path.join(runtime,'previous-workspaces',Date.now()+'-'+plan.profile);
    fs.mkdirSync(path.dirname(archive),{recursive:true});fs.renameSync(workspace,archive);
  }
  fs.cpSync(path.join(root,'templates',plan.template),workspace,{recursive:true});
  const original=JSON.parse(fs.readFileSync(path.join(workspace,'opencode.json'),'utf8'));
  const model=plan.profile+'-recording';
  original.provider={'demo-recording':{npm:'@ai-sdk/openai-compatible',name:'Saved run · local',options:{baseURL:'http://127.0.0.1:4201/v1',apiKey:'local-recording',timeout:60000},models:{[model]:{name:plan.name+' · recording',limit:{context:1000000,output:32768},cost:{input:0,output:0},tool_call:true}}}};
  original.enabled_providers=['demo-recording'];
  original.model='demo-recording/'+model;
  original.small_model=original.model;
  original.share='disabled';
  for(const [role,agent] of Object.entries(original.agent||{})){
    agent.model=original.model;
    const marker='[DEMO_ROLE='+role+']\n';
    agent.prompt=marker+String(agent.prompt||'').replace(/^\[DEMO_ROLE=[a-z]+\]\r?\n/,'');
  }
  bindRolePaths(original,workspace);
  fs.writeFileSync(path.join(workspace,'opencode.json'),JSON.stringify(original,null,2)+'\n');
  fs.mkdirSync(path.join(workspace,'artifacts'),{recursive:true});
}
const executable=openCodeExecutable(root);
const setup={createdAt:new Date().toISOString(),nodeExecutable:process.execPath,executable,profiles:plans.map(p=>({...p,workspace:path.join(workspaces,p.profile),openCodeMode:'recording'}))};
fs.writeFileSync(path.join(root,'data/live-preparation.json'),JSON.stringify(setup,null,2)+'\n');
const epoch=crypto.randomUUID();
fs.writeFileSync(path.join(root,'data/checkpoint-console-state.json'),JSON.stringify({claude:{checkpoint:plans[0].source,version:epoch,epoch,sessionId:null},qwen:{checkpoint:plans[1].source,version:epoch,epoch,sessionId:null}},null,2)+'\n');
fs.writeFileSync(path.join(root,'data/opencode-recording-events.jsonl'),'');
console.log('Reset complete: '+plans.map(p=>p.source).join(' / '));

