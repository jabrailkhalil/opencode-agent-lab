import {
  DEMO_WEEK, STATUSES, STATUS_LABELS, seedState, addDays, loadFor, capacityFor,
  validateTask, proposePlan, applyPlan, isValidState,
} from './domain.js';

const STORAGE_KEY = 'potok.state.v1';
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const STATUS_BADGE = { todo: 'bg-secondary-lt', doing: 'bg-blue-lt', done: 'bg-green-lt' };

const $ = (sel, root = document) => root.querySelector(sel);
const byTestId = (id) => document.querySelector(`[data-testid="${id}"]`);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace('.', ','));
const pct = (n) => (n === null ? '—' : n + '%');

function fmtWeek(week) {
  const end = addDays(week, 6);
  const part = (iso) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
  const sameYear = week.slice(0, 4) === end.slice(0, 4);
  return sameYear ? `${part(week)} – ${part(end)} ${end.slice(0, 4)}` : `${part(week)} ${week.slice(0, 4)} – ${part(end)} ${end.slice(0, 4)}`;
}

/* ---------- Состояние и хранилище ---------- */

const ui = { week: DEMO_WEEK, view: 'board', search: '', filter: '', plan: null, editingId: null };
let state;
let storageProblem = false;

function loadState() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return seedState();
  }
  if (raw === null) return seedState();
  try {
    const parsed = JSON.parse(raw);
    if (isValidState(parsed)) return parsed;
  } catch { /* повреждённый JSON */ }
  storageProblem = true;
  return seedState();
}

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    toast('Не удалось сохранить данные в браузере');
    return false;
  }
}

/* ---------- Элементы ---------- */

const el = {
  root: $('#root'), team: $('#team-load'), board: $('#board'), employees: $('#employees-view'),
  plan: $('#plan-preview'), results: $('#results-count'), search: $('#search'), filter: $('#filter-assignee'),
  weekLabel: $('#week-label'), weekIso: $('#week-iso'),
  modal: $('#task-modal'), backdrop: $('#modal-backdrop'), form: $('#task-form'), error: $('#task-error'),
  title: $('#task-title'), description: $('#task-description'), assignee: $('#task-assignee'),
  hours: $('#task-hours'), status: $('#task-status'), week: $('#task-week'), counter: $('#description-counter'),
  heading: $('#task-modal-title'), toast: $('#toast'),
  notice: $('#storage-notice'),
};

let toastTimer = null;
function toast(message) {
  el.toast.innerHTML = '';
  const span = document.createElement('span');
  span.className = 'potok-toast-msg';
  span.textContent = message;
  el.toast.appendChild(span);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.innerHTML = ''; }, 4500);
}

/* ---------- Выборки ---------- */

const weekTasks = () => state.tasks.filter((t) => t.week === ui.week);
const empById = (id) => state.employees.find((e) => e.id === id) || null;

function visibleTasks() {
  const q = ui.search.trim().toLocaleLowerCase('ru');
  return weekTasks().filter((t) => {
    if (ui.filter && t.assignee !== ui.filter) return false;
    if (!q) return true;
    return t.title.toLocaleLowerCase('ru').includes(q) || (t.description || '').toLocaleLowerCase('ru').includes(q);
  });
}

const sumHours = (list) => list.reduce((s, t) => s + t.hours, 0);
const safeColor = (c) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : '#667382');
const avatar = (e) => `<span class="potok-avatar" style="background:${safeColor(e.color)}" aria-hidden="true">${esc(e.initials || e.name.slice(0, 2))}</span>`;

/* ---------- Рендер: неделя и метрики ---------- */

function renderWeek() {
  el.weekLabel.textContent = fmtWeek(ui.week);
  el.weekLabel.setAttribute('datetime', ui.week);
  el.weekIso.textContent = 'неделя с ' + ui.week;
  byTestId('current-week').dataset.week = ui.week;
}

function renderMetrics() {
  const tasks = weekTasks();
  const active = tasks.filter((t) => t.status !== 'done');
  const total = sumHours(tasks);
  const done = total - sumHours(active);
  $('#metric-tasks').textContent = String(tasks.length);
  $('#metric-hours').textContent = fmt(total) + ' ч';
  $('#metric-active').textContent = `${active.length} задач / ${fmt(sumHours(active))} ч`;
  $('#metric-done').textContent = `${fmt(done)} ч · ${total > 0 ? Math.round((done / total) * 100) : 0}%`;
}

