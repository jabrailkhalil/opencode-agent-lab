// Проверки тестировщика: классы Tabler из dist и отсутствие внешних ресурсов
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('dist/vendor/tabler/tabler.min.css', 'utf8');
const used = ['page', 'page-wrapper', 'page-body', 'page-title', 'page-pretitle', 'navbar', 'navbar-brand', 'container-xl',
  'card', 'card-sm', 'card-body', 'card-header', 'card-title', 'btn', 'btn-primary', 'btn-outline-primary', 'btn-outline-secondary',
  'btn-outline-danger', 'btn-danger', 'btn-sm', 'btn-close', 'form-control', 'form-select', 'form-label', 'form-hint', 'is-invalid',
  'badge', 'bg-blue-lt', 'bg-green-lt', 'bg-red-lt', 'bg-secondary-lt', 'bg-red', 'bg-green', 'progress', 'progress-bar', 'progress-sm',
  'avatar', 'avatar-sm', 'alert', 'alert-danger', 'alert-warning', 'alert-success', 'alert-info', 'alert-dismissible',
  'visually-hidden', 'text-danger', 'small', 'ms-auto', 'mt-3', 'mb-2', 'd-flex', 'flex-column', 'gap-2', 'gap-3'];

test('классы Tabler, использованные в разметке, есть в локальном CSS', () => {
  const miss = used.filter((n) => !new RegExp('\\.' + n.replace(/-/g, '\\-') + '(?![\\w-])').test(css));
  assert.deepEqual(miss, []);
});

test('в dist нет внешних ресурсов (html/css/js приложения)', () => {
  for (const f of ['index.html', 'styles.css', 'app.js', 'domain.js']) {
    const t = readFileSync('dist/' + f, 'utf8');
    assert.equal(/(?:src|href)=["']https?:|url\(["']?https?:|@import|fetch\(/.test(t), false, f);
  }
});

test('Tabler CSS без @import и url(http...)', () => {
  assert.deepEqual(css.match(/@import[^;]*;/g) || [], []);
  assert.equal((css.match(/url\(["']?https?:[^)]*\)/g) || []).length, 0);
});
