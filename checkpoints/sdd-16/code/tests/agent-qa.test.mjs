// Проверки тестировщика (не заменяют acceptance): состояние, форма-валидация, CSS-классы
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/domain.js';

const base = { title: 'a', description: '', assignee: null, status: 'todo', week: D.DEMO_WEEK };
const hrs = (h) => { try { return D.validateTask({ ...base, hours: h }, []).hours; } catch { return 'ERR'; } };

test('seedState совпадает с docs/seed-state.json', () => {
  assert.deepEqual(D.seedState(), JSON.parse(readFileSync('docs/seed-state.json', 'utf8')));
});

test('isValidState отклоняет hours-строку (иначе суммы ломаются)', () => {
  const s = D.seedState(); s.tasks[0].hours = '16';
  assert.equal(D.isValidState(s), false);
});

test('isValidState отклоняет id задачи с кавычкой (инъекция в атрибут)', () => {
  const s = D.seedState(); s.tasks[0].id = 'x" onmouseover="1';
  assert.equal(D.isValidState(s), false);
});

test('isValidState: статус/доступность вне диапазона отклоняются', () => {
  const a = D.seedState(); a.tasks[0].status = 'blocked';
  const b = D.seedState(); b.employees[0].capacity = 169;
  assert.equal(D.isValidState(a), false);
  assert.equal(D.isValidState(b), false);
});

test('validateTask: числовые строки формы', () => {
  assert.equal(hrs('1,5'), 1.5); assert.equal(hrs(' 2 '), 2);
  for (const h of ['', 'abc', '0.4', 168.5, true, [5]]) assert.equal(hrs(h), 'ERR', String(h));
});

test('validateTask: шестнадцатеричная и экспоненциальная запись отклоняются', () => {
  assert.equal(hrs('0x10'), 'ERR');
  assert.equal(hrs('1e1'), 'ERR');
});

test('нулевая доступность: percent=null, overload=32, progress число', () => {
  const s = D.seedState(); s.employees[0].capacities[D.DEMO_WEEK] = 0;
  const l = D.loadFor(s, 'anna', D.DEMO_WEEK);
  assert.deepEqual([l.percent, l.overload, l.progress], [null, 32, 0]);
});

test('дефицит: Дмитрий 16, остальные 0 → unassigned 54; все нули → 70', () => {
  const d = D.seedState();
  for (const e of d.employees) e.capacities[D.DEMO_WEEK] = e.id === 'dmitry' ? 16 : 0;
  assert.equal(D.proposePlan(d, D.DEMO_WEEK).unassignedHours, 54);
  for (const e of d.employees) e.capacities[D.DEMO_WEEK] = 0;
  assert.equal(D.proposePlan(d, D.DEMO_WEEK).unassignedHours, 70);
});

test('proposePlan/applyPlan не мутируют вход и сохраняют часы', () => {
  const s = D.seedState(), snap = JSON.stringify(s);
  const next = D.applyPlan(s, D.proposePlan(s, D.DEMO_WEEK));
  assert.equal(JSON.stringify(s), snap);
  assert.equal(next.tasks.reduce((a, t) => a + t.hours, 0), 80);
});

test('monday: воскресенье → прошлый понедельник, невалидная дата → Error', () => {
  assert.equal(D.monday('2026-10-04'), '2026-09-28');
  assert.equal(D.monday('2026-10-05'), '2026-10-05');
  assert.throws(() => D.monday('2026-02-30'));
});