/* ---------- Рендер: загрузка команды ---------- */

function buildTeam() {
  el.team.innerHTML = state.employees.map((e) => `
    <article class="card potok-team-card" data-testid="employee-${esc(e.id)}" data-employee="${esc(e.id)}">
      <div class="card-body">
        <div class="potok-person">${avatar(e)}
          <div class="potok-person-text"><strong>${esc(e.name)}</strong><span class="potok-role">${esc(e.role || '')}</span></div>
        </div>
        <div class="potok-stat">
          <div class="potok-stat-row"><span class="potok-stat-label">Загрузка</span><strong class="potok-stat-value" data-testid="load-${esc(e.id)}"></strong></div>
          <div class="potok-meter" aria-hidden="true"><div class="potok-meter-fill" data-role="load-bar" style="width:0%"></div></div>
          <div class="potok-badge-row"><span class="badge" data-role="load-badge"></span></div>
        </div>
        <div class="potok-stat">
          <div class="potok-stat-row"><span class="potok-stat-label">Выполнено</span><strong class="potok-stat-value" data-testid="progress-${esc(e.id)}"></strong></div>
          <div class="progress progress-sm" role="progressbar" data-role="done-track" data-testid="progress-bar-${esc(e.id)}" aria-label="Выполнено, ${esc(e.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="progress-bar is-done" data-role="done-bar" style="width:0%"></div></div>
        </div>
        <div class="potok-capacity">
          <label for="capacity-${esc(e.id)}">Доступность, ч/нед</label>
          <input type="number" class="form-control" id="capacity-${esc(e.id)}" data-testid="capacity-${esc(e.id)}" data-employee="${esc(e.id)}" min="0" max="168" step="0.5" inputmode="decimal" aria-describedby="capacity-error-${esc(e.id)}">
          <div class="invalid-feedback" id="capacity-error-${esc(e.id)}" data-testid="capacity-error-${esc(e.id)}"></div>
        </div>
      </div>
    </article>`).join('');
  el.team.dataset.built = state.employees.map((e) => e.id).join(',');
}

function renderTeam(force = false) {
  if (el.team.dataset.built !== state.employees.map((e) => e.id).join(',')) buildTeam();
  for (const e of state.employees) {
    const card = $(`[data-employee="${e.id}"]`, el.team);
    const l = loadFor(state, e.id, ui.week);
    $(`[data-testid="load-${e.id}"]`, card).textContent = `${fmt(l.hours)} / ${fmt(l.capacity)} ч · ${pct(l.percent)}`;
    const bar = $('[data-role="load-bar"]', card);
    const width = l.percent === null ? 0 : Math.min(l.percent, 100);
    bar.style.width = width + '%';
    bar.className = 'potok-meter-fill' + (l.overload > 0 ? ' is-over' : l.percent !== null && l.percent >= 90 ? ' is-warn' : '');
    const badge = $('[data-role="load-badge"]', card);
    if (l.overload > 0) { badge.className = 'badge bg-red-lt'; badge.textContent = `Перегрузка +${fmt(l.overload)} ч`; }
    else if (l.capacity <= 0) { badge.className = 'badge bg-secondary-lt'; badge.textContent = 'Нет доступности'; }
    else if (l.hours === l.capacity) { badge.className = 'badge bg-orange-lt'; badge.textContent = 'Загружено полностью'; }
    else { badge.className = 'badge bg-green-lt'; badge.textContent = `Свободно ${fmt(l.capacity - l.hours)} ч`; }
    $(`[data-testid="progress-${e.id}"]`, card).textContent = `${l.progress}% · ${fmt(l.doneHours)} из ${fmt(l.totalHours)} ч`;
    $('[data-role="done-bar"]', card).style.width = l.progress + '%';
    const track = $('[data-role="done-track"]', card);
    track.setAttribute('aria-valuenow', String(l.progress));
    track.setAttribute('aria-valuetext', `${l.progress}%: ${fmt(l.doneHours)} из ${fmt(l.totalHours)} ч`);
    const input = $(`[data-testid="capacity-${e.id}"]`, card);
    if (force) { input.classList.remove('is-invalid'); input.removeAttribute('aria-invalid'); input.dataset.invalid = ''; $(`[data-testid="capacity-error-${e.id}"]`, card).textContent = ''; }
    if (!input.dataset.invalid && document.activeElement !== input) input.value = String(l.capacity);
  }
}

