import { DEMO_WEEK, STATUSES, seedState, addDays, loadFor, validateTask, proposePlan, applyPlan, isValidState } from './domain.js';

const KEY = 'potok-state-v1';
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const num = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

const ui = { week: DEMO_WEEK, view: 'board', q: '', who: '', plan: null, alerts: [], capErr: {}, opener: null };
let state;

function weekLabel(w) {
  const [y, m, d] = w.split('-').map(Number), e = addDays(w, 6).split('-').map(Number);
  return `${d} ${MON[m - 1]} – ${e[2]} ${MON[e[1] - 1]} ${e[0]}`;
}

// ---- Хранилище ----
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { notify('warning', 'Не удалось сохранить данные в браузере: изменения пропадут после перезагрузки.'); }
}
function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { /* хранилище недоступно */ }
  if (raw == null) return seedState();
  try {
    const s = JSON.parse(raw);
    if (isValidState(s)) return s;
  } catch { /* повреждённый JSON */ }
  notify('warning', 'Данные повреждены, загружен учебный пример.');
  const s = seedState();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  return s;
}

function notify(kind, text) {
  ui.alerts.push({ kind, text, id: Math.random() });
  if (ui.alerts.length > 3) ui.alerts.shift();
  if (state) renderAlerts();
}

// Единая точка изменения данных: отмена предпросмотра, сохранение, перерисовка.
function commit(next, msg) {
  state = next;
  if (ui.plan) { ui.plan = null; notify('info', 'Предпросмотр распределения отменён: данные изменились.'); }
  save();
  if (msg) notify('success', msg);
  render();
}

// ---- Выборки ----
const weekTasks = () => state.tasks.filter((t) => t.week === ui.week);
const empById = (id) => state.employees.find((e) => e.id === id);
function visibleTasks() {
  const q = ui.q.trim().toLowerCase();
  return weekTasks().filter((t) => {
    if (ui.who === 'none' ? t.assignee : ui.who && t.assignee !== ui.who) return false;
    return !q || t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
  });
}
const statusBadge = (s) => `<span class="badge ${{ todo: 'bg-secondary-lt', doing: 'bg-blue-lt', done: 'bg-green-lt' }[s]}">${STATUSES[s]}</span>`;

// ---- Отрисовка: сводка, команда ----
function renderAlerts() {
  $('#alerts').innerHTML = ui.alerts.map((a) => `<div class="alert alert-${a.kind} ${a.kind === 'success' ? 'toast-ok' : ''} alert-dismissible" role="alert">
    ${esc(a.text)}<button type="button" class="btn-close" data-action="close-alert" data-id="${a.id}" aria-label="Закрыть уведомление"></button></div>`).join('');
}

function renderSummary() {
  const all = weekTasks(), act = all.filter((t) => t.status !== 'done'), un = all.filter((t) => !t.assignee);
  const sum = (a) => a.reduce((s, t) => s + t.hours, 0);
  const m = (label, val, sub, id) => `<div class="metric" data-testid="${id}"><div class="metric-label">${label}</div><div class="metric-value">${val}</div><div class="metric-sub">${sub}</div></div>`;
  $('#summary').innerHTML =
    m('Задач всего', all.length, 'на выбранной неделе', 'sum-total') +
    m('Активных задач', act.length, `${num(sum(act))} ч в работе`, 'sum-active') +
    m('Всего часов', num(sum(all)), 'включая выполненные', 'sum-hours') +
    m('Без ответственного', un.length, `${num(sum(un))} ч`, 'sum-unassigned');
}

function meters(l) {
  const pct = l.percent;
  const loadText = pct === null ? 'нет доступности' : `${pct}%`;
  const width = pct === null ? (l.hours > 0 ? 100 : 0) : Math.min(pct, 100);
  const badge = l.overload > 0 ? `<span class="badge bg-red-lt over-text">Перегрузка +${num(l.overload)} ч</span>` : '<span class="ok-text">Без перегрузки</span>';
  const prog = l.totalHours > 0 ? `${num(l.doneHours)} / ${num(l.totalHours)} ч · ${l.progress}%` : '0% · нет назначенных часов';
  return { loadText, width, badge, prog };
}

