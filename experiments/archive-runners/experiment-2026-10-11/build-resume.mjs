import fs from 'node:fs';import path from 'node:path';
const exp=import.meta.dirname,runs=JSON.parse(fs.readFileSync(path.join(exp,'runs.json'),'utf8'));
for(const r of runs){
 const art=path.join(exp,r.id),marker=path.join(art,'recovery.json');if(fs.existsSync(marker))continue;
 const source=path.join(art,'snapshots',r.prefix+'-00','code'),backup=path.join(r.workspace,'artifacts/incomplete-workspace');fs.mkdirSync(backup,{recursive:true});
 for(const dir of ['docs','dist','reports','tests','openspec']){
  const target=path.resolve(r.workspace,dir),dest=path.resolve(backup,dir);if(!target.startsWith(path.resolve(r.workspace)+path.sep)||!dest.startsWith(path.resolve(r.workspace)+path.sep))throw new Error('Unsafe recovery target');if(fs.existsSync(target))fs.renameSync(target,dest);
  if(fs.existsSync(path.join(source,dir)))fs.cpSync(path.join(source,dir),target,{recursive:true});else fs.mkdirSync(target);
 }
 const stages=JSON.parse(fs.readFileSync(path.join(art,'stages.json'),'utf8'));
 for(const s of stages){if(!s.output&&s.role!=='operator')s.output='Этап не завершён: ответ остановился по лимиту вывода. Сохранена частичная версия файлов; она не передаётся как готовый результат.';}
 fs.writeFileSync(path.join(art,'stages.json'),JSON.stringify(stages,null,2));
 fs.writeFileSync(marker,JSON.stringify({at:new Date().toISOString(),firstNewStage:stages.length,reason:'Finish reason length / interrupted file writes. Retain all paid attempts; restart with concise outputs and artifact gates.'},null,2));
 const cfg=JSON.parse(fs.readFileSync(path.join(r.workspace,'opencode.json'),'utf8'));
 for(const a of Object.values(cfg.agent))a.prompt+='\nПиши кратко. Отчёт максимум 100 строк. Не создавай один файл большим вызовом: сначала каркас, затем небольшие правки. Код дели по модулям; каждый write/edit не более 150 строк. Итоговый ответ 5–10 предложений. Спецификация до 160 строк; другие OpenSpec-файлы до 60 строк каждый. Не расписывай повторно весь бриф.';
 fs.writeFileSync(path.join(r.workspace,'opencode.json'),JSON.stringify(cfg,null,2));
}
let code=fs.readFileSync(path.join(exp,'run.mjs'),'utf8');
const start=code.indexOf("if(fs.existsSync(path.join(art,'stages.json')))");const end=code.indexOf('async function api(',start);code=code.slice(0,start)+"stages.push(...JSON.parse(fs.readFileSync(path.join(art,'stages.json'),'utf8')));\n"+code.slice(end);
code=code.replace("snapshot(run.prefix+'-00','operator'","snapshot(run.prefix+'-'+String(stages.length).padStart(2,'0'),'operator'");
code=code.replace("'Прочитай общий бриф, DESIGN-REFERENCE.md", "'План максимум 100 строк, без многократного пересказа требований. Прочитай общий бриф, DESIGN-REFERENCE.md");
code=code.replace("'Реализуй весь трекер с нуля", "'Пиши компактный код. Каждый вызов записи до 150 строк; дописывай файл частями. Реализуй весь трекер с нуля");
code=code.replace("snapshot(id,role,title,output,text,Date.now()-start);", "snapshot(id,role,title,output||'Ответ завершился без итогового текста. См. фактически сохранённые файлы и журнал вызовов.',text,Date.now()-start);");
// Resume a truncated response in the same session; every paid call stays in the API log.
code=code.replace("if(last?.info.time?.completed){done=true;break;}", "if(last?.info.time?.completed){if(last.info.finish==='length'){save('logs/'+id+'-truncated-'+n+'.json',msgs);await api('/session/'+session.id+'/prompt_async','POST',{agent:role,model:{providerID:'openrouter',modelID:run.model},parts:[{type:'text',text:'Предыдущий ответ оборвался по лимиту. Проверь сохранённые файлы. Заверши исходную задачу короткими write/edit до 100 строк каждый. Не повторяй готовое. Сохрани обязательные артефакты и короткий итог.'}]});continue;}done=true;break;}");
// Use the original first request time, including recovery, so costs/time are not cherry-picked.
code=code.replace("const final=gate();", "const final=gate();const firstRequest=fs.readFileSync(path.join(art,'logs/api-requests.jsonl'),'utf8').trim().split('\\n').filter(Boolean).map(x=>JSON.parse(x)).find(x=>x.startedAt);if(firstRequest)started=Date.parse(firstRequest.startedAt);");
fs.writeFileSync(path.join(exp,'resume.mjs'),code);
