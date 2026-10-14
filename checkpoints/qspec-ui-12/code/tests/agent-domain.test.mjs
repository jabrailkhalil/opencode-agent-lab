// tests/agent-domain.test.mjs — дополнительные проверки QA (роль: tester).
// Файлы acceptance не менялись. here-map: границы контракта из spec.md/INTERFACES.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMO_WEEK, seedState, loadFor, monday, validateTask, proposePlan, applyPlan, isValidState } from '../dist/domain.js';

test('seedState = копия docs/seed-state.json и независима от мутаций', () => {
  assert.deepEqual(seedState(), JSON.parse(readFileSync('docs/seed-state.json', 'utf8')));
  const a = seedState();
  a.tasks[0].title = 'Мутация'; a.employees[0].capacity = 1;
  assert.equal(seedState().tasks[0].title, 'Обновить форму заявки');
  assert.equal(seedState().employees[0].capacity, 24);
});

test('validateTask нормализует trim и не мутирует вход', () => {
  const t = { title: '  А  ', description: '  Б  ', hours: '8', assignee: '', status: 'todo', week: DEMO_WEEK };
  const before = JSON.stringify(t);
  const c = validateTask(t, seedState().employees);
  assert.equal(JSON.stringify(t), before, 'вход изменён');
  assert.deepEqual([c.title, c.description, c.hours, c.assignee], ['А', 'Б', 8, null]);
  assert.notEqual(c, t, 'возвращена мутация входа');
});

test('validateTask: границы названия 140/141 и описания 1000/1001', () => {
  const emp = seedState().employees;
  const base = { description: '', hours: 8, assignee: null, status: 'todo', week: DEMO_WEEK };
  validateTask({ ...base, title: 'п'.repeat(140) }, emp);
  assert.throws(() => validateTask({ ...base, title: 'п'.repeat(141) }, emp), /Название/);
  validateTask({ ...base, title: 'x', description: 'о'.repeat(1000) }, emp);
  assert.throws(() => validateTask({ ...base, title: 'x', description: 'о'.repeat(1001) }, emp), /Описание/);
});

test('validateTask: шаг 0,5 и диапазон оценки', () => {
  const emp = seedState().employees;
  const base = { title: 'x', description: '', assignee: null, status: 'done', week: DEMO_WEEK };
  for (const h of [0.5, 168, 167.5]) validateTask({ ...base, hours: h }, emp);
  for (const h of [0.25, 1.1, 168.5, -0.5, '', 'abc', null, undefined, -Infinity])
    assert.throws(() => validateTask({ ...base, hours: h }, emp), /Оценка/, 'пропущено: ' + JSON.stringify(h));
});

test('validateTask: статус, ответственный, понедельник недели', () => {
  const emp = seedState().employees;
  const base = { title: 'x', description: '', hours: 8, assignee: 'anna', status: 'todo', week: DEMO_WEEK };
  assert.throws(() => validateTask({ ...base, status: 'ready' }, emp), /Статус/);
  assert.throws(() => validateTask({ ...base, status: undefined }, emp), /Статус/);
  assert.throws(() => validateTask({ ...base, assignee: 'ANTON' }, emp), /Ответственный/);
  for (const w of ['2026-09-29', '2026-09-28 ', '28.09.2026', '', '2026-02-30', DEMO_WEEK + 'T00:00'])
    assert.throws(() => validateTask({ ...base, week: w }, emp), /Неделя/, 'пропущено: ' + JSON.stringify(w));
});

test('loadFor: метрики seed по всем сценариям spec и отсутствие NaN', () => {
  const s = seedState();
  assert.deepEqual(Object.keys(loadFor(s, 'anna', DEMO_WEEK)).sort(),
    ['active', 'capacity', 'doneHours', 'hours', 'overload', 'percent', 'progress', 'tasks', 'totalHours'].sort());
  const m = { anna: [32, 24, 133, 8, 0], dmitry: [14, 32, 44, 0, 0], maria: [8, 24, 33, 0, 43], ilya: [12, 24, 50, 0, 25] };
  for (const [id, [hours, capacity, percent, overload, progress]] of Object.entries(m)) {
    const l = loadFor(s, id, DEMO_WEEK);
    assert.deepEqual([l.hours, l.capacity, l.percent, l.overload, l.progress], [hours, capacity, percent, overload, progress], id);
    assert.ok(Number.isFinite(l.hours) && Number.isFinite(l.progress), id);
  }
  assert.equal(loadFor(s, 'нет-такого', DEMO_WEEK).capacity, 0);
  assert.equal(loadFor(s, 'нет-такого', DEMO_WEEK).percent, null);
  assert.equal(loadFor(s, 'нет-такого', DEMO_WEEK).progress, 0);
});