function renderTeam() {
  $('#team').innerHTML = state.employees.map((e) => {
    const l = loadFor(state, e.id, ui.week), mt = meters(l), err = ui.capErr[e.id];
    return `<article class="emp" data-testid="employee-${e.id}">
      <div class="emp-head"><span class="avatar" style="background:${esc(e.color)}" aria-hidden="true">${esc(e.initials)}</span>
        <div><div class="emp-name">${esc(e.name)}</div><div class="emp-role">${esc(e.role)}</div></div></div>
      <div class="cap-field"><label class="form-label" for="cap-${e.id}">Доступно, ч на неделю</label>
        <input id="cap-${e.id}" type="number" min="0" max="168" step="0.5" class="form-control ${err ? 'is-invalid' : ''}" value="${l.capacity}"
          data-testid="capacity-${e.id}" data-cap="${e.id}" ${err ? `aria-invalid="true" aria-describedby="cap-err-${e.id}"` : ''}>
        ${err ? `<div class="field-error" id="cap-err-${e.id}" role="alert">${esc(err)}</div>` : ''}</div>
      <div class="meter" data-testid="load-${e.id}"><div class="meter-label"><span>Загрузка (активные часы)</span><span class="meter-value">${num(l.hours)} / ${num(l.capacity)} ч · ${mt.loadText}</span></div>
        <div class="progress"><div class="progress-bar ${l.overload > 0 ? 'bar-over' : 'bar-load'}" style="width:${mt.width}%"></div></div>
        <div class="meter-label"><span>без выполненных</span>${mt.badge}</div></div>
      <div class="meter" data-testid="progress-${e.id}"><div class="meter-label"><span>Прогресс (выполнено часов)</span><span class="meter-value">${mt.prog}</span></div>
        <div class="progress"><div class="progress-bar bar-done" style="width:${l.progress}%"></div></div></div>
    </article>`;
  }).join('');
  const un = weekTasks().filter((t) => !t.assignee);
  $('#unassigned-row').innerHTML = `<div class="unassigned-box"><strong>Без ответственного:</strong> ${un.length} задач, ${num(un.reduce((s, t) => s + t.hours, 0))} ч</div>`;
}

// ---- Отрисовка: задачи ----
function taskCard(t) {
  const e = empById(t.assignee);
  return `<article class="task" draggable="true" data-testid="task-${t.id}" data-task="${t.id}">
    <div class="task-top"><span>${t.id}</span>${statusBadge(t.status)}</div>
    <h3 class="task-title">${esc(t.title)}</h3>
    ${t.description ? `<p class="task-desc">${esc(t.description)}</p>` : ''}
    <div class="task-meta"><span class="badge bg-blue-lt">${num(t.hours)} ч</span><span>${e ? esc(e.name) : 'Без ответственного'}</span></div>
    <div class="task-actions">
      <button type="button" class="btn btn-sm" data-testid="edit-${t.id}" data-action="edit" data-id="${t.id}" aria-label="Изменить ${t.id}">Изменить</button>
      <button type="button" class="btn btn-sm btn-outline-danger" data-testid="delete-${t.id}" data-action="delete" data-id="${t.id}" aria-label="Удалить ${t.id}">Удалить</button>
    </div></article>`;
}

function searchNote(list) {
  const active = ui.q.trim() || ui.who;
  if (weekTasks().length === 0) return `<div class="card card-body empty-note">На этой неделе задач нет. <button type="button" class="btn btn-sm btn-primary ms-2" data-action="new-task">Создать задачу</button></div>`;
  if (active && list.length === 0)
    return `<div class="alert alert-secondary found-note" role="status">Ничего не найдено по запросу «${esc(ui.q.trim())}». <button type="button" class="btn btn-sm" data-action="clear-search">Сбросить поиск</button></div>`;
  return '';
}

function renderBoard(list) {
  return `<div class="board" data-testid="board">${Object.keys(STATUSES).map((s) => {
    const items = list.filter((t) => t.status === s);
    return `<section class="column" data-testid="column-${s}" data-status="${s}" aria-label="Колонка «${STATUSES[s]}»">
      <div class="col-head"><span>${STATUSES[s]}</span><span class="badge">${items.length}</span></div>
      ${items.length ? items.map(taskCard).join('') : '<div class="col-empty">Нет задач. Перетащите карточку сюда</div>'}</section>`;
  }).join('')}</div>`;
}

