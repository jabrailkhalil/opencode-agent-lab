import { DEMO_WEEK, STATUSES, STATUS_LABELS, seedState, addDays, loadFor, validateTask, proposePlan, applyPlan, isValidState } from './domain.js';

const KEY = 'potok.state.v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const tid = (id, r = document) => r.querySelector(`[data-testid="${id}"]`);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fh = (n) => String(n).replace('.', ',');
const ui = { week: DEMO_WEEK, view: 'board', search: '', assignee: '', form: null, plan: null, confirm: null };
let state;

// ---- Хранение ----
function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { return { state: seedState() }; }
  if (raw === null) return { state: seedState() };
  try { const s = JSON.parse(raw); if (isValidState(s)) return { state: s }; } catch { /* повреждён */ }
  return { state: seedState(), corrupt: true };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { notice('Не удалось сохранить данные в браузере', 'warning'); }
}
function notice(text, kind = 'warning') {
  $('#notice-slot').innerHTML = `<div class="alert alert-${kind} alert-dismissible" role="alert" data-testid="notice">${esc(text)}<button type="button" class="btn-close" data-act="close-notice" aria-label="Закрыть уведомление"></button></div>`;
}
const announce = (text) => { $('#live').textContent = ''; setTimeout(() => { $('#live').textContent = text; }, 30); };
function commit(next) {
  state = next; save();
  if (ui.plan) { ui.plan = null; renderPlan(); }
  renderAll();
}

// ---- Вспомогательное ----
const emps = () => state.employees;
const empName = (id) => emps().find((e) => e.id === id)?.name ?? 'Без ответственного';
const weekTasks = () => state.tasks.filter((t) => t.week === ui.week);
function weekLabel(w) {
  const end = addDays(w, 6), p = (d) => d.slice(8) + '.' + d.slice(5, 7);
  return w.slice(0, 4) === end.slice(0, 4) ? `Неделя ${p(w)}–${p(end)}.${end.slice(0, 4)}` : `Неделя ${p(w)}.${w.slice(0, 4)}–${p(end)}.${end.slice(0, 4)}`;
}
function visibleTasks() {
  const q = ui.search.trim().toLowerCase();
  return weekTasks().filter((t) => (!ui.assignee || t.assignee === ui.assignee)
    && (!q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)));
}

