import fs from 'node:fs';import path from 'node:path';const exp=import.meta.dirname;
let code=fs.readFileSync(path.join(exp,'resume.mjs'),'utf8');const firstTry=code.indexOf('\ntry{\n const res=');code=code.slice(0,firstTry);
code+=`
try{
 if(!fs.existsSync(path.join(art,'metrics.json')))throw new Error('Finish baseline run first');
 const prior=JSON.parse(fs.readFileSync(path.join(art,'metrics.json'),'utf8'));started=Date.parse(prior.startedAt);
 const pricing=JSON.parse(fs.readFileSync(path.join(art,'pricing.json'),'utf8')).pricing;
 proxy=await startProxy({credential,art,safe,port:run.proxyPort,budgetUsd:run.budgetUsd,model:run.model});proxy.setPricing(pricing);
 server=spawn(oc,['serve','--hostname','127.0.0.1','--port',String(run.port)],{cwd:work,windowsHide:true,env:{...process.env,PATH:path.dirname(node)+';'+process.env.PATH},stdio:['ignore',fs.openSync(path.join(art,'logs/server.out'),'a'),fs.openSync(path.join(art,'logs/server.err'),'a')]});
 let ready=false;for(let n=0;n<60;n++){try{await api('/global/health');ready=true;break;}catch{await sleep(1000);}}if(!ready)throw new Error('Server unavailable');
 const phase=process.argv[3]||'fix';
 if(phase==='fix'){
  const evidence=fs.readFileSync(path.join(exp,'browser-evidence.txt'),'utf8');fs.writeFileSync(path.join(work,'reports/BROWSER-EVIDENCE.txt'),evidence);
  await turn('tester','Дефект из браузерной проверки','Прочитай reports/BROWSER-EVIDENCE.txt: это наблюдения внешней браузерной проверки. Найди относящийся к этой реализации дефект ('+(run.spec?'выступающие кнопки боковой панели':'слипшиеся даты в кнопке недели')+'), сопоставь с кодом и добавь в QA-RESULTS точные факты, ожидание и шаги воспроизведения. Не заявляй, что сам запускал браузер. Сохрани остальные результаты. Кратко, до 70 строк.');
  await turn('designer','Решение по дефекту интерфейса','По подтверждённому дефекту из reports/BROWSER-EVIDENCE.txt и QA-RESULTS уточни DESIGN-PLAN: '+(run.spec?'кнопки должны помещаться внутри боковой панели при 1280 и 1100, контент не перекрывается.':'даты должны читаться отдельно и не сливаться на 390 и 1280.')+' Не меняй код. Кратко опиши правило и проверку.');
  await turn('developer','Исправление дефекта интерфейса','Исправь подтверждённый дефект этой ветки из QA-RESULTS и DESIGN-PLAN: '+(run.spec?'кнопки выступают за правую границу боковой панели на 16 px.':'человекочитаемая и ISO-дата визуально сливаются.')+' Проверь CSS и разметку. Логику расчётов не меняй. Прогони исходные девять тестов. Сохрани причину, изменение и результат в DEVELOPMENT.');
 }else if(phase==='fix-again'){
  await turn('developer','Повторная правка после браузерной проверки','Предыдущая правка не устранила дефект. Прочитай reports/BROWSER-RECHECK.txt с фактическими вычисленными стилями и координатами. Исправь корневую причину CSS с учётом Tabler; не меняй расчёты. Прогони исходные 9 тестов, обнови DEVELOPMENT. Не объявляй браузерный PASS без повторного протокола.');
 }else{
  if(!fs.existsSync(path.join(work,'reports/BROWSER-RECHECK.txt')))throw new Error('Need actual browser recheck evidence');
  await turn('tester','Повторная проверка интерфейса','Прочитай внешний протокол reports/BROWSER-RECHECK.txt. Сопоставь с предыдущим дефектом и текущим кодом. Прогони исходные тесты. Обнови QA-RESULTS: что подтверждено повторной браузерной проверкой, что проверено тестами, что осталось NOT RUN. Не присваивай себе внешний запуск браузера.');
  await turn('analyst','Итог после проверки интерфейса','Обнови FINAL по QA-RESULTS и BROWSER-RECHECK: результат по требованиям, исправленный дефект, оставшиеся ограничения. Не заявляй полную приёмку всех сценариев.');
 }
 const result=gate();await sleep(1500);save('metrics.json',{...prior,...proxy.usage(),finishedAt:new Date().toISOString(),elapsedMs:Date.now()-started,machineStageMs:stages.reduce((s,p)=>s+p.elapsedMs,0),domainTests:{passed:result.passed,failed:result.failed},stages:stages.length,visualTests:phase==='verify'?'See visual-checks.json':'Awaiting browser recheck'});console.log('FOLLOWUP DONE '+phase);
}catch(e){save('followup-error.json',{at:new Date().toISOString(),error:safe(e.message),usage:proxy?.usage()});console.error(safe(e.stack));process.exitCode=1;}finally{if(proxy){save('billing.json',proxy.usage());proxy.close();}server?.kill();}
`;
code=code.replace("['--test','tests/acceptance.test.mjs']","['--test','--test-reporter=tap','tests/acceptance.test.mjs']");
fs.writeFileSync(path.join(exp,'followup.mjs'),code);