function commitCapacity(input) {
  const id = input.dataset.employee;
  const employee = empById(id);
  if (!employee) return;
  const errorEl = $(`[data-testid="capacity-error-${id}"]`);
  const raw = input.value.trim();
  const n = raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 168 || !Number.isInteger(n * 2)) {
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    input.dataset.invalid = '1';
    errorEl.textContent = 'Доступность: число от 0 до 168 (шаг 0,5)';
    return;
  }
  input.classList.remove('is-invalid');
  input.removeAttribute('aria-invalid');
  input.dataset.invalid = '';
  errorEl.textContent = '';
  if (!employee.capacities || typeof employee.capacities !== 'object') employee.capacities = {};
  if (employee.capacities[ui.week] === n) return;
  employee.capacities[ui.week] = n;
  saveState();
  resetPlan(true);
  renderAll();
}

/* ---------- Рендер: управление ---------- */

function renderFilterOptions() {
  const current = ui.filter;
  el.filter.innerHTML = '<option value="">Все</option>' + state.employees.map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
  el.filter.value = state.employees.some((e) => e.id === current) ? current : '';
  ui.filter = el.filter.value;
}

function renderControls() {
  const all = weekTasks().length;
  const found = visibleTasks().length;
  el.results.textContent = `Найдено: ${found} из ${all}`;
  const board = ui.view === 'board';
  const vb = byTestId('view-board'), ve = byTestId('view-employees');
  vb.classList.toggle('active', board); ve.classList.toggle('active', !board);
  vb.setAttribute('aria-pressed', String(board)); ve.setAttribute('aria-pressed', String(!board));
  byTestId('propose-plan').disabled = !!ui.plan;
}

/* ---------- Рендер: задачи ---------- */

function assigneeHtml(t) {
  const e = t.assignee ? empById(t.assignee) : null;
  return e ? `<span class="potok-assignee">${avatar(e)}<span>${esc(e.name)}</span></span>` : '<span class="potok-assignee is-none">Без ответственного</span>';
}

function actionsHtml(t) {
  return `<button type="button" class="btn btn-sm" data-action="edit" data-task-id="${esc(t.id)}" data-testid="edit-${esc(t.id)}" aria-label="Изменить ${esc(t.id)}">Изменить</button>` +
    `<button type="button" class="btn btn-sm btn-ghost-danger" data-action="delete" data-task-id="${esc(t.id)}" data-testid="delete-${esc(t.id)}" aria-label="Удалить ${esc(t.id)}">Удалить</button>`;
}

function statusBadge(t) {
  return `<span class="badge ${STATUS_BADGE[t.status]}">${esc(STATUS_LABELS[t.status])}</span>`;
}

function cardHtml(t) {
  const done = t.status === 'done';
  return `<article class="card card-sm potok-task${done ? ' is-done' : ''}" draggable="true" data-testid="task-${esc(t.id)}" data-task-id="${esc(t.id)}">
    <div class="card-body">
      <div class="potok-task-top"><span class="potok-task-id">${esc(t.id)}</span>${statusBadge(t)}</div>
      <h4 class="potok-task-title">${done ? '<span aria-hidden="true">✓ </span>' : ''}${esc(t.title)}</h4>
      ${t.description ? `<p class="potok-task-desc">${esc(t.description)}</p>` : ''}
      <div class="potok-task-meta"><span class="badge bg-blue-lt">${fmt(t.hours)} ч</span>${assigneeHtml(t)}</div>
      <div class="potok-task-actions">${actionsHtml(t)}</div>
    </div></article>`;
}

function emptyResultsHtml() {
  const total = weekTasks().length;
  if (total === 0) return '<div class="alert alert-info potok-board-alert" data-testid="empty-week">На этой неделе задач нет. Создайте первую.</div>';
  if (visibleTasks().length === 0) {
    return '<div class="alert alert-info potok-board-alert" data-testid="empty-results">Ничего не найдено. <button type="button" class="btn btn-sm" data-action="reset-search">Сбросить поиск</button></div>';
  }
  return '';
}