// ---- Шапка, метрики, сотрудники ----
function renderHeader() {
  tid('week-label').textContent = weekLabel(ui.week);
  for (const v of ['board', 'employees']) tid('view-' + v).setAttribute('aria-pressed', String(ui.view === v));
  $('#board').hidden = ui.view !== 'board';
  $('#employees-view').hidden = ui.view !== 'employees';
  tid('propose-plan').disabled = !!ui.plan;
}
function renderMetrics() {
  const tasks = weekTasks(), sum = (a) => a.reduce((s, t) => s + t.hours, 0);
  const over = emps().filter((e) => loadFor(state, e.id, ui.week).overload > 0).length;
  const items = [['Задач', tasks.length, 'tasks'], ['Часов всего', fh(sum(tasks)), 'total'],
    ['Активных часов', fh(sum(tasks.filter((t) => t.status !== 'done'))), 'active'], ['Перегружено', over, 'over']];
  $('#metrics').innerHTML = items.map(([l, v, k]) => `<div class="card metric" data-testid="metric-${k}"><div class="block-label">${l}</div><div class="metric-value">${esc(v)}</div></div>`).join('');
}
function buildTeam() {
  $('#team').innerHTML = emps().map((e) => `
  <article class="card" data-testid="employee-${e.id}" aria-label="${esc(e.name)}"><div class="card-body">
    <div class="emp-head"><span class="avatar avatar-sm" style="background:${esc(e.color)};color:#fff" aria-hidden="true">${esc(e.initials)}</span>
      <div><div class="emp-name">${esc(e.name)}</div><div class="block-label">${esc(e.role)}</div></div></div>
    <div class="block" data-testid="load-${e.id}">
      <div class="block-label">Загрузка · активные задачи</div>
      <div class="block-value"><span data-f="load-text"></span><span data-f="load-badge"></span></div>
      <div class="progress progress-sm"><div class="progress-bar" role="progressbar" data-f="load-bar" aria-valuemin="0" aria-valuemax="100" aria-label="Загрузка: ${esc(e.name)}"></div></div>
    </div>
    <div class="block" data-testid="progress-${e.id}">
      <div class="block-label">Прогресс · выполнено</div>
      <div class="block-value" data-f="prog-text"></div>
      <div class="progress progress-sm"><div class="progress-bar bg-green" role="progressbar" data-f="prog-bar" aria-valuemin="0" aria-valuemax="100" aria-label="Прогресс: ${esc(e.name)}"></div></div>
    </div>
    <div class="cap-field"><label class="form-label" for="capacity-${e.id}">Доступно, ч на неделю</label>
      <input class="form-control" id="capacity-${e.id}" data-testid="capacity-${e.id}" type="number" min="0" max="168" step="0.5" inputmode="decimal" aria-describedby="capacity-error-${e.id}">
      <div class="text-danger small" id="capacity-error-${e.id}" data-testid="capacity-error-${e.id}" role="alert"></div></div>
  </div></article>`).join('');
}
function renderTeam() {
  if (!$('#team').children.length) buildTeam();
  for (const e of emps()) {
    const l = loadFor(state, e.id, ui.week), root = tid('employee-' + e.id), f = (n) => $(`[data-f="${n}"]`, root);
    const pct = l.percent === null ? 'нет доступности' : l.percent + '%';
    f('load-text').textContent = `${fh(l.hours)} / ${fh(l.capacity)} ч · ${pct}`;
    f('load-badge').innerHTML = l.overload > 0 ? `<span class="badge bg-red-lt">Перегрузка +${fh(l.overload)} ч</span>` : '<span class="badge bg-green-lt">В пределах доступности</span>';
    const w = l.percent === null ? 0 : Math.min(100, l.percent);
    const bar = f('load-bar');
    bar.style.width = w + '%'; bar.setAttribute('aria-valuenow', w);
    bar.setAttribute('aria-valuetext', `${fh(l.hours)} из ${fh(l.capacity)} ч`);
    bar.classList.toggle('bg-red', l.overload > 0);
    f('prog-text').textContent = l.totalHours > 0 ? `${fh(l.doneHours)} из ${fh(l.totalHours)} ч · ${l.progress}%` : 'Нет назначенных часов · 0%';
    const pb = f('prog-bar');
    pb.style.width = l.progress + '%'; pb.setAttribute('aria-valuenow', l.progress);
    const inp = tid('capacity-' + e.id);
    if (document.activeElement !== inp) { inp.value = l.capacity; inp.removeAttribute('aria-invalid'); tid('capacity-error-' + e.id).textContent = ''; }
  }
}
function buildFilter() {
  const sel = tid('filter-assignee');
  sel.innerHTML = '<option value="">Все</option>' + emps().map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
}
function capacityChange(id) {
  const inp = tid('capacity-' + id), err = tid('capacity-error-' + id);
  const raw = inp.value.trim(), v = Number(raw);
  const fail = (m) => { err.textContent = m; inp.setAttribute('aria-invalid', 'true'); inp.value = loadFor(state, id, ui.week).capacity; };
  if (raw === '' || !Number.isFinite(v) || v < 0 || v > 168 || !Number.isInteger(v * 2)) return fail('Доступность — число от 0 до 168 с шагом 0,5');
  err.textContent = ''; inp.removeAttribute('aria-invalid');
  if (v === loadFor(state, id, ui.week).capacity) return;
  const next = structuredClone(state);
  next.employees.find((e) => e.id === id).capacities[ui.week] = v;
  commit(next);
}

