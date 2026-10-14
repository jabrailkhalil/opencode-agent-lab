import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState, DEMO_WEEK, monday, loadFor, validateTask, proposePlan, applyPlan, isValidState } from '../dist/domain.js';

const emps = seedState().employees;
const ok = { title: 'T', description: '', assignee: null, hours: 1, status: 'todo', week: DEMO_WEEK };
const bad = (patch) => assert.throws(() => validateTask({ ...ok, ...patch }, emps));
const good = (patch) => assert.doesNotThrow(() => validateTask({ ...ok, ...patch }, emps));

test('границы валидации задачи', () => {
  good({ title: 'a'.repeat(140) }); bad({ title: 'a'.repeat(141) }); bad({ title: '   ' });
  good({ description: 'a'.repeat(1000) }); bad({ description: 'a'.repeat(1001) });
  good({ hours: 0.5 }); good({ hours: 168 }); bad({ hours: 0 }); bad({ hours: 168.5 });
  bad({ hours: 0.25 }); bad({ hours: NaN }); bad({ hours: '8' });
  bad({ assignee: 'ghost' }); bad({ status: 'review' });
  bad({ week: '2026-09-29' }); bad({ week: '2026-02-30' }); bad({ week: '' });
});

test('validateTask не мутирует вход и обрезает пробелы', () => {
  const t = Object.freeze({ ...ok, title: '  Имя  ', description: ' д ' });
  const r = validateTask(t, emps);
  assert.equal(r.title, 'Имя'); assert.equal(r.description, 'д'); assert.equal(t.title, '  Имя  ');
});

test('proposePlan не мутирует состояние; applyPlan снимает перегрузку на seed', () => {
  const s = seedState(); const snap = JSON.stringify(s);
  const p = proposePlan(s, DEMO_WEEK);
  assert.equal(JSON.stringify(s), snap);
  const n = applyPlan(s, p);
  assert.equal(JSON.stringify(s), snap);
  for (const e of s.employees) assert.equal(loadFor(n, e.id, DEMO_WEEK).overload, 0);
  assert.equal(n.tasks.length, s.tasks.length);
  assert.equal(p.unassignedHours, 0);
});

test('нулевая доступность у всех: все активные остаются без ответственного', () => {
  const s = seedState(); s.employees.forEach((e) => { e.capacities[DEMO_WEEK] = 0; });
  const p = proposePlan(s, DEMO_WEEK);
  assert.equal(p.unassignedHours, 70);
  assert.ok(p.assignments.every((a) => a.assignee === null));
  const n = applyPlan(s, p);
  assert.equal(n.tasks.filter((t) => t.status === 'done' && t.assignee).length, 2);
});

test('seed: 9 задач, 80 ч, 7 активных / 70 ч, проценты', () => {
  const s = seedState();
  assert.equal(s.tasks.length, 9);
  assert.equal(s.tasks.reduce((a, t) => a + t.hours, 0), 80);
  const a = loadFor(s, 'anna', DEMO_WEEK), m = loadFor(s, 'maria', DEMO_WEEK), i = loadFor(s, 'ilya', DEMO_WEEK);
  assert.deepEqual([a.hours, a.capacity, a.percent, a.overload], [32, 24, 133, 8]);
  assert.equal(m.progress, 43); assert.equal(i.progress, 25);
});

test('isValidState: граничные нарушения', () => {
  const mut = (f) => { const s = JSON.parse(JSON.stringify(seedState())); f(s); return isValidState(s); };
  assert.equal(mut(() => {}), true);
  assert.equal(mut((s) => { s.nextId = 109; }), false);
  assert.equal(mut((s) => { s.tasks[1].id = s.tasks[0].id; }), false);
  assert.equal(mut((s) => { s.employees[1].id = 'anna'; }), false);
  assert.equal(mut((s) => { s.tasks[0].assignee = 'ghost'; }), false);
  assert.equal(mut((s) => { s.employees[0].capacity = 169; }), false);
  assert.equal(mut((s) => { s.tasks[0].week = '2026-09-29'; }), false);
  assert.equal(isValidState(null), false); assert.equal(isValidState('x'), false); assert.equal(isValidState([]), false);
});

test('monday: воскресенье и понедельник, начало года', () => {
  assert.equal(monday('2026-10-04'), '2026-09-28');
  assert.equal(monday('2026-09-28'), '2026-09-28');
  assert.equal(monday('2027-01-01'), '2026-12-28');
});