function renderBoard() {
  const tasks = visibleTasks();
  const filtered = !!(ui.search.trim() || ui.filter);
  const columns = STATUSES.map((s) => {
    const items = tasks.filter((t) => t.status === s);
    return `<section class="potok-column" data-testid="column-${s}" data-status="${s}" aria-labelledby="col-title-${s}">
      <header class="potok-column-head"><h3 id="col-title-${s}">${STATUS_LABELS[s]}</h3><span class="badge ${STATUS_BADGE[s]}">${items.length} · ${fmt(sumHours(items))} ч</span></header>
      <div class="potok-column-body">${items.length ? items.map(cardHtml).join('') : `<div class="potok-empty">${filtered ? 'Нет подходящих задач' : 'Нет задач — перетащите сюда'}</div>`}</div>
    </section>`;
  }).join('');
  el.board.innerHTML = emptyResultsHtml() + columns;
}

function rowHtml(t) {
  return `<tr data-testid="task-${esc(t.id)}" data-task-id="${esc(t.id)}">
    <td data-label="ID">${esc(t.id)}</td>
    <td data-label="Название"><strong>${esc(t.title)}</strong></td>
    <td data-label="Статус">${statusBadge(t)}</td>
    <td data-label="Часы">${fmt(t.hours)} ч</td>
    <td data-label="Действия" class="actions">${actionsHtml(t)}</td></tr>`;
}

function renderEmployeesView() {
  const tasks = visibleTasks();
  const hasTasks = weekTasks().length > 0;
  const groups = state.employees.map((e) => ({ key: e.id, emp: e, tasks: tasks.filter((t) => t.assignee === e.id) }));
  groups.push({ key: 'none', emp: null, tasks: tasks.filter((t) => !t.assignee || !empById(t.assignee)) });
  const shown = groups.filter((g) => !ui.filter || g.key === ui.filter);
  const html = shown.map((g) => {
    let head;
    if (g.emp) {
      const l = loadFor(state, g.emp.id, ui.week);
      head = `${avatar(g.emp)}<div class="potok-person-text"><strong>${esc(g.emp.name)}</strong><span class="potok-role">${esc(g.emp.role || '')}</span></div>
        <span class="potok-group-stats">Нагрузка: ${fmt(l.hours)} / ${fmt(l.capacity)} ч · Выполнено: ${l.progress}%</span>`;
    } else {
      const un = weekTasks().filter((t) => !t.assignee && t.status !== 'done');
      head = `<span class="potok-avatar" aria-hidden="true">?</span><div class="potok-person-text"><strong>Без ответственного</strong></div>
        <span class="potok-group-stats">Активно: ${fmt(sumHours(un))} ч</span>`;
    }
    const body = g.tasks.length
      ? `<table class="table card-table potok-table"><thead><tr><th class="col-id">ID</th><th>Название</th><th class="col-status">Статус</th><th class="col-hours">Часы</th><th class="col-actions">Действия</th></tr></thead><tbody>${g.tasks.map(rowHtml).join('')}</tbody></table>`
      : `<div class="potok-group-empty">${hasTasks ? 'Нет подходящих задач' : 'Нет задач на эту неделю'}</div>`;
    return `<section class="card potok-group" data-testid="group-${esc(g.key)}"><div class="card-header">${head}</div>${body}</section>`;
  }).join('');
  el.employees.innerHTML = emptyResultsHtml() + html;
}

function renderView() {
  const board = ui.view === 'board';
  el.board.hidden = !board;
  el.employees.hidden = board;
  if (board) {
    el.board.setAttribute('data-testid', 'board');
    el.employees.removeAttribute('data-testid');
    el.employees.innerHTML = '';
    renderBoard();
  } else {
    el.employees.setAttribute('data-testid', 'employees-view');
    el.board.removeAttribute('data-testid');
    el.board.innerHTML = '';
    renderEmployeesView();
  }
}

/* ---------- Предпросмотр плана ---------- */

