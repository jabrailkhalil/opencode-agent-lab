// «Поток»: контроллер UI (data-testid по docs/INTERFACES.md). Логика — domain.js.
import { DEMO_WEEK, STATUSES, STATUS_LABELS, addDays, applyPlan, isValidState, loadFor, proposePlan, seedState, validateTask } from './domain.js';

const KEY = 'potok-v1-state';
const $ = (s) => document.querySelector(s);
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let state = loadState();
let week = DEMO_WEEK;
let view = 'board';
let query = '';
let filter = '';
let editing = null;
let plan = null;
let confirmCb = null;

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); // п.9: повреждённые данные не роняют приложение
    if (raw && isValidState(raw)) return raw;
  } catch (e) { /* невалидный JSON — стартовые данные */ }
  return seedState();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* приватный режим */ } }

const weekTasks = () => state.tasks.filter((t) => t.week === week);
const visible = (list) => list.filter((t) =>
  (!query || `${t.title} ${t.description}`.toLowerCase().includes(query)) &&
  (!filter || (filter === 'none' ? t.assignee === null : t.assignee === filter)));
const sumHours = (list) => list.reduce((s, t) => s + t.hours, 0);
function weekLabel(w) {
  const [y1, m1, d1] = w.split('-').map(Number);
  const [y2, m2, d2] = addDays(w, 6).split('-').map(Number);
  return `${d1} ${MONTHS[m1 - 1]} — ${d2} ${MONTHS[m2 - 1]} ${y2}`;
}

function renderMetrics() {
  const all = weekTasks();
  const act = all.filter((t) => t.status !== 'done');
  const cells = [['Всего задач', all.length], ['Активных задач', act.length],
    ['Активные часы', `${sumHours(act)} ч`], ['Выполнено часов', `${sumHours(all.filter((t) => t.status === 'done'))} ч`]];
  $('#metrics').innerHTML = cells.map(([k, v]) =>
    `<div class="stat"><div class="stat-value">${esc(v)}</div><div class="stat-label">${k}</div></div>`).join('');
}

function cardHtml(t) {
  const e = state.employees.find((x) => x.id === t.assignee);
  return `<article class="task-card" data-testid="task-${t.id}" data-id="${t.id}" draggable="true" tabindex="0" aria-label="${esc(t.title)}">
    <div class="tc-top"><span>${t.id}</span><span>${t.hours} ч</span></div>
    <h3 class="tc-title">${esc(t.title)}</h3><p class="tc-desc">${esc(t.description)}</p>
    <div class="tc-bottom"><span class="tc-assignee" style="--c:${e ? e.color : '#9aa5b1'}">${e ? esc(e.name) : 'Без ответственного'}</span>
      <span class="btn-list">
        <button class="btn btn-sm btn-outline-secondary" type="button" data-act="edit" data-testid="edit-${t.id}">Изменить</button>
        <button class="btn btn-sm btn-outline-danger" type="button" data-act="del" data-testid="delete-${t.id}">Удалить</button>
      </span></div></article>`;
}

function renderBoard() {
  const cols = STATUSES.map((st) => [st, visible(weekTasks().filter((t) => t.status === st))]);
  if (query || filter) {
    const hit = cols.reduce((n, [, list]) => n + list.length, 0);
    if (!hit) { $('#board').innerHTML = `<div class="alert alert-info alert-empty">Ничего не найдено
      <button class="btn btn-sm btn-outline-secondary" type="button" data-act="reset-filters">Сбросить поиск и фильтр</button></div>`; return; }
  }
  $('#board').innerHTML = cols.map(([st, list]) =>
    `<section class="column" data-testid="column-${st}" data-status="${st}" aria-label="${STATUS_LABELS[st]}">
      <div class="col-head"><span>${STATUS_LABELS[st]}</span><span class="badge">${list.length}</span></div>
      ${list.map(cardHtml).join('') || '<p class="empty">Нет задач — перетащите карточку сюда</p>'}</section>`).join('');
}