function renderEmployees(list) {
  const groups = state.employees.map((e) => ({ e, items: list.filter((t) => t.assignee === e.id) }));
  groups.push({ e: null, items: list.filter((t) => !t.assignee) });
  const shown = groups.filter((g) => !ui.who || (ui.who === 'none' ? !g.e : g.e && g.e.id === ui.who));
  return `<div class="employees-view" data-testid="employees-view">${shown.map(({ e, items }) => {
    let head = 'Без ответственного';
    if (e) {
      const l = loadFor(state, e.id, ui.week);
      head = `${esc(e.name)}</span><span class="${l.overload ? 'over-text' : 'text-secondary'}">${num(l.hours)} / ${num(l.capacity)} ч · ${l.overload ? '+' + num(l.overload) + ' ч' : 'без перегрузки'}`;
    }
    return `<section class="group"><div class="group-head"><span>${head}</span></div>
      ${items.length ? `<div class="group-list">${items.map(taskCard).join('')}</div>` : '<div class="empty-note">На этой неделе задач нет</div>'}</section>`;
  }).join('')}</div>`;
}

function renderMain() {
  const list = visibleTasks();
  $('#main').innerHTML = searchNote(list) + (ui.view === 'board' ? renderBoard(list) : renderEmployees(list));
}

function renderChrome() {
  $('[data-testid="current-week"]').innerHTML = `${weekLabel(ui.week)} <span class="text-secondary">${ui.week}</span>`;
  $('[data-testid="view-board"]').setAttribute('aria-pressed', ui.view === 'board');
  $('[data-testid="view-employees"]').setAttribute('aria-pressed', ui.view === 'employees');
  const sel = $('#filter-assignee');
  sel.innerHTML = '<option value="">Все</option>' + state.employees.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('') + '<option value="none">Без ответственного</option>';
  sel.value = ui.who;
}

function render() {
  const a = document.activeElement, tid = a && a.dataset ? a.dataset.testid : null;
  renderChrome(); renderAlerts(); renderSummary(); renderTeam(); renderPlan(); renderMain();
  $('#app').setAttribute('data-testid', 'app');
  if (tid && document.activeElement !== a && (!document.activeElement || document.activeElement === document.body)) {
    const n = document.querySelector(`[data-testid="${tid}"]`);
    if (n) n.focus();
  }
}

// ---- Предпросмотр распределения ----
function renderPlan() {
  const slot = $('#plan-slot');
  const p = ui.plan;
  if (!p) { slot.innerHTML = ''; return; }
  const was = new Map(state.tasks.map((t) => [t.id, t]));
  const name = (id) => (empById(id) ? empById(id).name : 'Без ответственного');
  const changed = p.assignments.filter((a) => was.get(a.taskId).assignee !== a.assignee);
  const same = p.assignments.length - changed.length;
  const after = applyPlan(state, p);
  const rows = changed.map((a) => { const t = was.get(a.taskId); return `<li class="plan-row"><span><strong>${t.id}</strong> ${esc(t.title)}</span>
    <span>${esc(name(t.assignee))} → <strong>${esc(name(a.assignee))}</strong></span><span>${num(t.hours)} ч</span></li>`; }).join('');
  const loads = state.employees.map((e) => {
    const b = loadFor(state, e.id, p.week), a = loadFor(after, e.id, p.week);
    const t = (l) => `${num(l.hours)} / ${num(l.capacity)} ч · ${l.overload ? 'перегрузка +' + num(l.overload) + ' ч' : 'без перегрузки'}`;
    return `<div><strong>${esc(e.name)}</strong><br>Сейчас: ${t(b)}<br>После: ${t(a)}</div>`;
  }).join('');
  slot.innerHTML = `<div class="preview" data-testid="plan-preview" role="region" aria-labelledby="plan-title">
    <h2 class="section-title" id="plan-title">Предпросмотр — изменения не применены</h2>
    ${changed.length ? `<ul class="list-unstyled m-0">${rows}</ul>` : '<div class="empty-note">План совпадает с текущим — менять нечего</div>'}
    ${same ? `<div class="text-secondary">ещё ${same} без изменений</div>` : ''}
    <div><strong>Не помещается: ${num(p.unassignedHours)} ч</strong> — остаются без ответственного</div>
    <div><div class="meter-label mb-1">Нагрузка после применения</div><div class="plan-after">${loads}</div></div>
    <div class="text-secondary">Выполненные и другие недели не затрагиваются.</div>
    <div class="plan-buttons"><button type="button" class="btn btn-primary" data-testid="plan-apply" data-action="plan-apply" ${changed.length ? '' : 'disabled'}>Применить</button>
    <button type="button" class="btn" data-testid="plan-cancel" data-action="plan-cancel">Отмена</button></div></div>`;
}