test('loadFor: capacities по неделям, дробная доступность, округление', () => {
  const s = seedState();
  s.employees[0].capacities[DEMO_WEEK] = 0;
  s.employees[0].capacities['2026-10-05'] = 10;
  assert.equal(loadFor(s, 'anna', DEMO_WEEK).capacity, 0);
  assert.equal(loadFor(s, 'anna', '2026-10-05').capacity, 10);
  s.employees[2].capacities[DEMO_WEEK] = 7.5;
  assert.equal(loadFor(s, 'maria', DEMO_WEEK).percent, 107);
  s.employees[1].capacities[DEMO_WEEK] = 'abc';
  assert.equal(loadFor(s, 'dmitry', DEMO_WEEK).capacity, 0);
  assert.equal(loadFor(s, 'dmitry', DEMO_WEEK).percent, null);
});

test('monday: границы недель, Date, високосный год, мусор не роняет isValidState', () => {
  assert.equal(monday('2026-09-28'), '2026-09-28');
  assert.equal(monday('2026-10-04'), '2026-09-28');
  assert.equal(monday('2026-11-01'), '2026-10-26');
  assert.equal(monday('2028-02-29'), '2028-02-28');
  assert.equal(monday(new Date(Date.UTC(2026, 9, 4))), '2026-09-28');
  assert.equal(isValidState({ ...seedState(), tasks: [{ ...seedState().tasks[0], week: 'мусор' }] }), false);
  // Фиксация фактического поведения на мусорном входе (app.js зовёт monday только в try/catch).
  const probe = [];
  for (const v of ['', 'garbage', '2026-13-45', null]) {
    try { const r = monday(v); probe.push(`${JSON.stringify(v)}→${r}${monday(r) === r ? ' (стабильно)' : ''}`); }
    catch (e) { probe.push(`${JSON.stringify(v)}→${e.constructor.name}`); }
  }
  console.log('PROBE monday:', probe.join(' | '));
});

test('proposePlan/applyPlan: не мутирует, сохраняет done/чужие недели, считает unassignedHours', () => {
  const s = seedState();
  s.tasks.push({ id: 'TASK-900', title: 'Чужая неделя', description: '', assignee: 'anna', hours: 40, status: 'todo', week: '2026-10-05' });
  const before = structuredClone(s);
  const plan = proposePlan(s, DEMO_WEEK);
  assert.deepEqual(s, before, 'state изменён предпросмотром');
  assert.equal(new Set(plan.assignments.map(a => a.taskId)).size, plan.assignments.length);
  assert.deepEqual(plan.assignments.map(a => a.taskId).sort(),
    s.tasks.filter(t => t.week === DEMO_WEEK && t.status !== 'done').map(t => t.id).sort());
  const sumBy = st => st.tasks.filter(t => t.status === 'done').map(t => t.hours).reduce((a, b) => a + b, 0);
  const after = applyPlan(s, plan);
  assert.equal(after.tasks.length, s.tasks.length);
  assert.equal(sumBy(after), sumBy(s));
  assert.deepEqual(after.tasks.find(t => t.id === 'TASK-900'), before.tasks.find(t => t.id === 'TASK-900'));
  assert.ok(plan.unassignedHours >= 0);
  const un = plan.assignments.filter(a => a.assignee === null)
    .reduce((sum, a) => sum + s.tasks.find(t => t.id === a.taskId).hours, 0);
  assert.equal(un, plan.unassignedHours, 'unassignedHours не сходится');
  for (const e of after.employees) assert.equal(loadFor(after, e.id, DEMO_WEEK).overload, 0, e.id);
});