function renderEmployees() {
  $('#employees-view').innerHTML = state.employees.map((e) => {
    const l = loadFor(state, e.id, week);
    const pct = l.percent === null ? '— · нет доступности' : `${l.percent}%`;
    const fill = l.capacity ? Math.min(100, (l.hours / l.capacity) * 100) : 0;
    const tasks = visible(weekTasks().filter((t) => t.assignee === e.id));
    return `<div class="emp" data-testid="employee-${e.id}">
      <div class="emp-head"><span class="avatar" style="--c:${e.color}">${esc(e.initials)}</span>
        <div><strong>${esc(e.name)}</strong><div class="muted">${esc(e.role)}</div></div></div>
      <div class="emp-metrics">
        <div class="metric"><span class="metric-label">Загрузка (незавершённые часы к доступности)</span>
          <span class="metric-value" data-testid="load-${e.id}">${l.hours} ч из ${l.capacity} ч · ${pct}</span>
          <div class="bar"><i class="fill" style="width:${fill}%"></i></div>
          ${l.overload > 0 ? `<span class="overload">Перегрузка +${l.overload} ч</span>` : ''}
          <label class="cap">Доступность на неделю, ч (0–168)
            <input class="form-control" type="number" min="0" max="168" step="1" value="${l.capacity}"
              data-testid="capacity-${e.id}" data-emp="${e.id}" aria-label="Доступность ${esc(e.name)}"></label></div>
        <div class="metric"><span class="metric-label">Прогресс (выполненные часы)</span>
          <span class="metric-value" data-testid="progress-${e.id}">${l.doneHours} ч из ${l.totalHours} ч · ${l.progress}%${l.totalHours === 0 ? ' · нет назначенных часов' : ''}</span>
          <div class="bar"><i class="prog" style="width:${Math.min(100, l.progress)}%"></i></div></div>
      </div>
      <div class="emp-tasks">${tasks.map((t) => `<span class="chip ${t.status}">${t.id} · ${esc(t.title)} · ${t.hours} ч</span>`).join('') || '<span class="muted">Задач нет</span>'}</div>
    </div>`;
  }).join('');
}

function render() {
  $('#current-week').textContent = weekLabel(week);
  $('#filter-assignee').innerHTML = '<option value="">Ответственный: все</option><option value="none">Без ответственного</option>'
    + state.employees.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  $('#filter-assignee').value = filter;
  $('#board').hidden = view !== 'board';
  $('#employees-view').hidden = view !== 'employees';
  $('#view-board').className = view === 'board' ? 'btn btn-primary' : 'btn btn-outline-secondary';
  $('#view-employees').className = view === 'employees' ? 'btn btn-primary' : 'btn btn-outline-secondary';
  renderMetrics(); // метрики недели — от полных данных, поиск/фильтр их не меняют (п.4)
  renderBoard();
  renderEmployees();
}

const show = (s) => { $(s).hidden = false; };
const hide = (s) => { $(s).hidden = true; };

const FIELD = { title: '#task-title', description: '#task-description', hours: '#task-hours', assignee: '#task-assignee', status: '#task-status', week: '#task-week' };
function showError(errors) {
  document.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
  const box = $('#task-error');
  if (!errors) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = `<ul>${Object.values(errors).map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`;
  let first = null;
  for (const k of Object.keys(errors)) {
    const el = $(FIELD[k]);
    if (el) { el.classList.add('is-invalid'); el.setAttribute('aria-describedby', 'task-error'); if (!first) first = el; }
  }
  if (first) first.focus(); // п.10: ошибка видна в открытой форме, значения не сбрасываются
}

function openTask(task) {
  editing = task ? task.id : null;
  $('#task-modal-title').textContent = task ? `Задача ${task.id}` : 'Новая задача';
  $('#task-title').value = task ? task.title : '';
  $('#task-description').value = task ? task.description : '';
  $('#task-hours').value = task ? task.hours : '';
  $('#task-assignee').innerHTML = '<option value="">Без ответственного</option>'
    + state.employees.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('');
  $('#task-assignee').value = task && task.assignee ? task.assignee : '';
  $('#task-status').value = task ? task.status : 'todo';
  $('#task-week').value = task ? task.week : week;
  showError(null);
  show('#task-modal');
  $('#task-title').focus();
}

function submitTask() {
  const candidate = {
    title: $('#task-title').value,
    description: $('#task-description').value,
    hours: $('#task-hours').value === '' ? NaN : Number($('#task-hours').value),
    assignee: $('#task-assignee').value || null,
    status: $('#task-status').value,
    week: $('#task-week').value,
  };
  const current = editing ? state.tasks.find((t) => t.id === editing) : null;
  let clean;
  try {
    clean = validateTask({ ...(current || {}), ...candidate }, state.employees);
  } catch (err) {
    showError(err.fieldErrors || { title: err.message });
    return;
  }
  if (current) Object.assign(current, clean);
  else state.tasks.push({ ...clean, id: `TASK-${state.nextId}` }), (state.nextId += 1);
  save();
  hide('#task-modal');
  week = mondaySafe(clean.week);
  render();
}
const mondaySafe = (w) => (/^\d{4}-\d{2}-\d{2}$/.test(w) ? w : week);

