import fs from 'node:fs';import path from 'node:path';
const exp=import.meta.dirname;
let proxy=fs.readFileSync(path.join(exp,'../../rehearsal-runs/claude-full-2026-10-05-01/api-proxy.mjs'),'utf8');
proxy=proxy.replace('let sequence=0,costUsd=0,requests=0,budgetStopped=false,unknownCost=false;', 'let sequence=0,costUsd=0,requests=0,budgetStopped=false,unknownCost=false,unconfirmedUsd=0,failureStreak=0;');
proxy=proxy.replace('cachedTokens+=record.usage.prompt_tokens_details?.cached_tokens||0;','cachedTokens+=record.usage.prompt_tokens_details?.cached_tokens||0;failureStreak=0;');
proxy=proxy.replace('else if(!record.status||record.status===200){unknownCost=true;budgetStopped=true;}', 'else if(!record.status||record.status===200){unknownCost=true;failureStreak++;if(Number.isFinite(record.reservationUsd)&&record.reservationUsd>0){unconfirmedUsd+=record.reservationUsd;record.costUpperBoundUsd=record.reservationUsd;}else budgetStopped=true;if(failureStreak>=3)budgetStopped=true;}');
proxy=proxy.replaceAll('if(costUsd>=budgetUsd)', 'if(costUsd+unconfirmedUsd>=budgetUsd)');
proxy=proxy.replace('cachedTokens,budgetUsd,budgetStopped,unknownCost,reservedUsd','cachedTokens,budgetUsd,budgetStopped,unknownCost,unconfirmedUsd,costUpperBoundUsd:costUsd+unconfirmedUsd,reservedUsd');
proxy=proxy.replace('if(budgetStopped||unknownCost)', 'if(budgetStopped)');
proxy=proxy.replace('if(costUsd+reservedUsd+reservation>budgetUsd)', 'if(costUsd+unconfirmedUsd+reservedUsd+reservation>budgetUsd)');
fs.writeFileSync(path.join(exp,'bounded-api-proxy.mjs'),proxy);
let follow=fs.readFileSync(path.join(exp,'followup.mjs'),'utf8').replace("from '../../rehearsal-runs/claude-full-2026-10-05-01/api-proxy.mjs'","from './bounded-api-proxy.mjs'");
follow=follow.replace("if(phase==='qwen-fix'){",`if(phase==='qwen-continue'){
  await turn('developer','Продолжение исправлений после лимита провайдера','Предыдущий запрос оборвался на 429 провайдера. Прочитай QA-RESULTS и текущий app.js, исправь D1–D4: сброс недели/фильтров, валидация пустой доступности без потери фокуса, пустые колонки, фокус диалога. Не переписывай готовое. Короткие edits до 80 строк. Прогони tests/*.test.mjs и обнови DEVELOPMENT. До 12 инструментов.');
  await turn('tester','Проверка исправлений Qwen','Прочитай DEVELOPMENT и проверь D1–D4 по коду. Запусти исходные и дополнительные тесты. Сохрани QA-RESULTS. Своей браузерной проверки нет: соответствующие пункты NOT RUN. До 8 инструментов.');
 }else if(phase==='qwen-fix'){`);
fs.writeFileSync(path.join(exp,'bounded-followup.mjs'),follow);console.log('Conservative reservation ledger prepared; unknown amounts remain explicitly unknown.');