test('proposePlan: при нехватке доступности лишние задачи остаются без ответственного', () => {
  const s = seedState();
  s.employees.forEach(e => { e.capacities = { [DEMO_WEEK]: 2 }; });
  const plan = proposePlan(s, DEMO_WEEK);
  assert.equal(plan.assignments.filter(a => a.assignee === null).length > 0, true);
  assert.ok(plan.unassignedHours > 0);
  const after = applyPlan(s, plan);
  for (const e of after.employees) assert.equal(loadFor(after, e.id, DEMO_WEEK).overload, 0, e.id);
  assert.equal(after.tasks.filter(t => t.status !== 'done' && !t.assignee).length > 0, true);
});

test('isValidState: схема, дубли id, поля, nextId, сериализованный seed', () => {
  const s = seedState();
  assert.equal(isValidState(JSON.parse(JSON.stringify(s))), true);
  assert.equal(isValidState(null), false);
  assert.equal(isValidState('string'), false);
  assert.equal(isValidState({ ...s, tasks: 'x' }), false);
  assert.equal(isValidState({ ...s, nextId: 109 }), false);
  assert.equal(isValidState({ ...s, nextId: 1.5 }), false);
  assert.equal(isValidState({ ...s, tasks: [...s.tasks, { ...s.tasks[1] }] }), false);
  assert.equal(isValidState({ ...s, tasks: [...s.tasks, { ...s.tasks[1], id: 'TASK-777', assignee: 'ghost' }] }), false);
  assert.equal(isValidState({ ...s, tasks: s.tasks.map((t, i) => i ? t : { ...t, hours: 0 }) }), false);
  assert.equal(isValidState({ ...s, tasks: s.tasks.map((t, i) => i ? t : { ...t, status: 'new' }) }), false);
  assert.equal(isValidState({ ...s, tasks: s.tasks.map((t, i) => i ? t : { ...t, week: '2026-09-29' }) }), false);
  assert.equal(isValidState({ ...s, employees: [...s.employees, { ...s.employees[0], id: 'anna' }] }), false);
  assert.equal(isValidState({ ...s, employees: s.employees.map((e, i) => i ? e : { ...e, capacities: { [DEMO_WEEK]: 200 } }) }), false);
});

// Правка 4.1: строгая схема хранилища (BRIEF §5/§6/§9/§10) — проваленные независимые проверки.
test('isValidState строгость: строковые часы, не-понедельник ключ, границы доступности', () => {
  const s = seedState();
  const emp = k => s.employees.map((e, i) => i ? e : { ...e, ...k });
  const task = k => s.tasks.map((t, i) => i ? t : { ...t, ...k });
  assert.equal(isValidState({ ...s, tasks: task({ hours: '16' }) }), false, 'часы-строка');
  assert.equal(isValidState({ ...s, tasks: task({ hours: 0.75 }) }), false, 'часы вне шага 0,5');
  assert.equal(isValidState({ ...s, tasks: task({ hours: -1 }) }), false, 'отрицательные часы');
  assert.equal(isValidState({ ...s, tasks: task({ hours: 169 }) }), false, 'часы > 168');
  assert.equal(isValidState({ ...s, tasks: task({ hours: Infinity }) }), false, '±Infinity');
  assert.equal(isValidState({ ...s, employees: emp({ capacity: '24' }) }), false, 'доступность-строка');
  assert.equal(isValidState({ ...s, employees: emp({ capacity: '' }) }), false, 'пустая доступность');
  assert.equal(isValidState({ ...s, employees: emp({ capacity: -1 }) }), false, 'доступность < 0');
  assert.equal(isValidState({ ...s, employees: emp({ capacities: { broken: 10 } }) }), false, 'ключ не-дата');
  assert.equal(isValidState({ ...s, employees: emp({ capacities: { '2026-09-29': 10 } }) }), false, 'ключ не понедельник');
  assert.equal(isValidState({ ...s, employees: emp({ capacities: { [DEMO_WEEK]: '16' } }) }), false, 'значение недели-строка');
  assert.equal(isValidState({ ...s, employees: emp({ capacity: 0 }) }), true, '0 допустим');
  assert.equal(isValidState({ ...s, employees: emp({ capacity: 168 }) }), true, '168 допустим');
});