function propose() {
  ui.plan = { ...proposePlan(state, ui.week), week: ui.week };
  renderPlan();
  const b = $('[data-testid="plan-apply"]');
  const target = b && !b.disabled ? b : $('[data-testid="plan-cancel"]');
  if (target) { target.focus(); target.scrollIntoView({ block: 'nearest' }); }
}
function cancelPlan(silent) {
  if (!ui.plan) return;
  ui.plan = null; renderPlan();
  if (!silent) $('[data-testid="propose-plan"]').focus();
}
function applyCurrentPlan() {
  if (!ui.plan) return;
  const next = applyPlan(state, ui.plan);
  ui.plan = null;
  commit(next, 'Распределение применено.');
}

// ---- Диалоги ----
const FIELDS = ['title', 'description', 'assignee', 'hours', 'status', 'week'];
let editing = null, lastFocus = null;

function openForm(task) {
  editing = task ? task.id : null;
  lastFocus = document.activeElement;
  const t = task || { title: '', description: '', assignee: null, hours: 1, status: 'todo', week: ui.week };
  const opts = '<option value="">Без ответственного</option>' + state.employees.map((e) => `<option value="${e.id}" ${t.assignee === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
  const st = Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${v}</option>`).join('');
  $('#modal-root').innerHTML = `<div class="modal-backdrop-lite" data-backdrop="form"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="form-title">
    <form data-testid="task-form" id="task-form" novalidate class="d-flex flex-column" style="min-height:0">
      <div class="dialog-head"><h2 id="form-title">${task ? 'Правка ' + task.id : 'Новая задача'}</h2></div>
      <div class="dialog-body">
        <div><label class="form-label" for="f-title">Название</label><input id="f-title" class="form-control" data-testid="task-title" name="title" value="${esc(t.title)}" autocomplete="off">
          <div class="counter" id="c-title"></div></div>
        <div><label class="form-label" for="f-description">Описание</label><textarea id="f-description" class="form-control" rows="4" data-testid="task-description" name="description">${esc(t.description)}</textarea>
          <div class="counter" id="c-description"></div></div>
        <div class="form-pair">
          <div><label class="form-label" for="f-assignee">Ответственный</label><select id="f-assignee" class="form-select" data-testid="task-assignee" name="assignee">${opts}</select></div>
          <div><label class="form-label" for="f-status">Статус</label><select id="f-status" class="form-select" data-testid="task-status" name="status">${st}</select></div>
          <div><label class="form-label" for="f-hours">Оценка, ч</label><input id="f-hours" type="number" step="0.5" min="0.5" max="168" class="form-control" data-testid="task-hours" name="hours" value="${t.hours}"></div>
          <div><label class="form-label" for="f-week">Неделя (понедельник)</label><input id="f-week" type="date" class="form-control" data-testid="task-week" name="week" value="${esc(t.week)}"></div>
        </div>
        <div class="alert alert-danger mb-0" role="alert" data-testid="task-error" id="task-error" hidden></div>
      </div>
      <div class="dialog-foot">
        ${task ? '<button type="button" class="btn btn-outline-danger btn-del" data-action="form-delete">Удалить</button>' : ''}
        <button type="submit" class="btn btn-primary" data-testid="task-save">Сохранить</button>
        <button type="button" class="btn" data-testid="task-cancel" data-action="form-cancel">Отмена</button>
      </div></form></div></div>`;
  updateCounters();
  $('#f-title').focus();
}

function updateCounters() {
  const set = (id, max) => { const el = $('#f-' + id), c = $('#c-' + id); if (el && c) c.textContent = `${el.value.length} / ${max}`; };
  set('title', 140); set('description', 1000);
}