function renderPlan() {
  if (!ui.plan) { el.plan.hidden = true; el.plan.innerHTML = ''; return; }
  const { plan } = ui.plan;
  const next = applyPlan(state, plan);
  const rows = plan.assignments.map((a) => {
    const t = state.tasks.find((x) => x.id === a.taskId);
    if (!t) return '';
    const name = (id) => (id && empById(id) ? empById(id).name : 'Без ответственного');
    const changed = (t.assignee || null) !== (a.assignee || null);
    return `<tr class="${changed ? 'is-changed' : ''}"><td data-label="Задача">${esc(t.id)} · ${esc(t.title)}</td><td data-label="Было">${esc(name(t.assignee))}</td><td data-label="Станет">${esc(name(a.assignee))}</td><td data-label="Часы">${fmt(t.hours)} ч</td></tr>`;
  }).join('');
  const assigned = plan.assignments.filter((a) => a.assignee).length;
  const after = state.employees.map((e) => {
    const l = loadFor(next, e.id, ui.week);
    return `<li>${esc(e.name)}: ${fmt(l.hours)} / ${fmt(l.capacity)} ч</li>`;
  }).join('');
  el.plan.innerHTML = `<div class="card-body">
    <h2 id="plan-title" class="card-title">Предложенное распределение</h2>
    <p class="text-secondary m-0">Это предпросмотр — план не изменён. Неделя с ${esc(ui.week)}.</p>
    <table class="table potok-plan-table"><thead><tr><th>Задача</th><th>Было</th><th>Станет</th><th>Часы</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="m-0">Назначено задач: ${assigned} из ${plan.assignments.length}. Не помещается: ${fmt(plan.unassignedHours)} ч (остаются без ответственного).</p>
    <div><strong>После применения:</strong><ul class="potok-plan-after">${after}</ul></div>
    <div class="potok-plan-actions">
      <button type="button" class="btn btn-primary" data-testid="plan-apply">Применить</button>
      <button type="button" class="btn" data-testid="plan-cancel">Отмена</button>
    </div></div>`;
  el.plan.hidden = false;
}

function resetPlan(announce) {
  if (!ui.plan) return;
  ui.plan = null;
  renderPlan();
  if (announce) toast('Предпросмотр сброшен');
}

function proposeClick() {
  if (ui.plan) return;
  const active = weekTasks().filter((t) => t.status !== 'done');
  if (!active.length) { toast('Нет активных задач для распределения'); return; }
  ui.plan = { week: ui.week, plan: proposePlan(state, ui.week) };
  renderPlan();
  renderControls();
  el.plan.setAttribute('tabindex', '-1');
  el.plan.focus({ preventScroll: true });
  el.plan.scrollIntoView({ block: 'nearest' });
}

function applyClick() {
  if (!ui.plan) return;
  state = applyPlan(state, ui.plan.plan);
  ui.plan = null;
  saveState();
  renderAll();
  toast('План применён');
}

function cancelPlan() {
  if (!ui.plan) return;
  ui.plan = null;
  renderAll();
  toast('Предпросмотр отменён');
}

/* ---------- Общий рендер ---------- */

function renderAll(forceCapacity = false) {
  renderWeek();
  renderMetrics();
  renderTeam(forceCapacity);
  renderControls();
  renderPlan();
  renderView();
}

/* ---------- Форма задачи ---------- */

let lastFocus = null;

function clearFormErrors() {
  el.error.hidden = true;
  el.error.innerHTML = '';
  for (const f of el.form.querySelectorAll('.is-invalid')) { f.classList.remove('is-invalid'); f.removeAttribute('aria-invalid'); }
  for (const m of el.form.querySelectorAll('[data-error-for]')) m.textContent = '';
}

function updateCounter() {
  el.counter.textContent = `${el.description.value.length} / 1000`;
}

function openForm(task) {
  lastFocus = document.activeElement;
  ui.editingId = task ? task.id : null;
  el.heading.textContent = task ? `Изменить ${task.id}` : 'Новая задача';
  el.assignee.innerHTML = '<option value="">Без ответственного</option>' + state.employees.map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
  el.title.value = task ? task.title : '';
  el.description.value = task ? task.description || '' : '';
  el.assignee.value = task && task.assignee ? task.assignee : '';
  el.hours.value = task ? String(task.hours) : '';
  el.status.value = task ? task.status : 'todo';
  el.week.value = task ? task.week : ui.week;
  clearFormErrors();
  updateCounter();
  el.modal.hidden = false;
  el.backdrop.hidden = false;
  el.modal.style.display = 'block';
  el.modal.classList.add('show');
  el.backdrop.classList.add('show');
  document.body.classList.add('modal-open');
  el.title.focus();
}

