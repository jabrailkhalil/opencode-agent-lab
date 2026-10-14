import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_WEEK, seedState, loadFor, proposePlan, applyPlan, validateTask, monday, isValidState } from '../dist/domain.js';

test('32 часа при доступных 24 показывают 133% и 8 часов перегрузки', () => {
  const load = loadFor(seedState(), 'anna', DEMO_WEEK);
  assert.equal(load.hours, 32);
  assert.equal(load.percent, 133);
  assert.equal(load.overload, 8);
});
test('выполненная задача освобождает нагрузку, оставаясь в прогрессе', () => {
  const state = seedState(); state.tasks.find(t => t.id === 'TASK-101').status = 'done';
  const load = loadFor(state, 'anna', DEMO_WEEK);
  assert.equal(load.hours, 16); assert.equal(load.overload, 0); assert.equal(load.progress, 50);
  assert.equal(load.tasks.length, 2);
});
test('недоступный сотрудник не получает задачи, а лишние задачи сохраняются', () => {
  const state = seedState(); state.employees.forEach(e => e.capacities[DEMO_WEEK] = 0);
  state.employees[1].capacities[DEMO_WEEK] = 16;
  const before = structuredClone(state), plan = proposePlan(state, DEMO_WEEK), after = applyPlan(state, plan);
  assert.deepEqual(state, before, 'предпросмотр не изменяет исходный план');
  assert.equal(after.tasks.length, state.tasks.length);
  assert.equal(new Set(after.tasks.map(t => t.id)).size, state.tasks.length);
  assert.equal(plan.unassignedHours, 54);
  for (const e of after.employees) assert.equal(loadFor(after, e.id, DEMO_WEEK).overload, 0);
  assert.deepEqual(after.tasks.filter(t => t.status === 'done'), state.tasks.filter(t => t.status === 'done'));
});
test('распределение устраняет перегрузку и сохраняет суммы часов', () => {
  const before = seedState(), after = applyPlan(before, proposePlan(before, DEMO_WEEK));
  for (const e of after.employees) assert.equal(loadFor(after, e.id, DEMO_WEEK).overload, 0);
  assert.equal(after.tasks.reduce((s,t) => s+t.hours,0), before.tasks.reduce((s,t) => s+t.hours,0));
  assert.equal(after.tasks.filter(t => !t.assignee).length, 0);
});
test('задачи другой недели не влияют на текущую загрузку и распределение', () => {
  const state = seedState();
  const future = { ...state.tasks[0], id:'TASK-999', week:'2026-10-05', hours:100 };
  state.tasks.push(future);
  assert.equal(loadFor(state,'anna',DEMO_WEEK).hours,32);
  assert.deepEqual(applyPlan(state,proposePlan(state,DEMO_WEEK)).tasks.find(t=>t.id==='TASK-999'),future);
});
test('нулевая доступность обрабатывается без Infinity и NaN', () => {
  const state=seedState();state.employees[0].capacities[DEMO_WEEK]=0;
  const l=loadFor(state,'anna',DEMO_WEEK);
  assert.equal(l.percent,null);assert.equal(l.overload,32);assert.ok(Number.isFinite(l.progress));
});
test('валидация отклоняет пустое название и отрицательные или дробные оценки вне шага', () => {
  const state=seedState(), task=state.tasks[0];
  for(const hours of [-1,0,0.7,169,NaN,Infinity])assert.throws(()=>validateTask({...task,hours},state.employees));
  assert.throws(()=>validateTask({...task,title:'   '},state.employees));
  assert.throws(()=>validateTask({...task,assignee:'missing'},state.employees));
  assert.equal(validateTask({...task,hours:0.5},state.employees).hours,0.5);
});
test('сохранённое состояние проходит проверку; испорченные данные отклоняются', () => {
  const state=seedState();assert.equal(isValidState(JSON.parse(JSON.stringify(state))),true);
  assert.equal(isValidState({...state,tasks:[...state.tasks,state.tasks[0]]}),false);
  assert.equal(isValidState({...state,nextId:-1}),false);
});
test('дата приводится к понедельнику без зависимости от часового пояса',()=>{
  assert.equal(monday('2026-10-01'),'2026-09-28');
  assert.equal(monday('2026-10-04'),'2026-09-28');
  assert.equal(monday('2026-10-05'),'2026-10-05');
});