function closeForm() {
  $('#modal-root').innerHTML = '';
  editing = null;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

function showFormError(err) {
  const box = $('#task-error');
  box.textContent = err.message; box.hidden = false;
  FIELDS.forEach((f) => { const el = $('#f-' + f); el.classList.remove('is-invalid'); el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); });
  const el = $('#f-' + (err.field || 'title'));
  el.classList.add('is-invalid'); el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', 'task-error');
  el.focus();
}

function submitForm() {
  const v = (n) => $('#f-' + n).value;
  const hoursText = v('hours').trim().replace(',', '.');
  const draft = { title: v('title'), description: v('description'), assignee: v('assignee') || null,
    hours: hoursText === '' ? NaN : Number(hoursText), status: v('status'), week: v('week') };
  let task;
  try { task = validateTask({ ...draft, id: editing || `TASK-${state.nextId}` }, state.employees); }
  catch (err) { showFormError(err); return; }
  const next = structuredClone(state);
  if (editing) next.tasks[next.tasks.findIndex((x) => x.id === editing)] = task;
  else { next.tasks.push(task); next.nextId += 1; }
  const hidden = task.week !== ui.week;
  const wasEditing = editing;
  closeForm();
  commit(next, `${wasEditing ? 'Задача сохранена' : 'Задача создана'}: ${task.id}.`);
  if (hidden) notify('info', `${task.id} относится к неделе ${task.week}, на текущей неделе её не видно.`);
}

function confirmDialog(text, okLabel) {
  return new Promise((resolve) => {
    const prev = document.activeElement, root = $('#confirm-root');
    root.innerHTML = `<div class="modal-backdrop-lite" style="z-index:1060"><div class="dialog dialog-confirm" role="alertdialog" aria-modal="true" aria-labelledby="cf-text">
      <div class="dialog-body"><p id="cf-text" class="m-0">${esc(text)}</p></div>
      <div class="dialog-foot"><button type="button" class="btn btn-danger" data-testid="confirm-ok">${esc(okLabel)}</button>
      <button type="button" class="btn" data-testid="confirm-cancel">Отмена</button></div></div></div>`;
    const done = (r) => { root.innerHTML = ''; if (prev && document.contains(prev)) prev.focus(); resolve(r); };
    root.querySelector('[data-testid="confirm-ok"]').onclick = () => done(true);
    root.querySelector('[data-testid="confirm-cancel"]').onclick = () => done(false);
    root.firstElementChild.addEventListener('click', (e) => { if (e.target === e.currentTarget) done(false); });
    root._cancel = () => done(false);
    root.querySelector('[data-testid="confirm-cancel"]').focus();
  });
}

// ---- Действия ----
function setWeek(w) {
  if (ui.plan) { ui.plan = null; notify('info', 'Предпросмотр распределения отменён: неделя изменилась.'); }
  ui.week = w; ui.capErr = {};
  render();
}

async function deleteTask(id, fromForm) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  if (!(await confirmDialog(`Удалить задачу ${t.id} «${t.title}»? Это действие нельзя отменить.`, 'Удалить'))) return;
  if (fromForm) closeForm();
  const next = structuredClone(state);
  next.tasks = next.tasks.filter((x) => x.id !== id);
  commit(next, `Задача ${id} удалена.`);
}

async function resetDemo() {
  if (!(await confirmDialog('Заменить все данные учебным примером? Текущие задачи и доступность будут потеряны.', 'Восстановить'))) return;
  ui.week = DEMO_WEEK; ui.q = ''; ui.who = ''; ui.capErr = {};
  $('#search').value = '';
  commit(seedState(), 'Учебный пример восстановлен.');
}

function moveTask(id, status) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || t.status === status || !STATUSES[status]) return;
  const next = structuredClone(state);
  next.tasks[next.tasks.findIndex((x) => x.id === id)] = validateTask({ ...t, status }, state.employees);
  commit(next, `${id}: статус «${STATUSES[status]}».`);
}

function changeCapacity(id, raw) {
  const v = raw.trim() === '' ? NaN : Number(raw.replace(',', '.'));
  if (!Number.isFinite(v) || v < 0 || v > 168 || !Number.isInteger(v * 2)) {
    ui.capErr[id] = 'Доступность: от 0 до 168 часов с шагом 0,5';
    renderTeam();
    return;
  }
  delete ui.capErr[id];
  const next = structuredClone(state);
  next.employees.find((e) => e.id === id).capacities[ui.week] = v;
  commit(next);
}