function openPlan() {
  plan = proposePlan(state, week);
  const byId = new Map(state.tasks.map((t) => [t.id, t]));
  const changed = plan.assignments.filter((a) => (byId.get(a.taskId).assignee ?? null) !== a.assignee);
  $('#plan-summary').textContent = plan.assignments.length
    ? (changed.length ? `Перераспределено ${changed.length} · Не разместилось ${plan.unassignedHours} ч` : 'Изменений нет')
    : 'На этой неделе нет активных задач';
  $('#plan-list').innerHTML = plan.assignments.map((a) => {
    const t = byId.get(a.taskId);
    const e = state.employees.find((x) => x.id === a.assignee);
    return a.assignee
      ? `<div class="plan-row">${t.id} · ${t.hours} ч → ${esc(e.name)}</div>`
      : `<div class="plan-row unplaced">${t.id} · ${t.hours} ч — не помещается, останется без ответственного</div>`;
  }).join('');
  $('#plan-apply').disabled = changed.length === 0;
  show('#plan-modal');
}

function applyCurrentPlan() { // явное применение человеком (п.8)
  if (!plan) return;
  state = applyPlan(state, plan);
  plan = null;
  save();
  hide('#plan-modal');
  render();
}

function askConfirm(text, cb) {
  $('#confirm-text').textContent = text;
  confirmCb = cb;
  show('#confirm-modal');
  $('#confirm-ok').focus();
}

function saveCapacity(ev) {
  const inp = ev.target.closest('input[data-emp]');
  if (!inp) return;
  const emp = state.employees.find((x) => x.id === inp.dataset.emp);
  if (!emp) return;
  let v = Math.round(Number(inp.value));
  if (!Number.isFinite(v)) v = 0;
  v = Math.min(168, Math.max(0, v)); // п.6: доступность 0–168 ч на неделю
  emp.capacities = emp.capacities || {};
  emp.capacities[week] = v;
  save();
  render();
}

function onCardClick(ev) {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'reset-filters') {
    query = ''; filter = ''; $('#search').value = ''; render(); return;
  }
  const id = btn.closest('[data-id]')?.dataset.id;
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  if (btn.dataset.act === 'edit') openTask(task);
  if (btn.dataset.act === 'del') {
    askConfirm(`Удалить задачу «${task.title}»?`, () => {
      state.tasks = state.tasks.filter((t) => t.id !== id);
      save();
      render();
    });
  }
}

function bindDnd() { // п.2: drag-and-drop статусов, модель равна select task-status
  const board = $('#board');
  board.addEventListener('dragstart', (ev) => {
    const card = ev.target.closest('.task-card');
    if (card) { ev.dataTransfer.setData('text/plain', card.dataset.id); card.classList.add('dragging'); }
  });
  board.addEventListener('dragend', () => document.querySelectorAll('.task-card.dragging').forEach((c) => c.classList.remove('dragging')));
  board.addEventListener('dragover', (ev) => {
    const col = ev.target.closest('.column');
    if (col) { ev.preventDefault(); col.classList.add('drop'); }
  });
  board.addEventListener('dragleave', (ev) => ev.target.closest('.column')?.classList.remove('drop'));
  board.addEventListener('drop', (ev) => {
    const col = ev.target.closest('.column');
    if (!col) return;
    ev.preventDefault();
    col.classList.remove('drop');
    const task = state.tasks.find((t) => t.id === ev.dataTransfer.getData('text/plain'));
    if (task && task.status !== col.dataset.status) { task.status = col.dataset.status; save(); render(); }
  });
}

function bind() {
  $('#new-task').onclick = () => openTask(null);
  $('#task-cancel').onclick = () => hide('#task-modal');
  $('#task-save').onclick = submitTask;
  $('#prev-week').onclick = () => { week = addDays(week, -7); render(); }; // п.5: независимые недели
  $('#next-week').onclick = () => { week = addDays(week, 7); render(); };
  $('#search').oninput = (ev) => { query = ev.target.value.trim().toLowerCase(); render(); };
  $('#filter-assignee').onchange = (ev) => { filter = ev.target.value; render(); };
  $('#view-board').onclick = () => { view = 'board'; render(); }; // п.3: переключение представлений
  $('#view-employees').onclick = () => { view = 'employees'; render(); };
  $('#propose-plan').onclick = openPlan;
  $('#plan-cancel').onclick = () => { plan = null; hide('#plan-modal'); };
  $('#plan-apply').onclick = applyCurrentPlan;
  $('#reset-demo').onclick = () => askConfirm('Восстановить учебные данные? Текущие изменения будут потеряны.', () => {
    state = seedState();
    save();
    render();
  });
  $('#confirm-cancel').onclick = () => { confirmCb = null; hide('#confirm-modal'); };
  $('#confirm-ok').onclick = () => { const cb = confirmCb; confirmCb = null; hide('#confirm-modal'); if (cb) cb(); };
  $('#app').addEventListener('click', onCardClick);
  $('#employees-view').addEventListener('change', saveCapacity);
  $('#employees-view').addEventListener('blur', saveCapacity, true); // сохранение на change/blur
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') ['#task-modal', '#plan-modal', '#confirm-modal'].forEach(hide);
  });
  bindDnd();
}

bind();
render();

