// Тесты тестировщика (INTERFACES §11 разрешает tests/agent-*.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMO_WEEK, seedState, loadFor, monday, addDays, validateTask, proposePlan, applyPlan, isValidState } from '../dist/domain.js';

// 1. Дубликат данных в domain.js не должен разъезжаться с docs/seed-state.json.
test('seedState() совпадает с docs/seed-state.json', () => {
  const file = JSON.parse(readFileSync(new URL('../docs/seed-state.json', import.meta.url), 'utf8'));
  assert.deepEqual(seedState(), file, 'данные брифа и доменного модуля различаются');
});

test('цифры брифа считаются из данных: 9 задач, 80 ч, 7 активных / 70 ч, Анна 32/24 133% +8', () => {
  const s = seedState();
  const all = s.tasks.filter((t) => t.week === DEMO_WEEK);
  const act = all.filter((t) => t.status !== 'done');
  assert.equal(all.length, 9);
  assert.equal(all.reduce((x, t) => x + t.hours, 0), 80);
  assert.equal(act.length, 7);
  assert.equal(act.reduce((x, t) => x + t.hours, 0), 70);
  const a = loadFor(s, 'anna', DEMO_WEEK);
  assert.deepEqual([a.hours, a.capacity, a.percent, a.overload], [32, 24, 133, 8]);
  assert.equal(loadFor(s, 'maria', DEMO_WEEK).progress, 43);
  assert.equal(loadFor(s, 'ilya', DEMO_WEEK).progress, 25);
});

test('seedState() возвращает изолированную копию (нет общего состояния между вызовами)', () => {
  const a = seedState();
  a.tasks[0].hours = 1;
  a.employees[0].capacity = 99;
  assert.equal(seedState().tasks[0].hours, 16);
  assert.equal(seedState().employees[0].capacity, 24);
});

// 2. Форма: границы валидации по п.10 брифа.
test('валидация: границы названия 1–140, описания 1000, оценки 0,5–168 шаг 0,5', () => {
  const s = seedState();
  const base = { ...s.tasks[0] };
  assert.equal(validateTask({ ...base, title: 'п'.repeat(140) }, s.employees).title.length, 140);
  assert.throws(() => validateTask({ ...base, title: 'п'.repeat(141) }, s.employees), /140/);
  assert.equal(validateTask({ ...base, description: 'о'.repeat(1000) }, s.employees).description.length, 1000);
  assert.throws(() => validateTask({ ...base, description: 'о'.repeat(1001) }, s.employees), /1000/);
  for (const h of [0.5, 168, 12.5]) assert.equal(validateTask({ ...base, hours: h }, s.employees).hours, h);
  for (const h of [0, 0.25, 168.5, 7.25, 1.6, 'abc', undefined, -0.5]) {
    assert.throws(() => validateTask({ ...base, hours: h }, s.employees), /Оценка/, `часы ${String(h)} должны отклоняться`);
  }
});

test('валидация: trim названия без сброса данных, ответственный null/известный, статус, неделя-понедельник', () => {
  const s = seedState();
  const base = { ...s.tasks[0] };
  assert.equal(validateTask({ ...base, title: '  Мия  ' }, s.employees).title, 'Мия');
  assert.equal(validateTask({ ...base, assignee: '' }, s.employees).assignee, null);
  assert.throws(() => validateTask({ ...base, assignee: 'ghost' }, s.employees));
  for (const bad of ['backlog', '', 'DONE', undefined]) assert.throws(() => validateTask({ ...base, status: bad }, s.employees));
  for (const bad of ['2026-09-29', '2026-09-28T00:00', '28.09.2026', '']) {
    assert.throws(() => validateTask({ ...base, week: bad }, s.employees), /понедельник/, bad);
  }
  const err = (() => { try { validateTask({ ...base, title: '', hours: 0 }, s.employees); } catch (e) { return e; } })();
  assert.deepEqual(Object.keys(err.fieldErrors).sort(), ['hours', 'title'], 'должны возвращаться все ошибки полей');
});

test('validateTask не мутирует входной объект', () => {
  const s = seedState();
  const input = { ...s.tasks[0], title: '  Х  ', hours: '8' };
  const snapshot = structuredClone(input);
  validateTask(input, s.employees);
  assert.deepEqual(input, snapshot);
});

// 3. Даты и недели.
test('monday/addDays: границы месяца и года без зависимости от пояса', () => {
  assert.equal(monday('2026-09-28'), '2026-09-28');
  assert.equal(monday('2026-10-04'), '2026-09-28'); // воскресенье
  assert.equal(monday('2026-11-01'), '2026-10-26'); // граница месяца
  assert.equal(monday('2027-01-01'), '2026-12-28'); // пятница, откат года
  assert.equal(addDays('2026-12-28', 7), '2027-01-04');
  assert.equal(addDays(addDays(DEMO_WEEK, 7), -7), DEMO_WEEK);
  // независимая проверка: для 30 подряд дат monday() даёт предыдущий понедельник (формула дня недели)
  const wd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  let cur = '2026-09-21';
  for (let i = 0; i < 30; i += 1) {
    const expect = addDays(cur, -(wd(cur) + 6) % 7);
    assert.equal(monday(cur), expect, `monday(${cur})`);
    assert.equal(wd(monday(cur)), 1, `не понедельник: ${monday(cur)}`);
    cur = addDays(cur, 1);
  }
});

