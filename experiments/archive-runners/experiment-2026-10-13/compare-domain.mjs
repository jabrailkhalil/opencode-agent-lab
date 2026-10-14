import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
// Fixed before the new model finishes. The same cases are applied to both
// implementations; no changes are made to their code or original nine tests.
const cases=[
 ['load','BRIEF §7','Анна: 32/24, 133%, +8',d=>{const v=d.loadFor(d.seedState(),'anna',d.DEMO_WEEK);assert.equal(v.hours,32);assert.equal(v.capacity,24);assert.equal(v.percent,133);assert.equal(v.overload,8);} ],
 ['progress','BRIEF §7','Прогресс по часам: Мария 43%, Илья 25%',d=>{assert.equal(d.loadFor(d.seedState(),'maria',d.DEMO_WEEK).progress,43);assert.equal(d.loadFor(d.seedState(),'ilya',d.DEMO_WEEK).progress,25);} ],
 ['zero','BRIEF §7','Нулевая доступность без NaN / Infinity',d=>{const s=d.seedState();s.employees[0].capacities[d.DEMO_WEEK]=0;assert.equal(d.loadFor(s,'anna',d.DEMO_WEEK).percent,null);} ],
 ['plan','BRIEF §8','70 часов, доступно 16: остаток 54',d=>{const s=d.seedState();s.employees.forEach(e=>e.capacities[d.DEMO_WEEK]=0);s.employees[1].capacities[d.DEMO_WEEK]=16;assert.equal(d.proposePlan(s,d.DEMO_WEEK).unassignedHours,54);} ],
 ['plan-readonly','BRIEF §8','Предпросмотр не меняет данные',d=>{const s=d.seedState(),before=structuredClone(s);d.proposePlan(s,d.DEMO_WEEK);assert.deepEqual(s,before);} ],
 ['plan-invariants','BRIEF §8','План сохраняет задачи, часы и выполненные',d=>{const s=d.seedState(),a=d.applyPlan(s,d.proposePlan(s,d.DEMO_WEEK));assert.equal(a.tasks.length,s.tasks.length);assert.equal(a.tasks.reduce((n,t)=>n+t.hours,0),80);assert.deepEqual(a.tasks.filter(t=>t.status==='done'),s.tasks.filter(t=>t.status==='done'));} ],
 ['title','BRIEF §10','Пустое название после trim отклоняется',d=>{const s=d.seedState();assert.throws(()=>d.validateTask({...s.tasks[0],title:'   '},s.employees));} ],
 ['hours','BRIEF §10','Границы оценки и шаг 0,5',d=>{const s=d.seedState();for(const hours of [-1,0,.7,169,NaN,Infinity])assert.throws(()=>d.validateTask({...s.tasks[0],hours},s.employees));assert.equal(d.validateTask({...s.tasks[0],hours:.5},s.employees).hours,.5);} ],
 ['assignee','BRIEF §10','Несуществующий ответственный отклоняется',d=>{const s=d.seedState();assert.throws(()=>d.validateTask({...s.tasks[0],assignee:'missing'},s.employees));} ],
 ['stored-valid','BRIEF §9','Корректное состояние читается',d=>assert.equal(d.isValidState(d.seedState()),true)],
 ['stored-null','BRIEF §9','null и неверная структура отклоняются без падения',d=>{for(const s of [null,{},[],{tasks:[],employees:null}])assert.equal(d.isValidState(s),false);} ],
 ['stored-duplicate','BRIEF §9','Дубликаты задач отклоняются',d=>{const s=d.seedState();s.tasks.push({...s.tasks[0]});assert.equal(d.isValidState(s),false);} ],
 ['stored-hours','BRIEF §9–10','Повреждённые часы в хранилище отклоняются',d=>{for(const hours of [-1,'16',NaN,Infinity]){const s=d.seedState();s.tasks[0].hours=hours;assert.equal(d.isValidState(s),false);}} ],
 ['stored-date','BRIEF §9–10','Неверная дата задачи в хранилище отклоняется',d=>{for(const week of ['broken','2026-99-99','2026-10-01']){const s=d.seedState();s.tasks[0].week=week;assert.equal(d.isValidState(s),false);}} ],
 ['stored-capacity-date','BRIEF §5,9','Неверный ключ недели доступности отклоняется',d=>{const s=d.seedState();s.employees[0].capacities.broken=24;assert.equal(d.isValidState(s),false);} ],
 ['stored-capacity','BRIEF §6,9','Неверная доступность в хранилище отклоняется',d=>{for(const capacity of [-1,169,'24']){const s=d.seedState();s.employees[0].capacity=capacity;assert.equal(d.isValidState(s),false);}} ],
 ['stored-status','BRIEF §2,9','Неизвестный сохранённый статус отклоняется',d=>{const s=d.seedState();s.tasks[0].status='unknown';assert.equal(d.isValidState(s),false);} ],
 ['stored-assignee','BRIEF §9–10','Ссылка на отсутствующего сотрудника отклоняется',d=>{const s=d.seedState();s.tasks[0].assignee='missing';assert.equal(d.isValidState(s),false);} ],
];
const results=[];
for(const arg of process.argv.slice(2)){
 const [label,...parts]=arg.split('=');const code=parts.join('='),d=await import(pathToFileURL(path.resolve(code,'dist/domain.js')).href);
 const checks=cases.map(([id,requirement,title,run])=>{try{run(d);return {id,requirement,title,pass:true};}catch(error){return {id,requirement,title,pass:false,error:error.message};}});
 results.push({label,code,passed:checks.filter(c=>c.pass).length,total:checks.length,checks});
}
const output={at:new Date().toISOString(),protocol:'Same 18 checks derived from original brief, fixed before Qwen + OpenSpec finished. Neither code nor original acceptance tests changed.',results};
fs.writeFileSync(path.join(import.meta.dirname,'domain-comparison.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify(results.map(r=>({label:r.label,passed:r.passed,total:r.total,failed:r.checks.filter(c=>!c.pass).map(c=>c.id)}))));
