// tests/agent-ui.test.mjs — статический аудит UI-контракта (без браузера).
// Только чтение dist/*; ничего не изменяем. Визуальные сценарии здесь не проверяются.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const js = readFileSync('dist/app.js', 'utf8');
const css = readFileSync('dist/styles.css', 'utf8');
const tabler = readFileSync('dist/vendor/tabler/tabler.min.css', 'utf8');

const CONTRACT = ['app', 'new-task', 'task-form', 'task-title', 'task-description', 'task-hours',
  'task-assignee', 'task-status', 'task-week', 'task-save', 'task-cancel', 'task-error', 'search',
  'filter-assignee', 'prev-week', 'next-week', 'current-week', 'view-board', 'view-employees',
  'board', 'employees-view', 'column-todo', 'column-doing', 'column-done', 'propose-plan',
  'plan-preview', 'plan-apply', 'plan-cancel', 'reset-demo',
  'employee-anna', 'employee-dmitry', 'employee-maria', 'employee-ilya',
  'load-anna', 'load-dmitry', 'load-maria', 'load-ilya',
  'progress-anna', 'progress-maria', 'capacity-anna', 'capacity-ilya',
  'task-TASK-101', 'edit-TASK-101', 'delete-TASK-101'];

test('контракт INTERFACES.md: все data-testid присутствуют (статически или в шаблоне)', () => {
  const missing = CONTRACT.filter(t => !html.includes(`"${t}"`) && !js.includes(`"${t}"`) && !js.includes('${t}'));
  assert.deepEqual(missing, []);
  for (const p of ['task-${', 'edit-${', 'delete-${', 'load-${', 'progress-${', 'capacity-${', 'employee-${'])
    assert.ok(js.includes(p), 'нет шаблона ' + p);
});

test('HTML: реальные id уникальны, поля формы подписаны for/id', () => {
  const ids = [...html.matchAll(/(?<!test)id="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  assert.deepEqual(dup, [], 'дубли id');
  for (const f of ['search', 'filter-assignee', 'task-title', 'task-description', 'task-hours',
    'task-assignee', 'task-status', 'task-week'])
    assert.ok(html.includes(`for="${f}"`), 'нет label for=' + f);
  assert.ok(!/required/.test(html), 'required в форме (ломает прикладную trim-валидацию)');
  assert.ok(html.includes('novalidate'), 'form без novalidate');
});

test('app.js: селекторы и data-action разрешимы', () => {
  for (const id of new Set([...js.matchAll(/\$\('#([\w-]+)'\)/g)].map(m => m[1])))
    assert.ok(html.includes(` id="${id}"`), 'нет #' + id);
  for (const t of new Set([...js.matchAll(/\$\('\[data-testid="([\w-]+)"\]'\)/g)].map(m => m[1])))
    assert.ok(html.includes(`data-testid="${t}"`), 'нет testid ' + t);
  const actions = new Set([...html.matchAll(/data-action="([\w-]+)"/g)].map(m => m[1])
    .concat([...js.matchAll(/data-action="([\w-]+)"/g)].map(m => m[1]))
    .concat([...js.matchAll(/name === '([\w-]+)'/g)].map(m => m[1])));
  const handled = new Set([...js.matchAll(/name === '([\w-]+)'/g)].map(m => m[1]));
  assert.deepEqual([...actions].filter(a => !handled.has(a)), [], 'action без обработчика');
});