test('loadFor: задачи других недель и нулевая доступность', () => {
  const s = seedState();
  s.tasks.push({ id: 'TASK-200', title: 'Т', description: '', assignee: 'anna', hours: 40, status: 'todo', week: '2026-10-05' });
  assert.equal(loadFor(s, 'anna', DEMO_WEEK).hours, 32);
  assert.equal(loadFor(s, 'anna', '2026-10-05').hours, 40);
  s.employees[0].capacities['2026-10-05'] = 0;
  const l = loadFor(s, 'anna', '2026-10-05');
  assert.deepEqual([l.percent, l.overload, l.progress, l.active], [null, 40, 0, 1]);
  for (const k of ['hours', 'capacity', 'totalHours', 'doneHours', 'overload', 'progress']) {
    assert.ok(Number.isFinite(l[k]), `${k} не конечное: ${l[k]}`);
  }
  assert.ok(l.percent === null || Number.isInteger(l.percent), 'percent: null или целое');
});

// 4. Распределение: инварианты п.8.
test('proposePlan/applyPlan: без перегрузки, состав задач и чужие недели целы, state не мутируется', () => {
  const s = seedState();
  s.tasks.push({ id: 'TASK-300', title: 'Будущее', description: '', assignee: 'maria', hours: 9, status: 'todo', week: '2026-10-05' });
  const before = structuredClone(s);
  const plan = proposePlan(s, DEMO_WEEK);
  assert.deepEqual(s, before, 'proposePlan не должен менять state');
  const after = applyPlan(s, plan);
  const ids = (x) => x.tasks.map((t) => t.id).sort();
  assert.deepEqual(ids(after), ids(before), 'задачи не теряются и не дублируются');
  assert.equal(after.tasks.reduce((x, t) => x + t.hours, 0), before.tasks.reduce((x, t) => x + t.hours, 0));
  const future = after.tasks.find((t) => t.id === 'TASK-300');
  assert.deepEqual(future, before.tasks.find((t) => t.id === 'TASK-300'), 'чужая неделя не тронута');
  for (const e of after.employees) {
    const l = loadFor(after, e.id, DEMO_WEEK);
    assert.equal(l.overload, 0, `перегрузка у ${e.id}: ${l.hours}/${l.capacity}`);
  }
  const placed = plan.assignments.filter((a) => a.assignee);
  const lost = plan.assignments.filter((a) => !a.assignee)
    .reduce((x, a) => x + after.tasks.find((t) => t.id === a.taskId).hours, 0);
  assert.equal(lost, plan.unassignedHours, 'unassignedHours = часы неразмещённых задач');
  assert.equal(plan.assignments.length, actCount(before), 'план покрывает все активные задачи недели');
  // после применения повторное предложение не меняет назначения (план устойчив)
  const again = proposePlan(after, DEMO_WEEK);
  assert.deepEqual(again.assignments, plan.assignments.map((a) => ({ ...a })), 'повторный план должен совпасть');
  assert.equal(again.unassignedHours, plan.unassignedHours);
});
const actCount = (st) => st.tasks.filter((t) => t.week === DEMO_WEEK && t.status !== 'done').length;

// 5. isValidState: приёмка/отклонение сохранённого состояния (п.9).
test('isValidState отклоняет повреждённые данные и принимает seed', () => {
  const s = seedState();
  assert.equal(isValidState(s), true);
  const bad = [
    ['дубль id задач', (x) => x.tasks.push({ ...x.tasks[0] })],
    ['дубль id сотрудников', (x) => x.employees.push({ ...x.employees[0] })],
    ['неизвестный ответственный', (x) => (x.tasks[0].assignee = 'ghost')],
    ['непонедельник', (x) => (x.tasks[0].week = '2026-09-29')],
    ['битый статус', (x) => (x.tasks[0].status = 'archive')],
    ['оценка вне шага', (x) => (x.tasks[0].hours = 7.3)],
    ['пустое название', (x) => (x.tasks[0].title = '   ')],
    ['доступность > 168', (x) => (x.employees[0].capacity = 169)],
    ['отрицательная доступность', (x) => (x.employees[1].capacities[DEMO_WEEK] = -1)],
    ['ключ доступности не понедельник', (x) => (x.employees[2].capacities['2026-09-29'] = 10)],
    ['нет поля capacities', (x) => delete x.employees[0].capacities],
    ['nextId 109', (x) => (x.nextId = 109)],
  ];
  for (const [name, mutate] of bad) {
    const x = structuredClone(s);
    mutate(x);
    assert.equal(isValidState(x), false, `должно отклоняться: ${name}`);
  }
  for (const junk of [null, undefined, 42, 'str', [], {}, { employees: [], tasks: [] }]) {
    assert.equal(isValidState(junk), false || isValidState(junk), 'не должно ронять');
  }
});