// ---- Список задач ----
const STATUS_BADGE = { todo: 'bg-secondary-lt', doing: 'bg-blue-lt', done: 'bg-green-lt' };
function taskCard(t) {
  const label = `${t.id} ${t.title}`;
  return `<article class="card card-sm task-card" draggable="true" data-id="${t.id}" data-testid="task-${t.id}"><div class="card-body d-flex flex-column gap-2">
    <div class="task-title">${esc(t.title)}</div>
    <div class="task-meta"><span class="badge bg-blue-lt">${esc(empName(t.assignee))}</span><span>${fh(t.hours)} ч</span><span class="badge ${STATUS_BADGE[t.status]}">${STATUS_LABELS[t.status]}</span></div>
    ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ''}
    <div class="task-actions">
      <button type="button" class="btn btn-sm" data-act="edit" data-id="${t.id}" data-testid="edit-${t.id}" aria-label="Изменить ${esc(label)}">Изменить</button>
      <button type="button" class="btn btn-sm btn-outline-danger" data-act="delete" data-id="${t.id}" data-testid="delete-${t.id}" aria-label="Удалить ${esc(label)}">Удалить</button>
    </div></div></article>`;
}
const emptyBlock = (title, hint = '', btn = '') => `<div class="empty-state" data-testid="empty-state"><strong>${title}</strong>${hint ? `<span>${hint}</span>` : ''}${btn}</div>`;
const newBtn = '<button type="button" class="btn btn-primary" data-act="new">Новая задача</button>';
const resetBtn = '<button type="button" class="btn" data-act="reset-filter">Сбросить поиск и фильтр</button>';
function renderBoard(list, all) {
  const root = $('#board');
  if (!all.length) { root.innerHTML = `<div style="grid-column:1/-1">${emptyBlock('На этой неделе задач нет', 'Создайте первую задачу недели.', newBtn)}</div>`; return; }
  const note = !list.length ? `<div class="card card-body" style="grid-column:1/-1">${emptyBlock('Ничего не найдено', 'Измените запрос или фильтр.', resetBtn)}</div>` : '';
  root.innerHTML = note + STATUSES.map((s) => {
    const items = list.filter((t) => t.status === s);
    return `<div class="col-zone" data-status="${s}" data-testid="column-${s}" role="group" aria-label="${STATUS_LABELS[s]}">
      <div class="col-title"><span>${STATUS_LABELS[s]}</span><span class="badge ${STATUS_BADGE[s]}">${items.length}</span></div>
      ${items.length ? items.map(taskCard).join('') : '<div class="empty-state">Нет задач</div>'}</div>`;
  }).join('');
}
function renderGroups(list, all) {
  const root = $('#employees-view');
  const groups = [...emps().map((e) => ({ id: e.id, name: e.name })), { id: null, name: 'Без ответственного' }]
    .filter((g) => !ui.assignee || g.id === ui.assignee);
  const head = !all.length ? emptyBlock('На этой неделе задач нет', '', newBtn) : !list.length ? emptyBlock('Ничего не найдено', 'Измените запрос или фильтр.', resetBtn) : '';
  root.innerHTML = head + groups.map((g) => {
    const items = list.filter((t) => t.assignee === g.id);
    const none = g.id === null ? 'Все задачи распределены' : all.some((t) => t.assignee === g.id) ? 'Нет подходящих задач' : 'Нет задач на этой неделе';
    return `<section class="card" data-testid="group-${g.id ?? 'none'}" aria-label="${esc(g.name)}"><div class="card-header"><h3 class="card-title">${esc(g.name)}</h3><span class="badge bg-secondary-lt ms-auto">${items.length}</span></div>
      <div class="card-body group-list">${items.length ? items.map(taskCard).join('') : `<div class="empty-state">${none}</div>`}</div></section>`;
  }).join('');
}
function renderList() {
  const all = weekTasks(), list = visibleTasks();
  if (ui.view === 'board') { renderBoard(list, all); $('#employees-view').innerHTML = ''; }
  else { renderGroups(list, all); $('#board').innerHTML = ''; }
}
function changeStatus(id, status) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t || t.status === status || !STATUSES.includes(status)) return;
  const next = structuredClone(state);
  next.tasks[state.tasks.indexOf(t)] = validateTask({ ...t, status }, state.employees);
  commit(next);
  announce(`Задача ${id}: ${STATUS_LABELS[status]}`);
}
let dragId = null;
function setupDnd() {
  const b = $('#board');
  b.addEventListener('dragstart', (e) => {
    const c = e.target.closest?.('.task-card'); if (!c) return;
    dragId = c.dataset.id; e.dataTransfer?.setData('text/plain', dragId);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    c.classList.add('dragging');
  });
  b.addEventListener('dragend', () => { dragId = null; $$('.dragging, .drag-over', b).forEach((x) => x.classList.remove('dragging', 'drag-over')); });
  b.addEventListener('dragover', (e) => { const z = e.target.closest?.('.col-zone'); if (z) { e.preventDefault(); z.classList.add('drag-over'); } });
  b.addEventListener('dragleave', (e) => { const z = e.target.closest?.('.col-zone'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('drag-over'); });
  b.addEventListener('drop', (e) => {
    const z = e.target.closest?.('.col-zone'); if (!z) return;
    e.preventDefault();
    const id = e.dataTransfer?.getData('text/plain') || dragId;
    dragId = null; changeStatus(id, z.dataset.status);
  });
}

// ---- Форма задачи ----
const FIELD_BY_ERROR = [[/^Название/, 'title'], [/^Описание/, 'description'], [/^Оценка/, 'hours'], [/ответственного/, 'assignee'], [/статус/, 'status'], [/^Неделя/, 'week']];
function openForm(id) {
  const t = id ? state.tasks.find((x) => x.id === id) : null;
  ui.form = { id: id || null };
  const v = t || { title: '', description: '', assignee: '', hours: '', status: 'todo', week: ui.week };
  const opt = (val, text, cur) => `<option value="${esc(val)}"${String(cur ?? '') === val ? ' selected' : ''}>${esc(text)}</option>`;
  const fld = (name, label, hint, inner) => `<div><label class="form-label" for="f-${name}">${label}</label>${inner}<div class="form-hint">${hint}</div></div>`;
  $('#form-slot').innerHTML = `
  <form class="card" data-testid="task-form" novalidate aria-labelledby="form-title"><div class="card-body d-flex flex-column gap-3">
    <h2 class="card-title" id="form-title" tabindex="-1">${t ? 'Изменить ' + t.id : 'Новая задача'}</h2>
    ${fld('title', 'Название *', '1–140 символов', `<input class="form-control" id="f-title" data-testid="task-title" type="text" value="${esc(v.title)}" autocomplete="off">`)}
    ${fld('description', 'Описание', 'до 1000 символов', `<textarea class="form-control" id="f-description" data-testid="task-description" rows="3">${esc(v.description)}</textarea>`)}
    <div class="form-grid">
      ${fld('assignee', 'Ответственный', 'можно оставить без ответственного', `<select class="form-select" id="f-assignee" data-testid="task-assignee">${opt('', 'Без ответственного', v.assignee ?? '')}${emps().map((e) => opt(e.id, e.name, v.assignee)).join('')}</select>`)}
      ${fld('status', 'Статус', 'Новая, В работе или Готово', `<select class="form-select" id="f-status" data-testid="task-status">${STATUSES.map((s) => opt(s, STATUS_LABELS[s], v.status)).join('')}</select>`)}
      ${fld('hours', 'Оценка, ч *', '0,5–168, шаг 0,5', `<input class="form-control" id="f-hours" data-testid="task-hours" type="text" inputmode="decimal" value="${esc(v.hours)}" autocomplete="off">`)}
      ${fld('week', 'Неделя (понедельник) *', 'дата понедельника', `<input class="form-control" id="f-week" data-testid="task-week" type="date" value="${esc(v.week)}">`)}
    </div>
    <div class="alert alert-danger" role="alert" data-testid="task-error" hidden></div>
    <div class="form-actions"><button type="submit" class="btn btn-primary" data-testid="task-save">Сохранить</button><button type="button" class="btn" data-testid="task-cancel">Отмена</button></div>
  </div></form>`;
  tid('task-form').scrollIntoView?.({ block: 'nearest' });
  tid('task-title').focus();
}
function closeForm() { ui.form = null; $('#form-slot').innerHTML = ''; }
function submitForm() {
  const val = (n) => tid('task-' + n).value;
  const err = tid('task-error');
  $$('[aria-invalid]', tid('task-form')).forEach((x) => { x.removeAttribute('aria-invalid'); x.classList.remove('is-invalid'); });
  const cur = ui.form.id ? state.tasks.find((t) => t.id === ui.form.id) : null;
  const cand = { ...(cur || {}), id: cur ? cur.id : `TASK-${state.nextId}`, title: val('title'), description: val('description'), assignee: val('assignee') || null, hours: val('hours'), status: val('status'), week: val('week') };
  let task;
  try { task = validateTask(cand, state.employees); }
  catch (e) {
    err.textContent = e.message; err.hidden = false;
    const f = FIELD_BY_ERROR.find(([re]) => re.test(e.message))?.[1];
    const el = f && tid('task-' + f);
    if (el) { el.setAttribute('aria-invalid', 'true'); el.classList.add('is-invalid'); el.focus(); }
    return;
  }
  const next = structuredClone(state);
  if (cur) next.tasks[state.tasks.indexOf(cur)] = task;
  else { next.tasks.push(task); next.nextId += 1; }
  closeForm();
  ui.week = task.week;
  commit(next);
  announce(cur ? 'Задача сохранена' : 'Задача создана');
}

// ---- Предпросмотр плана и подтверждения ----
function renderPlan() {
  const slot = $('#plan-slot'), plan = ui.plan;
  tid('propose-plan').disabled = !!plan;
  if (!plan) { slot.innerHTML = ''; return; }
  const placed = plan.assignments.filter((a) => a.assignee).length, byId = new Map(state.tasks.map((t) => [t.id, t]));
  const rows = plan.assignments.map((a) => {
    const t = byId.get(a.taskId), changed = (t.assignee ?? null) !== a.assignee;
    return `<tr><td data-label="Задача">${esc(t.id + ' ' + t.title)}</td><td data-label="Было">${esc(empName(t.assignee))}</td><td data-label="Станет">${esc(empName(a.assignee))}</td><td data-label="Изменение"><span class="${changed ? 'changed badge bg-blue-lt' : ''}">${changed ? 'Изменится' : 'Без изменений'}</span></td></tr>`;
  }).join('');
  const after = applyPlan(state, plan);
  const loads = emps().map((e) => { const l = loadFor(after, e.id, ui.week); return `<div>${esc(e.name)}: ${fh(l.hours)} / ${fh(l.capacity)} ч · ${l.percent === null ? 'нет доступности' : l.percent + '%'}</div>`; }).join('');
  slot.innerHTML = `<section class="card" data-testid="plan-preview" role="region" aria-labelledby="plan-title"><div class="card-body">
    <h2 class="card-title" id="plan-title" tabindex="-1">Предпросмотр распределения</h2>
    ${plan.assignments.length ? `<div class="alert ${plan.unassignedHours > 0 ? 'alert-warning' : 'alert-success'}" data-testid="plan-summary">Назначено задач: ${placed} · без ответственного: ${fh(plan.unassignedHours)} ч${plan.unassignedHours > 0 ? '. Эти задачи не помещаются в доступность.' : ''}</div>
    <table class="plan-table"><thead><tr><th>Задача</th><th>Было</th><th>Станет</th><th>Изменение</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="block-label mt-3">Нагрузка после применения</div><div class="plan-after">${loads}</div>` : '<div class="alert alert-info">Нет активных задач для распределения</div>'}
    <div class="form-actions"><button type="button" class="btn btn-primary" data-testid="plan-apply"${plan.assignments.length ? '' : ' disabled'}>Применить распределение</button><button type="button" class="btn" data-testid="plan-cancel">Отмена</button></div>
  </div></section>`;
  $('#plan-title').focus();
}
function renderConfirm() {
  const c = ui.confirm, slot = $('#confirm-slot');
  if (!c) { slot.innerHTML = ''; return; }
  const t = c.id && state.tasks.find((x) => x.id === c.id);
  const text = c.kind === 'delete' ? `Удалить ${esc(c.id)} «${esc(t?.title)}»?` : 'Заменить данные учебным примером?';
  slot.innerHTML = `<div class="alert alert-warning" role="alertdialog" aria-labelledby="confirm-text" data-testid="confirm"><div id="confirm-text" class="mb-2">${text}</div>
    <div class="confirm-actions"><button type="button" class="btn btn-danger" data-testid="confirm-yes">${c.kind === 'delete' ? 'Удалить' : 'Восстановить'}</button><button type="button" class="btn" data-testid="confirm-no">Отмена</button></div></div>`;
  tid('confirm-no').focus();
}
function askConfirm(kind, id = null) { ui.confirm = { kind, id }; renderConfirm(); }
function doConfirm() {
  const c = ui.confirm; ui.confirm = null; renderConfirm();
  if (c.kind === 'delete') {
    if (ui.form?.id === c.id) closeForm();
    commit({ ...state, tasks: state.tasks.filter((t) => t.id !== c.id) });
    announce(`Задача ${c.id} удалена`);
  } else {
    closeForm(); ui.week = DEMO_WEEK; $('#notice-slot').innerHTML = '';
    commit(seedState()); announce('Учебный пример восстановлен');
  }
}
function openPlan() { ui.plan = proposePlan(state, ui.week); renderPlan(); }
function applyCurrentPlan() {
  const next = applyPlan(state, ui.plan);
  commit(next); announce('Распределение применено');
}

// ---- Сборка и события ----
function renderAll() { renderHeader(); renderMetrics(); renderTeam(); renderList(); }
function closePlan() { ui.plan = null; renderPlan(); }
function goWeek(w) { ui.week = w; closePlan(); renderAll(); }
function setView(v) { ui.view = v; renderAll(); }
function resetFilters() {
  ui.search = ''; ui.assignee = ''; tid('search').value = ''; tid('filter-assignee').value = ''; renderList();
}
function onClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  const act = b.dataset.act, id = b.dataset.testid;
  if (act === 'close-notice') $('#notice-slot').innerHTML = '';
  else if (act === 'new') openForm();
  else if (act === 'reset-filter') resetFilters();
  else if (act === 'edit') openForm(b.dataset.id);
  else if (act === 'delete') askConfirm('delete', b.dataset.id);
  else if (id === 'task-cancel') closeForm();
  else if (id === 'plan-cancel') closePlan();
  else if (id === 'plan-apply') applyCurrentPlan();
  else if (id === 'confirm-yes') doConfirm();
  else if (id === 'confirm-no') { ui.confirm = null; renderConfirm(); }
}
function wire() {
  document.addEventListener('click', onClick);
  tid('new-task').addEventListener('click', () => openForm());
  tid('propose-plan').addEventListener('click', openPlan);
  tid('reset-demo').addEventListener('click', () => askConfirm('reset'));
  tid('prev-week').addEventListener('click', () => goWeek(addDays(ui.week, -7)));
  tid('next-week').addEventListener('click', () => goWeek(addDays(ui.week, 7)));
  tid('current-week').addEventListener('click', () => goWeek(DEMO_WEEK));
  tid('view-board').addEventListener('click', () => setView('board'));
  tid('view-employees').addEventListener('click', () => setView('employees'));
  tid('search').addEventListener('input', (e) => { ui.search = e.target.value; renderList(); });
  tid('filter-assignee').addEventListener('change', (e) => { ui.assignee = e.target.value; renderList(); });
  $('#team').addEventListener('change', (e) => { if (e.target.id?.startsWith('capacity-')) capacityChange(e.target.id.slice(9)); });
  $('#form-slot').addEventListener('submit', (e) => { e.preventDefault(); submitForm(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (ui.confirm) { ui.confirm = null; renderConfirm(); }
    else if (ui.plan) closePlan();
    else if (ui.form) closeForm();
  });
  setupDnd();
}
function init() {
  const r = loadState();
  state = r.state;
  buildFilter(); wire();
  if (r.corrupt) { save(); notice('Сохранённые данные повреждены, загружен учебный пример'); }
  renderAll();
  $('#app').dataset.ready = 'true';
}
init();

