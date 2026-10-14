import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const exp=import.meta.dirname,root=path.dirname(exp),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const configs=read(path.join(exp,'runs.json')),labels={'sonnet-spec':'Sonnet + OpenSpec','sonnet-direct':'Sonnet · прямые задания','qwen-direct':'Qwen 3.8 Flash · прямые задания'};
let catalog=read(path.join(root,'data/checkpoints.json')).filter(p=>!configs.some(r=>p.id.startsWith(r.prefix+'-')));
const runs=[];
for(const cfg of configs){
 const art=path.join(exp,cfg.id),stages=fs.existsSync(path.join(art,'stages.json'))?read(path.join(art,'stages.json')):[];
 for(const s of stages){
  const src=path.join(art,'snapshots',s.id),dest=path.join(root,'checkpoints',s.id);fs.cpSync(src,dest,{recursive:true});
  const manifest=read(path.join(dest,'manifest.json'));const screenshots=[];
  for(const entry of fs.readdirSync(path.join(dest,'screenshots'))){if(!/\.(png|jpg|webp)$/.test(entry))continue;const b=fs.readFileSync(path.join(dest,'screenshots',entry));screenshots.push({path:entry,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}
  manifest.screenshots=screenshots;fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2));
  s.screenshots=screenshots.map(s=>s.path);s.files=manifest.files.map(f=>f.path).filter(f=>!f.startsWith('dist/vendor/'));
  const report=s.role==='analyst'?(/Итог/.test(s.title)?'FINAL.md':'ANALYSIS.md'):s.role==='designer'?(/Проверка/.test(s.title)?'DESIGN-REVIEW.md':'DESIGN-PLAN.md'):s.role==='developer'?'DEVELOPMENT.md':s.role==='tester'?'QA-RESULTS.md':null;
  s.report=report&&s.files.includes('reports/'+report)?'reports/'+report:null;
  catalog.push({id:s.id,group:cfg.profile,role:s.role,title:s.title,kind:'recorded',application:s.application,message:s.output,specification:s.prompt,recordedElapsedMs:s.elapsedMs,description:labels[cfg.id],report:s.report});
 }
 const pricing=fs.existsSync(path.join(art,'pricing.json'))?read(path.join(art,'pricing.json')).pricing:null;
 const metrics=fs.existsSync(path.join(art,'metrics.json'))?read(path.join(art,'metrics.json')):null;
 if(metrics&&pricing){
  const recovery=fs.existsSync(path.join(art,'recovery.json'))?read(path.join(art,'recovery.json')):null;
  const visible=recovery?stages.slice(recovery.firstNewStage):stages;
  metrics.developerReturns=Math.max(0,visible.filter(s=>s.role==='developer').length-1);
  metrics.testerRounds=visible.filter(s=>s.role==='tester').length;
  metrics.completedRoleCalls=stages.filter(s=>s.role!=='operator').length;
  metrics.recoveryStages=recovery?recovery.firstNewStage:0;
  metrics.outsideStageMs=Math.max(0,metrics.elapsedMs-metrics.machineStageMs);
  const latestReport=[...stages].reverse().find(s=>s.files?.includes('reports/acceptance.txt'));
  if(latestReport){const report=fs.readFileSync(path.join(root,'checkpoints',latestReport.id,'code/reports/acceptance.txt'),'utf8');const passed=report.match(/(?:#|ℹ)\s+pass\s+(\d+)/),failed=report.match(/(?:#|ℹ)\s+fail\s+(\d+)/);if(passed&&failed)metrics.domainTests={passed:Number(passed[1]),failed:Number(failed[1])};}
  metrics.uncachedUsd=metrics.promptTokens*Number(pricing.prompt)+metrics.completionTokens*Number(pricing.completion)+metrics.requests*Number(pricing.request||0);
  const logs=fs.readFileSync(path.join(art,'logs/api-requests.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)).filter(r=>r.model===cfg.model&&!r.rejected);const seconds=logs.reduce((n,r)=>n+r.durationMs,0)/1000;metrics.apiSeconds=seconds;metrics.outputTokensPerApiSecond=seconds?metrics.completionTokens/seconds:null;
  const first=logs.map(r=>r.firstContentMs).filter(Number.isFinite).sort((a,b)=>a-b);metrics.medianFirstContentMs=first.length?first[Math.floor(first.length/2)]:null;
 }
 const visual=fs.existsSync(path.join(art,'visual-checks.json'))?read(path.join(art,'visual-checks.json')):null;
 const recovery=fs.existsSync(path.join(art,'recovery.json'))?read(path.join(art,'recovery.json')):null;
 const cfgPath=path.join(cfg.workspace,fs.existsSync(path.join(cfg.workspace,'opencode.measurement-proxy.json'))?'opencode.measurement-proxy.json':'opencode.json');
 const actualRoles=fs.existsSync(cfgPath)?Object.entries(read(cfgPath).agent||{}).map(([name,a])=>({name,model:a.model,steps:a.steps,prompt:a.prompt,mode:a.mode})):[];
 runs.push({...cfg,label:labels[cfg.id],roles:actualRoles,stages:recovery?stages.slice(recovery.firstNewStage):stages,earlierStages:recovery?stages.slice(0,recovery.firstNewStage):[],pricing,metrics,visual});
}
const roleReviews=fs.existsSync(path.join(exp,'role-reviews.json'))?read(path.join(exp,'role-reviews.json')):[];
const workshop={version:'2026-10-11',updatedAt:new Date().toISOString(),protocol:read(path.join(exp,'protocol.json')),runs,roleReviews};
fs.writeFileSync(path.join(root,'data/checkpoints.json'),JSON.stringify(catalog,null,2));
fs.writeFileSync(path.join(root,'data/workshop.json'),JSON.stringify(workshop,null,2));
fs.writeFileSync(path.join(root,'ui/workshop-flow.js'),'// Generated from actual recorded role calls.\nexport const workshopStreams='+JSON.stringify(Object.fromEntries(runs.map(r=>[r.id,{profile:r.profile,steps:r.stages.map(s=>({id:s.id,role:s.role,prompt:s.prompt,title:s.title,type:s.role==='operator'?'view':'prompt'}))}])) ,null,2)+';\n');
console.log(JSON.stringify(runs.map(r=>({run:r.id,stages:r.stages.length,complete:!!r.metrics}))));
