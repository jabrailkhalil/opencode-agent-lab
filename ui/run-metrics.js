import {escapeHtml as e} from './checkpoint-markdown.js';
const number=n=>Number.isFinite(n)?n.toLocaleString('ru-RU'):'нет замера';
const dollars=n=>Number.isFinite(n)?'$'+n.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}):'нет замера';
const minutes=n=>Number.isFinite(n)?(n/60000).toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1})+' мин':'нет замера';
export function metricRuns(data){
 const modern=id=>{const r=data.runs.find(r=>r.id===id);return {id,label:r.label,model:r.model,spec:r.spec,input:r.metrics.promptTokens,output:r.metrics.completionTokens,speed:r.metrics.outputTokensPerApiSecond,cost:r.metrics.uncachedUsd,requests:r.metrics.requests,machine:r.metrics.machineStageMs,apiSeconds:r.metrics.apiSeconds,pricing:r.pricing,raw:r};};
 const old=data.legacyQwen;
 return [modern('sonnet-spec'),modern('sonnet-direct'),modern('qwen-spec'),modern('qwen-direct'),...(old?[{id:old.id,label:'Qwen3 Coder · прямые задания',model:old.model,spec:false,input:old.inputTokens,output:old.outputTokens,speed:null,cost:old.noCacheCostUsd,requests:old.billedRequests,machine:old.fullCycleMs,legacy:true}]:[])];
}
export function metricsSummaryHTML(data){
 const runs=metricRuns(data);
 const rows=[
  ['Входные токены',r=>'<strong>'+number(r.input)+'</strong>'],
  ['Выходные токены',r=>'<strong>'+number(r.output)+'</strong>'],
  ['Токенов / с времени API',r=>'<strong>'+(Number.isFinite(r.speed)?r.speed.toLocaleString('ru-RU',{maximumFractionDigits:1}):'—')+'</strong>'],
  ['Расчёт стоимости',r=>'<strong>'+dollars(r.cost)+'</strong><small>'+number(r.requests)+' запросов API</small>'],
  ['Время работы агентов',r=>'<strong>'+minutes(r.machine)+'</strong>']
 ];
 const columnClass=r=>[r.spec?'metric-spec':'metric-direct',r.id==='qwen-spec'?'metric-family-start':'',r.legacy?'metric-archive':''].filter(Boolean).join(' ');
 const modelLabel=r=>r.legacy?'Qwen3 Coder':r.id.startsWith('sonnet-')?'Sonnet 5.5':'Qwen 3.8 Flash';
 return `<section class="metrics-summary" aria-label="Пять ключевых метрик"><h2>Модель, токены, скорость, стоимость и время</h2><div class="compare-table key-metrics"><table><thead><tr><th scope="col">Показатель</th>${runs.map(r=>`<th scope="col" class="${columnClass(r)}" title="${e(r.model)}"><strong>${modelLabel(r)}</strong><span class="method-badge">${r.spec?'С OpenSpec':'Прямые задания'}</span>${r.legacy?'<small>Архивный прогон</small>':''}</th>`).join('')}</tr></thead><tbody>${rows.map(([label,fn],i)=>`<tr data-key-metric="${i+1}"><th scope="row"><span class="metric-number">${i+1}</span>${label}</th>${runs.map(r=>`<td class="${columnClass(r)}">${fn(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="metrics-note">Стоимость рассчитана по всем входным и выходным токенам, включая повторы и исправления. Скорость — выходные токены ÷ время API. Qwen3 Coder — архив: скорость API не сохранена, время включает весь записанный цикл.</p></section>`;
}
export function metricDetailsHTML(data){return `<details class="note"><summary>Тарифы и дополнительные измерения</summary><div class="compare-table"><table><thead><tr><th>Прогон</th><th>Вход / выход за 1 млн токенов</th><th>Время API</th><th>Проверки / возвраты</th></tr></thead><tbody>${metricRuns(data).filter(r=>!r.legacy).map(r=>`<tr><td>${e(r.label)}</td><td>${dollars(Number(r.pricing.prompt)*1e6)} / ${dollars(Number(r.pricing.completion)*1e6)}</td><td>${minutes(r.apiSeconds*1000)}</td><td>${number(r.raw.metrics.testerRounds)} / ${number(r.raw.metrics.developerReturns)}</td></tr>`).join('')}</tbody></table></div><p class="metrics-note">Тарифы относятся к моменту записи. Температура в современных прогонах не переопределялась; численное значение провайдера не фиксировалось. Активное время человека отдельно не измерено. Дополнительное подготовленное оформление показано отдельными версиями и не добавлено к историческим API-метрикам.</p></details>`;}