const ACTIONS = {
  'new-task': () => openForm(null),
  edit: (el) => openForm(state.tasks.find((t) => t.id === el.dataset.id)),
  delete: (el) => deleteTask(el.dataset.id, false),
  'form-delete': () => deleteTask(editing, true),
  'form-cancel': closeForm,
  propose,
  'plan-apply': applyCurrentPlan,
  'plan-cancel': () => cancelPlan(false),
  reset: resetDemo,
  prev: () => setWeek(addDays(ui.week, -7)),
  next: () => setWeek(addDays(ui.week, 7)),
  today: () => setWeek(DEMO_WEEK),
  'view-board': () => { ui.view = 'board'; renderChrome(); renderMain(); },
  'view-employees': () => { ui.view = 'employees'; renderChrome(); renderMain(); },
  'clear-search': () => { ui.q = ''; ui.who = ''; $('#search').value = ''; renderChrome(); renderMain(); },
  'close-alert': (el) => { ui.alerts = ui.alerts.filter((a) => String(a.id) !== el.dataset.id); renderAlerts(); },
};

// ---- События ----
let dragId = null;
const dialogOf = () => $('#confirm-root').firstElementChild || $('#modal-root').firstElementChild;

document.addEventListener('click', (e) => {
  const form = $('#modal-root').firstElementChild;
  if (form && e.target === form) { closeForm(); return; }
  const el = e.target.closest('[data-action]');
  if (el && ACTIONS[el.dataset.action]) ACTIONS[el.dataset.action](el);
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'task-form') { e.preventDefault(); submitForm(); }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'search') { ui.q = e.target.value; renderMain(); return; }
  if (e.target.closest('#task-form')) {
    updateCounters();
    const box = $('#task-error');
    if (!box.hidden) {
      box.hidden = true;
      FIELDS.forEach((f) => { const el = $('#f-' + f); el.classList.remove('is-invalid'); el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); });
    }
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'filter-assignee') { ui.who = e.target.value; renderMain(); }
  else if (e.target.dataset && e.target.dataset.cap) changeCapacity(e.target.dataset.cap, e.target.value);
  else if (e.target.closest('#task-form')) {
    const box = $('#task-error');
    if (!box.hidden) { box.hidden = true; FIELDS.forEach((f) => $('#f-' + f).classList.remove('is-invalid')); }
  }
});

document.addEventListener('keydown', (e) => {
  const dlg = dialogOf();
  if (e.key === 'Escape') {
    if ($('#confirm-root').firstElementChild) $('#confirm-root')._cancel();
    else if (dlg) closeForm();
    else if (ui.plan) cancelPlan(false);
    return;
  }
  if (e.key === 'Tab' && dlg) {
    const f = [...dlg.querySelectorAll('button, input, select, textarea, [tabindex]')].filter((x) => !x.disabled && !x.hidden && x.tabIndex >= 0);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// Drag-and-drop
document.addEventListener('dragstart', (e) => {
  const c = e.target.closest && e.target.closest('[data-task]');
  if (!c) return;
  dragId = c.dataset.task;
  c.classList.add('dragging');
  if (e.dataTransfer) { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; }
});
document.addEventListener('dragend', () => {
  dragId = null;
  document.querySelectorAll('.dragging, .drag-over').forEach((x) => x.classList.remove('dragging', 'drag-over'));
});
document.addEventListener('dragover', (e) => {
  const col = e.target.closest && e.target.closest('[data-status]');
  if (!col) return;
  e.preventDefault();
  col.classList.add('drag-over');
});
document.addEventListener('dragleave', (e) => {
  const col = e.target.closest && e.target.closest('[data-status]');
  if (col && !col.contains(e.relatedTarget)) col.classList.remove('drag-over');
});
document.addEventListener('drop', (e) => {
  const col = e.target.closest && e.target.closest('[data-status]');
  if (!col) return;
  e.preventDefault();
  const id = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || dragId;
  dragId = null;
  col.classList.remove('drag-over');
  if (id) moveTask(id, col.dataset.status);
});

// ---- Старт ----
state = load();
render();