function closeForm() {
  el.modal.classList.remove('show');
  el.backdrop.classList.remove('show');
  el.modal.style.display = 'none';
  el.modal.hidden = true;
  el.backdrop.hidden = true;
  document.body.classList.remove('modal-open');
  ui.editingId = null;
  if (lastFocus && document.contains(lastFocus) && typeof lastFocus.focus === 'function') lastFocus.focus();
  lastFocus = null;
}

const isFormOpen = () => !el.modal.hidden;

const FIELD_INPUT = { title: el.title, description: el.description, assignee: el.assignee, hours: el.hours, status: el.status, week: el.week };

function showFormErrors(errors) {
  el.error.innerHTML = errors.length === 1 ? esc(errors[0].message) : '<ul>' + errors.map((e) => `<li>${esc(e.message)}</li>`).join('') + '</ul>';
  el.error.hidden = false;
  let first = null;
  for (const err of errors) {
    const input = FIELD_INPUT[err.field];
    if (!input) continue;
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    const msg = el.form.querySelector(`[data-error-for="${err.field}"]`);
    if (msg) msg.textContent = err.message;
    if (!first) first = input;
  }
  (first || el.title).focus();
}

function submitForm() {
  const rawHours = el.hours.value.trim();
  const candidate = {
    title: el.title.value,
    description: el.description.value,
    assignee: el.assignee.value || null,
    hours: rawHours === '' ? NaN : Number(rawHours),
    status: el.status.value,
    week: el.week.value,
  };
  let valid;
  try {
    valid = validateTask(candidate, state.employees);
  } catch (err) {
    clearFormErrors();
    showFormErrors(err.errors && err.errors.length ? err.errors : [{ field: null, message: err.message }]);
    return;
  }
  clearFormErrors();
  let id;
  if (ui.editingId) {
    const existing = state.tasks.find((t) => t.id === ui.editingId);
    if (!existing) { closeForm(); toast('Задача уже удалена'); renderAll(); return; }
    Object.assign(existing, valid, { id: existing.id });
    id = existing.id;
  } else {
    const maxNum = state.tasks.reduce((m, t) => Math.max(m, Number(String(t.id).replace(/\D/g, '')) || 0), 0);
    const num = Math.max(state.nextId, maxNum + 1);
    id = 'TASK-' + num;
    state.nextId = num + 1;
    state.tasks.push({ ...valid, id });
  }
  saveState();
  const hadPlan = !!ui.plan;
  ui.plan = null;
  closeForm();
  renderAll();
  toast(valid.week === ui.week ? `Задача ${id} сохранена` : `Задача ${id} сохранена на неделе ${valid.week}`);
  if (hadPlan) toast('Задача сохранена, предпросмотр сброшен');
}

/* ---------- Действия над задачами ---------- */

function deleteTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  if (!window.confirm(`Удалить задачу ${t.id} «${t.title}»?`)) return;
  state.tasks = state.tasks.filter((x) => x.id !== id);
  saveState();
  ui.plan = null;
  renderAll();
  toast(`Задача ${id} удалена`);
}

function moveTask(id, status) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || !STATUSES.includes(status) || t.status === status) return;
  t.status = status;
  saveState();
  const hadPlan = !!ui.plan;
  ui.plan = null;
  renderAll();
  toast(hadPlan ? `${id} → ${STATUS_LABELS[status]}. Предпросмотр сброшен` : `${id} → ${STATUS_LABELS[status]}`);
}

function resetDemo() {
  if (!window.confirm('Заменить все данные учебным примером? Текущие изменения будут потеряны.')) return;
  state = seedState();
  ui.week = DEMO_WEEK; ui.search = ''; ui.filter = ''; ui.plan = null;
  el.search.value = '';
  renderFilterOptions();
  saveState();
  renderAll(true);
  toast('Учебный пример восстановлен');
}

function setWeek(week) {
  ui.week = week;
  const hadPlan = !!ui.plan;
  ui.plan = null;
  renderAll(true);
  if (hadPlan) toast('Предпросмотр сброшен');
}

/* ---------- События ---------- */

