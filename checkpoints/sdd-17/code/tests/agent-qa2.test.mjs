import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState, validateTask, isValidState, proposePlan, applyPlan, loadFor, DEMO_WEEK } from '../dist/domain.js';

const emps = () => seedState().employees;
const ok = { title: 'a', description: '', assignee: null, hours: 1, status: 'todo', week: DEMO_WEEK };

test('seed: план без перегрузки, все 7 активных назначены, 80 ч сохранены', () => {
  const s = seedState();
  const p = proposePlan(s, DEMO_WEEK);
  assert.equal(p.assignments.length, 7);
  assert.equal(p.unassignedHours, 0);
  assert.ok(p.assignments.every((a) => a.assignee));
  const n = applyPlan(s, p);
  for (const e of n.employees) assert.equal(loadFor(n, e.id, DEMO_WEEK).overload, 0);
  assert.equal(n.tasks.reduce((x, t) => x + t.hours, 0), 80);
  assert.equal(s.tasks[0].assignee, 'anna'); // вход не мутирован
});

test('validateTask: граничные оценки и строки', () => {
  for (const h of [0.5, 168, '0,5', ' 7 ', '5.']) assert.doesNotThrow(() => validateTask({ ...ok, hours: h }, emps()), String(h));
  for (const h of [0, 0.4, 168.5, 1.25, '', ' ', 'abc', '-1', '1e1', '0x10', null, true, NaN, Infinity]) {
    assert.throws(() => validateTask({ ...ok, hours: h }, emps()), Error, String(h));
  }
});

test('validateTask: строки названия/описания по границам', () => {
  assert.doesNotThrow(() => validateTask({ ...ok, title: 'x'.repeat(140), description: 'y'.repeat(1000) }, emps()));
  assert.throws(() => validateTask({ ...ok, title: 'x'.repeat(141) }, emps()));
  assert.throws(() => validateTask({ ...ok, description: 'y'.repeat(1001) }, emps()));
  assert.throws(() => validateTask({ ...ok, title: '   ' }, emps()));
});

// Зонды O1/O2 (см. QA-RESULTS): validateTask({week:[DEMO_WEEK]}) не бросает; isValidState принимает employees=[].
test('зонды O1/O2 фиксируют текущее поведение', () => {
  assert.doesNotThrow(() => validateTask({ ...ok, week: [DEMO_WEEK] }, emps()));
  const s = seedState(); s.employees = []; s.tasks.forEach((t) => { t.assignee = null; });
  assert.equal(isValidState(s), true);
});

test('isValidState: прочие порча-данные отклоняются', () => {
  const mut = (f) => { const s = seedState(); f(s); return isValidState(s); };
  assert.equal(isValidState(seedState()), true);
  assert.equal(isValidState(null), false);
  assert.equal(mut((s) => { s.nextId = 109; }), false);
  assert.equal(mut((s) => { s.nextId = 105; }), false);
  assert.equal(mut((s) => { s.tasks[1].id = s.tasks[0].id; }), false);
  assert.equal(mut((s) => { s.tasks[0].assignee = 'ghost'; }), false);
  assert.equal(mut((s) => { s.tasks[0].status = 'blocked'; }), false);
  assert.equal(mut((s) => { s.tasks[0].week = '2026-09-29'; }), false);
  assert.equal(mut((s) => { s.employees[0].capacity = 169; }), false);
  assert.equal(mut((s) => { s.employees[0].capacities = { '2026-09-29': 5 }; }), false);
  assert.equal(mut((s) => { s.employees[1].id = 'anna'; }), false);
  assert.equal(mut((s) => { s.tasks[0].title = '   '; }), false);
});

test('loadFor: недельная доступность и нулевой знаменатель', () => {
  const s = seedState();
  s.employees[0].capacities['2026-10-05'] = 40;
  assert.equal(loadFor(s, 'anna', '2026-10-05').capacity, 40);
  assert.equal(loadFor(s, 'anna', DEMO_WEEK).capacity, 24);
  const e = loadFor(s, 'anna', '2026-10-05');
  assert.equal(e.progress, 0); assert.equal(e.percent, 0);
  s.employees[0].capacities[DEMO_WEEK] = 0;
  const z = loadFor(s, 'anna', DEMO_WEEK);
  assert.equal(z.percent, null); assert.equal(z.overload, 32);
});
