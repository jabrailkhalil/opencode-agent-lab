import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {bindRolePaths} from '../tools/role-path-permissions.mjs';
const root=path.resolve(import.meta.dirname,'..'), exp=import.meta.dirname;
const node='/home/demo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe';
const cli=path.join(exp,'node_modules/@fission-ai/openspec/bin/openspec.js');
const source=path.join(root,'checkpoints/claude-00/code');
const roles=['analyst','designer','developer','tester'];
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2));};
const runs=[
 {id:'sonnet-spec',prefix:'sdd',profile:'claude',model:'anthropic/claude-sonnet-5.5',spec:true,port:4106,proxyPort:4186,appPort:4211,budgetUsd:8},
 {id:'sonnet-direct',prefix:'direct',profile:'claude',model:'anthropic/claude-sonnet-5.5',spec:false,port:4107,proxyPort:4187,appPort:4212,budgetUsd:6},
 {id:'qwen-direct',prefix:'flash',profile:'qwen',model:'qwen/qwen3.8-flash',spec:false,port:4108,proxyPort:4188,appPort:4213,budgetUsd:3}
];
const brief=fs.readFileSync(path.join(source,'docs/SPEC.md'),'utf8').replace(/Это первый полный замер[^\n]*?Код предыдущего приложения использовать нельзя:/,'Код предыдущего приложения использовать нельзя:').replace(/Работающий сервис:[\s\S]*$/,'Результат: dist/index.html, styles.css, app.js, domain.js. Статический сервер подготовлен. Используй локальный Tabler, без npm install, внешних ресурсов, backend и авторизации. Публичный интерфейс и testid описаны в docs/INTERFACES.md. Бриф, данные, интерфейсы и девять тестов одинаковы для всех трёх прогонов.');
write(path.join(exp,'protocol.json'),{date:'2026-10-11',comparison:'Одинаковый продукт и проверки. Sonnet: OpenSpec против прямых заданий. Qwen и Sonnet: одинаковые прямые задания. Один замер на условие, не статистический рейтинг моделей.',commonInputs:['BRIEF.md','INTERFACES.md','DESIGN-REFERENCE.md','seed-state.json','acceptance.test.mjs'],budgetLimitUsd:17,humanTime:'Автоматический прогон: активное время человека не измеряется. Записывается wall-clock, ожидание модели и инструментов, управление программой отдельно. На репетиции ведущий включает отдельный таймер сессии.',runs});
const common='Работай только в этой рабочей папке. Пиши по-русски. Это настоящий прогон: фиксируй только выполненные действия и результаты. Не обращайся к другим проектам, сети, прошлым реализациям. Никаких запусков серверов/установок. Не вызывай других агентов. Артефакты передаются через файлы. Не меняй docs, tests/acceptance.test.mjs и dist/vendor. Не утверждай визуальную проверку без браузера. Для редактирования используй write/edit/apply_patch, не shell. Заверши после выполнения конкретного задания.';
for(const run of runs){
 run.workspace='/home/demo/live-vtb-20261011-'+run.id;
 if(fs.existsSync(path.join(run.workspace,'opencode.json')))throw new Error('Workspace exists: '+run.workspace);
 for(const d of ['docs','reports','tests','dist','scratch','artifacts'])fs.mkdirSync(path.join(run.workspace,d),{recursive:true});
 write(path.join(run.workspace,'docs/BRIEF.md'),brief);
 for(const [a,b] of [['DOMAIN-CONTRACT.md','INTERFACES.md'],['DESIGN-REFERENCE.md','DESIGN-REFERENCE.md'],['seed-state.json','seed-state.json']])fs.copyFileSync(path.join(source,'docs',a),path.join(run.workspace,'docs',b));
 fs.cpSync(path.join(source,'dist/vendor'),path.join(run.workspace,'dist/vendor'),{recursive:true});
 fs.copyFileSync(path.join(source,'tests/acceptance.test.mjs'),path.join(run.workspace,'tests/acceptance.test.mjs'));
 write(path.join(run.workspace,'package.json'),{type:'module',private:true});
 const config={$schema:'https://opencode.ai/config.json',model:'openrouter/'+run.model,small_model:'openrouter/'+run.model,default_agent:'analyst',share:'disabled',enabled_providers:['openrouter'],provider:{openrouter:{whitelist:[run.model],options:{baseURL:'http://127.0.0.1:'+run.proxyPort+'/api/v1',timeout:240000}}},permission:{external_directory:'deny',webfetch:'deny',websearch:'deny',question:'deny',task:'deny'},agent:{}};
 for(const role of roles){
  const areas=role==='developer'?{'dist/**':'allow','dist/vendor/**':'deny','scratch/**':'allow','reports/DEVELOPMENT.md':'allow',...(run.spec?{'openspec/changes/build-tracker/tasks.md':'allow'}:{})}:role==='tester'?{'reports/QA-RESULTS.md':'allow','tests/agent-*.test.mjs':'allow'}:role==='designer'?{'reports/DESIGN-PLAN.md':'allow','reports/DESIGN-REVIEW.md':'allow',...(run.spec?{'openspec/changes/build-tracker/design.md':'allow'}:{})}:{'reports/ANALYSIS.md':'allow','reports/FINAL.md':'allow',...(run.spec?{'openspec/**':'allow'}:{})};
  config.agent[role]={mode:'primary',model:'openrouter/'+run.model,steps:role==='developer'?55:25,prompt:common+' Роль: '+role+'. '+(run.spec?'Работай по OpenSpec в openspec/changes/build-tracker/.':'Прямые задания по общему брифу. Не создавай OpenSpec, формальные спецификации и отдельные планы задач; отчёт своей роли нужен.'),permission:{edit:{'*':'deny',...areas},bash:role==='developer'||role==='tester'?{'*':'deny','node --test tests/*':'allow','node --check dist/*':'allow','node scratch/*.mjs':'allow'}:'deny',task:'deny',external_directory:'deny',question:'deny',webfetch:'deny',websearch:'deny'}};
 }
 bindRolePaths(config,run.workspace);write(path.join(run.workspace,'opencode.json'),config);
 if(run.spec){
  for(const args of [['init','--tools','opencode','--profile','core','--language','ru','--no-animation'],['new','change','build-tracker','--schema','spec-driven']]){
   const p=spawnSync(node,[cli,...args],{cwd:run.workspace,windowsHide:true,encoding:'utf8',env:{...process.env,OPENSPEC_TELEMETRY:'0'}}); if(p.status!==0)throw new Error(p.stderr);write(path.join(run.workspace,'artifacts/openspec-'+args[0]+'.txt'),p.stdout+p.stderr);
  }
  write(path.join(run.workspace,'docs/OPENSPEC-WORKFLOW.md'),'OpenSpec 1.14.1 и интеграция OpenCode установлены официальным CLI. Изменение build-tracker.\nAnalyst создаёт proposal.md, specs/tracker/spec.md (## ADDED Requirements, ### Requirement:, MUST/SHALL, #### Scenario:, WHEN/THEN), design.md и tasks.md (чеклист). Designer уточняет design.md. Developer реализует и отмечает tasks.md. Tester проверяет код и соответствие сценариям. CLI validate проверяет структуру, но не качество приложения.\n');
 }
 write(path.join(exp,run.id,'run.json'),run);
}
write(path.join(exp,'runs.json'),runs);
console.log(JSON.stringify(runs.map(({id,workspace,model,spec})=>({id,workspace,model,spec}))));