document.addEventListener('click', (ev) => {
  const target = ev.target instanceof Element ? ev.target : null;
  if (!target) return;
  const actionEl = target.closest('[data-action]');
  if (actionEl) {
    const id = actionEl.dataset.taskId;
    if (actionEl.dataset.action === 'edit') { const t = state.tasks.find((x) => x.id === id); if (t) openForm(t); }
    else if (actionEl.dataset.action === 'delete') deleteTask(id);
    else if (actionEl.dataset.action === 'reset-search') {
      ui.search = ''; ui.filter = ''; el.search.value = ''; el.filter.value = ''; renderControls(); renderView();
    }
    return;
  }
  const tidEl = target.closest('[data-testid]');
  switch (tidEl && tidEl.dataset.testid) {
    case 'new-task': openForm(null); break;
    case 'prev-week': setWeek(addDays(ui.week, -7)); break;
    case 'next-week': setWeek(addDays(ui.week, 7)); break;
    case 'current-week': if (ui.week !== DEMO_WEEK) setWeek(DEMO_WEEK); break;
    case 'view-board': ui.view = 'board'; renderControls(); renderView(); break;
    case 'view-employees': ui.view = 'employees'; renderControls(); renderView(); break;
    case 'propose-plan': proposeClick(); break;
    case 'plan-apply': applyClick(); break;
    case 'plan-cancel': cancelPlan(); break;
    case 'reset-demo': resetDemo(); break;
    case 'task-cancel': closeForm(); break;
    default: break;
  }
});

$('#storage-notice-close').addEventListener('click', () => { el.notice.hidden = true; });

el.form.addEventListener('submit', (ev) => { ev.preventDefault(); submitForm(); });
el.description.addEventListener('input', updateCounter);

el.search.addEventListener('input', () => { ui.search = el.search.value; renderControls(); renderView(); });
el.filter.addEventListener('change', () => { ui.filter = el.filter.value; renderControls(); renderView(); });

el.team.addEventListener('change', (ev) => { if (ev.target.matches('input[data-employee]')) commitCapacity(ev.target); });
el.team.addEventListener('focusout', (ev) => { if (ev.target.matches('input[data-employee]')) commitCapacity(ev.target); });
el.team.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.matches('input[data-employee]')) { ev.preventDefault(); commitCapacity(ev.target); } });

document.addEventListener('keydown', (ev) => {
  if (!isFormOpen()) return;
  if (ev.key === 'Escape') { ev.preventDefault(); closeForm(); return; }
  if (ev.key === 'Tab') {
    const items = [...el.modal.querySelectorAll('input, select, textarea, button')].filter((n) => !n.disabled && n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    else if (!el.modal.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
  }
});

/* Drag-and-drop (HTML5) */
let dragId = null;
el.board.addEventListener('dragstart', (ev) => {
  const card = ev.target instanceof Element ? ev.target.closest('[data-task-id].potok-task') : null;
  if (!card) return;
  dragId = card.dataset.taskId;
  ev.dataTransfer.effectAllowed = 'move';
  ev.dataTransfer.setData('text/plain', dragId);
  card.classList.add('dragging');
});
el.board.addEventListener('dragend', () => {
  dragId = null;
  for (const n of el.board.querySelectorAll('.dragging, .drag-over')) n.classList.remove('dragging', 'drag-over');
});
el.board.addEventListener('dragover', (ev) => {
  const col = ev.target instanceof Element ? ev.target.closest('[data-status]') : null;
  if (!col || !dragId) return;
  ev.preventDefault();
  ev.dataTransfer.dropEffect = 'move';
  col.classList.add('drag-over');
});
el.board.addEventListener('dragleave', (ev) => {
  const col = ev.target instanceof Element ? ev.target.closest('[data-status]') : null;
  if (col && !col.contains(ev.relatedTarget)) col.classList.remove('drag-over');
});
el.board.addEventListener('drop', (ev) => {
  const col = ev.target instanceof Element ? ev.target.closest('[data-status]') : null;
  if (!col) return;
  ev.preventDefault();
  const id = dragId || ev.dataTransfer.getData('text/plain');
  dragId = null;
  moveTask(id, col.dataset.status);
});

/* ---------- Старт ---------- */

state = loadState();
buildTeam();
renderFilterOptions();
renderAll(true);
if (storageProblem) {
  el.notice.hidden = false;
  toast('Данные повреждены — загружен пример');
}
el.root.setAttribute('data-testid', 'app');
el.root.setAttribute('aria-busy', 'false');
