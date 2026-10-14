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
  // Составные id (employee-*, load-*, task-TASK-101…) собираются шаблонами `"prefix-${…}"` в app.js,
  // поэтому ищем не строку целиком, а префикс шаблона.
  const COMPOSED = ['employee-', 'load-', 'progress-', 'capacity-', 'task-', 'edit-', 'delete-'];
  const missing = CONTRACT.filter(t => {
    if (html.includes(`"${t}"`) || js.includes(`"${t}"`)) return false;
    const prefix = COMPOSED.find(p => t.startsWith(p));
    return !(prefix && js.includes(`"${prefix}\${`));
  });
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

// Правки 4.2/4.3: пустая доступность не пишется молча; активный tab — читаемый контраст.
test('контраст активного tab ≥4.5:1 и guard пустого ввода доступности (4.2/4.3)', () => {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = h => { const n = parseInt(h.slice(1), 16);
    return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
  const contrast = (f, b) => (Math.max(lum(f), lum(b)) + 0.05) / (Math.min(lum(f), lum(b)) + 0.05);
  const rule = css.match(/\.btn\[aria-pressed="true"\]\s*{[^}]*}/);
  assert.ok(rule, 'нет правила для активной кнопки');
  assert.match(rule[0], /background:\s*var\(--pt-accent\)/, 'фон не залит акцентом');
  assert.match(rule[0], /color:\s*#fff/, 'текст не белый');
  assert.ok(contrast('#ffffff', '#206bc4') >= 4.5, `контраст #fff/#206bc4 = ${contrast('#ffffff', '#206bc4').toFixed(2)}`);
  assert.doesNotMatch(rule[0], /(?:^|[{;\s])color:\s*var\(--pt-accent\)/m, 'старый дефект: accent-текст');
  const cap = js.match(/function onCapacity\(e\)[\s\S]*?\n}/)?.[0] ?? '';
  assert.match(cap, /raw === ''/, 'пустая строка не отклоняется до Number()');
  assert.match(cap, /el\.value = String\(current\)/, 'нет отката к прежнему значению');
  assert.match(cap, /Прежнее значение сохранено/, 'нет сообщения об ошибке');
  assert.match(cap, /Number\.isInteger\(Number\(raw\) \* 2\)/, 'нет проверки шага 0,5');
  assert.doesNotMatch(cap, /emp\.capacities[^}]*\b0\b(?![\d.])/, 'нет молчаливой записи нуля');
});
