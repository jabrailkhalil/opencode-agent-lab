// app.js — UI «Потока»: доска, сотрудники, форма, план, localStorage.
import { DEMO_WEEK, seedState, monday, loadFor, validateTask, proposePlan, applyPlan, isValidState } from './domain.js';

const STORE_KEY = 'potok.state.v1';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => String(Math.round(n * 100) / 100).replace('.', ',');
const shiftWeek = (week, days) => {
  const [y, m, d] = week.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
function weekRange(week) {
  const [y, m, d] = week.split('-').map(Number);
  const end = new Date(Date.UTC(y, m - 1, d + 6));
  return `${d} ${MONTHS[m - 1]} — ${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

let state = null;
let lastPlan = null;
const ui = { view: 'board', week: DEMO_WEEK, search: '', filter: '', editingId: null };

function notice(text) {
  const el = $('#notice');
  el.textContent = text;
  el.classList.remove('d-none');
}
function loadFromStorage() {
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch { /* приватный режим */ }
  if (!raw) return seedState();
  try {
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) { notice('Сохранённые данные повреждены — загружен учебный пример.'); return seedState(); }
    if (parsed.ui && typeof parsed.ui.week === 'string') {
      ui.view = parsed.ui.view === 'employees' ? 'employees' : 'board';
      ui.week = monday(parsed.ui.week);
    }
    return parsed;
  } catch {
    notice('Сохранённые данные повреждены — загружен учебный пример.');
    return seedState();
  }
}
function save() {
  state.ui = { view: ui.view, week: ui.week };
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* хранилище недоступно */ }
}

const employeeById = id => state.employees.find(e => e.id === id) || null;
const weekTasks = () => state.tasks.filter(t => t.week === ui.week);
function matches(t) {
  const q = ui.search.trim().toLowerCase();
  const textOk = !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  const whoOk = !ui.filter || t.assignee === ui.filter;
  return textOk && whoOk;
}
const filteredTasks = () => weekTasks().filter(matches);
const hasFilter = () => Boolean(ui.search.trim() || ui.filter);

function renderHeader() {
  $('[data-testid="current-week"]').textContent = ui.week;
  $('#week-range').textContent = weekRange(ui.week);
  for (const v of ['board', 'employees']) {
    const btn = $(`[data-testid="view-${v}"]`);
    btn.setAttribute('aria-pressed', String(ui.view === v));
    btn.classList.toggle('btn-primary', ui.view === v);
  }
  $('#board').classList.toggle('d-none', ui.view !== 'board');
  $('#employees-view').classList.toggle('d-none', ui.view !== 'employees');
}

function renderMetrics() {
  const tasks = weekTasks();
  const activeHours = tasks.reduce((s, t) => s + (t.status !== 'done' ? Number(t.hours) : 0), 0);
  let capacity = 0, overload = 0;
  for (const e of state.employees) {
    const l = loadFor(state, e.id, ui.week);
    capacity += l.capacity;
    overload += l.overload;
  }
  $('#metric-tasks').textContent = String(tasks.length);
  $('#metric-active').textContent = fmt(activeHours);
  $('#metric-capacity').textContent = fmt(capacity);
  $('#metric-overload').textContent = fmt(overload);
  $('#metric-overload').classList.toggle('text-danger', overload > 0);
}
const STATUS_LABELS = { todo: 'Новая', doing: 'В работе', done: 'Готово' };

function taskCardHtml(t) {
  const e = employeeById(t.assignee);
  return `<article class="task-card" draggable="true" data-id="${esc(t.id)}" data-testid="task-${esc(t.id)}">
    <h3>${esc(t.title)}</h3>
    ${t.description ? `<p>${esc(t.description)}</p>` : ''}
    <div class="task-meta">
      <span class="badge hours-chip">${fmt(t.hours)} ч</span>
      <span class="badge">${e ? esc(e.name) : 'Без ответственного'}</span>
      <span class="badge">${STATUS_LABELS[t.status] || esc(t.status)}</span>
    </div>
    <div class="task-actions">
      <button type="button" class="btn btn-sm" data-action="edit-task" data-id="${esc(t.id)}" data-testid="edit-${esc(t.id)}">Изменить</button>
      <button type="button" class="btn btn-sm text-danger" data-action="delete-task" data-id="${esc(t.id)}" data-testid="delete-${esc(t.id)}">Удалить</button>
    </div>
  </article>`;
}

function emptyColumnHtml() {
  return hasFilter()
    ? '<div class="board-empty">Ничего не найдено — сбросьте поиск и фильтр. Метрики показаны по всем задачам недели.</div>'
    : '<div class="board-empty">Нет задач</div>';
}

function renderBoard() {
  const shown = filteredTasks();
  for (const status of ['todo', 'doing', 'done']) {
    const list = shown.filter(t => t.status === status);
    $(`[data-testid="column-${status}"] .board-list`).innerHTML = list.map(taskCardHtml).join('') || emptyColumnHtml();
  }
}

function employeeHtml(e) {
  const l = loadFor(state, e.id, ui.week);
  const loadValue = `${fmt(l.hours)}/${fmt(l.capacity)} ч · ${l.percent === null ? '—' : l.percent + '%'}`;
  const loadNote = l.percent === null ? 'нет доступных часов'
    : l.overload > 0 ? `перегрузка +${fmt(l.overload)} ч` : 'в пределах доступности';
  const shownTasks = l.tasks.filter(matches);
  const chips = shownTasks.map(t =>
    `<span>${esc(t.id)} · ${esc(t.title)} · ${fmt(t.hours)} ч${t.status === 'done' ? ' ✓' : ''}</span>`).join('')
    || '<span class="text-muted">На этой неделе задач нет</span>';
  return `<div class="col-12 col-lg-6"><div class="card employee-card" data-testid="employee-${esc(e.id)}">
    <div class="card-body">
      <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between">
        <div><strong>${esc(e.name)}</strong><div class="text-muted small">${esc(e.role)}</div></div>
        <div class="capacity-field">
          <label for="capacity-${esc(e.id)}">Доступно, ч</label>
          <input id="capacity-${esc(e.id)}" data-testid="capacity-${esc(e.id)}" data-capacity="${esc(e.id)}"
                 class="form-control" type="number" min="0" max="168" step="0.5" value="${l.capacity}">
          <div class="capacity-error text-danger small d-none" role="alert" aria-live="polite"></div>
        </div>
      </div>
      <div class="blocks mt-3">
        <div class="employee-block">
          <div class="label">Загрузка (активные / доступные)</div>
          <div class="value" data-testid="load-${esc(e.id)}">${loadValue}</div>
          <div class="small ${l.overload > 0 ? 'text-danger' : 'text-muted'}">${loadNote}</div>
        </div>
        <div class="employee-block">
          <div class="label">Прогресс (выполненные / все назначенные)</div>
          <div class="value" data-testid="progress-${esc(e.id)}">${l.progress}%</div>
          <div class="small text-muted">выполнено ${fmt(l.doneHours)} из ${fmt(l.totalHours)} ч</div>
        </div>
      </div>
      <div class="employee-tasks">${chips}</div>
    </div>
  </div></div>`;
}

function renderEmployees() {
  $('#employees-view').innerHTML = state.employees.map(employeeHtml).join('');
}

function buildSelects() {
  const opts = state.employees.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
  const filter = $('#filter-assignee');
  filter.innerHTML = '<option value="">Все сотрудники</option>' + opts;
  filter.value = ui.filter;
  const assignee = $('#task-assignee');
  assignee.innerHTML = '<option value="">Без ответственного</option>' + opts;
}

function render() {
  renderHeader();
  renderMetrics();
  renderBoard();
  renderEmployees();
}

// ===== Форма задачи =====
const ERROR_FIELDS = [['Название', 'task-title'], ['Описание', 'task-description'],
  ['Оценка', 'task-hours'], ['Ответственный', 'task-assignee'], ['Статус', 'task-status'], ['Неделя', 'task-week']];

function showFormError(message) {
  const err = $('#task-error');
  err.textContent = message;
  err.classList.remove('d-none');
  document.querySelectorAll('.field-invalid').forEach(el => el.classList.remove('field-invalid'));
  for (const [key, id] of ERROR_FIELDS) if (message.startsWith(key)) $('#' + id).classList.add('field-invalid');
}
function clearFormError() {
  $('#task-error').classList.add('d-none');
  $('#task-error').textContent = '';
  document.querySelectorAll('.field-invalid').forEach(el => el.classList.remove('field-invalid'));
}
function openForm(task) {
  ui.editingId = task ? task.id : null;
  $('#form-heading').textContent = task ? `Редактирование ${task.id}` : 'Новая задача';
  $('#task-title').value = task ? task.title : '';
  $('#task-description').value = task ? task.description : '';
  $('#task-hours').value = task ? String(task.hours) : '8';
  $('#task-assignee').value = task && task.assignee ? task.assignee : '';
  $('#task-status').value = task ? task.status : 'todo';
  $('#task-week').value = task ? task.week : ui.week;
  clearFormError();
  $('#task-form').classList.remove('d-none');
  $('#task-title').focus();
}
function closeForm() { $('#task-form').classList.add('d-none'); ui.editingId = null; }
function submitForm() {
  const draft = {
    id: ui.editingId || undefined,
    title: $('#task-title').value,
    description: $('#task-description').value,
    hours: $('#task-hours').value,
    assignee: $('#task-assignee').value || null,
    status: $('#task-status').value,
    week: $('#task-week').value,
  };
  let clean;
  try { clean = validateTask(draft, state.employees); }
  catch (err) { showFormError(err.message); return; }
  if (ui.editingId) state.tasks = state.tasks.map(t => (t.id === ui.editingId ? { ...t, ...clean } : t));
  else { clean.id = `TASK-${state.nextId}`; state.nextId += 1; state.tasks = [...state.tasks, clean]; }
  save(); closeForm(); render();
}
function deleteTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || !window.confirm(`Удалить задачу «${task.title}» (${task.id})?`)) return;
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (ui.editingId === id) closeForm();
  save(); render();
}

// ===== Предпросмотр плана =====
function openPlan() {
  lastPlan = proposePlan(state, ui.week);
  const next = applyPlan(state, lastPlan);
  const unassigned = lastPlan.assignments.filter(a => a.assignee === null)
    .map(a => state.tasks.find(t => t.id === a.taskId)).filter(Boolean);
  const rows = state.employees.map(e => {
    const before = loadFor(state, e.id, ui.week);
    const after = loadFor(next, e.id, ui.week);
    return `<div class="plan-row"><span><strong>${esc(e.name)}</strong> · доступно ${fmt(before.capacity)} ч</span>`
      + `<span>было ${fmt(before.hours)} ч → станет ${fmt(after.hours)} ч${after.percent === null ? '' : ' · ' + after.percent + '%'}</span></div>`;
  }).join('');
  const tail = unassigned.length
    ? `<p class="mt-3 mb-1">Без ответственного останутся (${fmt(lastPlan.unassignedHours)} ч):</p>`
      + `<ul class="plan-list">${unassigned.map(t => `<li>${esc(t.id)} · ${esc(t.title)} · ${fmt(t.hours)} ч</li>`).join('')}</ul>`
    : '<p class="mt-3 mb-0">Все активные задачи недели помещаются в доступность.</p>';
  $('#plan-preview-body').innerHTML =
    `<p class="plan-note">Это предпросмотр, исходный план не изменён. Неделя ${esc(ui.week)}.</p>${rows}${tail}`;
  $('#plan-modal').classList.remove('d-none');
  $('[data-testid="plan-apply"]').focus();
}
function closePlan() { $('#plan-modal').classList.add('d-none'); lastPlan = null; }
function applyPlanNow() {
  if (!lastPlan) return;
  state = applyPlan(state, lastPlan);
  save(); closePlan(); render();
}

// ===== События =====
function onAction(name, el) {
  const id = el.dataset.id;
  if (name === 'prev-week') { ui.week = shiftWeek(ui.week, -7); save(); render(); }
  else if (name === 'next-week') { ui.week = shiftWeek(ui.week, 7); save(); render(); }
  else if (name === 'view-board') { ui.view = 'board'; save(); render(); }
  else if (name === 'view-employees') { ui.view = 'employees'; save(); render(); }
  else if (name === 'new-task') openForm(null);
  else if (name === 'edit-task') openForm(state.tasks.find(t => t.id === id));
  else if (name === 'delete-task') deleteTask(id);
  else if (name === 'form-cancel') closeForm();
  else if (name === 'propose-plan') openPlan();
  else if (name === 'plan-cancel') closePlan();
  else if (name === 'plan-apply') applyPlanNow();
  else if (name === 'reset-demo') resetDemo();
}
function resetDemo() {
  if (!window.confirm('Восстановить учебный пример? Текущие изменения будут заменены.')) return;
  state = seedState();
  ui.week = DEMO_WEEK; ui.search = ''; ui.filter = '';
  $('#search').value = '';
  buildSelects(); closeForm(); closePlan();
  notice('Учебный пример восстановлен.');
  save(); render();
}
function setCapacityError(el, message) {
  const field = el.closest('.capacity-field');
  const err = field && field.querySelector('.capacity-error');
  if (message) {
    el.classList.add('field-invalid');
    if (err) { err.textContent = message; err.classList.remove('d-none'); }
  } else {
    el.classList.remove('field-invalid');
    if (err) { err.textContent = ''; err.classList.add('d-none'); }
  }
}
// Пользователь снова набирает текст — снимаем прежнее сообщение об ошибке.
function onCapacityInput(e) {
  const el = e.target.closest('[data-capacity]');
  if (!el) return;
  if (el.dataset.ptRestored !== undefined) delete el.dataset.ptRestored;
  setCapacityError(el, '');
}
function onCapacity(e) {
  const el = e.target.closest('[data-capacity]');
  if (!el) return;
  const emp = employeeById(el.dataset.capacity);
  if (!emp) return;
  const current = loadFor(state, emp.id, ui.week).capacity;
  const raw = String(el.value).trim();
  // change и blur срабатывают подряд: если уже откатили к прежнему значению — не трогаем подсказку.
  if (el.dataset.ptRestored === raw) return;
  if (raw === '' || !Number.isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > 168 || !Number.isInteger(Number(raw) * 2)) {
    el.value = String(current);
    el.dataset.ptRestored = String(current);
    setCapacityError(el, 'Нужно число 0–168 с шагом 0,5. Прежнее значение сохранено.');
    return;
  }
  const v = Math.round(Number(raw) * 2) / 2;
  delete el.dataset.ptRestored;
  setCapacityError(el, '');
  el.value = String(v);
  emp.capacities = { ...(emp.capacities || {}), [ui.week]: v };
  save(); render();
}
function wire() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (el) onAction(el.dataset.action, el);
  });
  $('#task-form').addEventListener('submit', e => { e.preventDefault(); submitForm(); });
  $('#search').addEventListener('input', e => { ui.search = e.target.value; renderBoard(); renderEmployees(); });
  $('#filter-assignee').addEventListener('change', e => { ui.filter = e.target.value; renderBoard(); renderEmployees(); });
  const view = $('#employees-view');
  view.addEventListener('input', onCapacityInput);
  view.addEventListener('change', onCapacity);
  view.addEventListener('blur', onCapacity, true);
  document.addEventListener('dragstart', e => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  document.addEventListener('dragend', e => {
    const card = e.target.closest('.task-card');
    if (card) card.classList.remove('dragging');
  });
  document.querySelectorAll('.board-col').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const task = state.tasks.find(t => t.id === e.dataTransfer.getData('text/plain'));
      if (task && task.status !== col.dataset.status) { task.status = col.dataset.status; save(); render(); }
    });
  });
}

state = loadFromStorage();
buildSelects();
wire();
render();
