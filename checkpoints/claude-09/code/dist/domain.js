// Доменная логика «Поток»: чистые функции без обращения к DOM и localStorage.
// Работает и в браузере (ES-модуль), и в Node (тесты).

export const DEMO_WEEK = '2026-09-28';
export const STATUSES = ['todo', 'doing', 'done'];
export const STATUS_LABELS = { todo: 'Новая', doing: 'В работе', done: 'Готово' };
export const MAX_HOURS = 168;
export const MIN_NEXT_ID = 110;

// Встроенная копия docs/seed-state.json (браузер не читает docs/).
const SEED = {
  version: 1,
  employees: [
    { id: 'anna', name: 'Анна Смирнова', initials: 'АС', role: 'Разработка', color: '#5468d3', capacity: 24, capacities: {} },
    { id: 'dmitry', name: 'Дмитрий Волков', initials: 'ДВ', role: 'Разработка', color: '#007d87', capacity: 32, capacities: {} },
    { id: 'maria', name: 'Мария Орлова', initials: 'МО', role: 'Аналитика', color: '#a25a23', capacity: 24, capacities: {} },
    { id: 'ilya', name: 'Илья Соколов', initials: 'ИС', role: 'Тестирование', color: '#a34e88', capacity: 24, capacities: {} },
  ],
  tasks: [
    { id: 'TASK-101', title: 'Обновить форму заявки', description: 'Добавить выбор типа ресурса и понятные подсказки.', assignee: 'anna', hours: 16, status: 'doing', week: '2026-09-28' },
    { id: 'TASK-102', title: 'Подключить витрину метрик', description: 'Показать основные показатели на странице команды.', assignee: 'anna', hours: 16, status: 'todo', week: '2026-09-28' },
    { id: 'TASK-103', title: 'Добавить фильтры в реестр', description: 'Фильтрация по статусу и ответственному.', assignee: 'dmitry', hours: 8, status: 'doing', week: '2026-09-28' },
    { id: 'TASK-104', title: 'Исправить выгрузку отчёта', description: 'Сохранить порядок столбцов и заголовки.', assignee: 'dmitry', hours: 6, status: 'todo', week: '2026-09-28' },
    { id: 'TASK-105', title: 'Описать правила согласования', description: 'Зафиксировать переходы статусов и критерии приёмки.', assignee: 'maria', hours: 8, status: 'doing', week: '2026-09-28' },
    { id: 'TASK-106', title: 'Проверить сценарии заявок', description: 'Проверить создание, редактирование и завершение заявки.', assignee: 'ilya', hours: 12, status: 'todo', week: '2026-09-28' },
    { id: 'TASK-107', title: 'Подготовить тестовые данные', description: 'Набор вымышленных заявок для демонстрации.', assignee: 'ilya', hours: 4, status: 'done', week: '2026-09-28' },
    { id: 'TASK-108', title: 'Согласовать поля заявки', description: 'Названия, обязательность и ограничения полей.', assignee: 'maria', hours: 6, status: 'done', week: '2026-09-28' },
    { id: 'TASK-109', title: 'Добавить подсказки на доске', description: 'Короткие пояснения статусов задач.', assignee: null, hours: 4, status: 'todo', week: '2026-09-28' },
  ],
  nextId: 110,
};

export function seedState() {
  return JSON.parse(JSON.stringify(SEED));
}

/* ---------- Даты (только UTC-арифметика, без локального часового пояса) ---------- */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIso(value) {
  if (typeof value !== 'string') return null;
  const m = ISO_RE.exec(value);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return t;
}

function formatUtc(t) {
  const d = new Date(t);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function isIsoDate(value) {
  return parseIso(value) !== null;
}

export function isMonday(value) {
  const t = parseIso(value);
  return t !== null && new Date(t).getUTCDay() === 1;
}

/** Понедельник недели, в которую попадает дата (строка YYYY-MM-DD или Date → UTC-компоненты). */
export function monday(date) {
  let t;
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) throw new RangeError('Некорректная дата');
    t = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  } else {
    const s = typeof date === 'string' ? date.trim().slice(0, 10) : date;
    t = parseIso(s);
    if (t === null) throw new RangeError('Некорректная дата: ' + String(date));
  }
  const dow = new Date(t).getUTCDay(); // 0 = воскресенье
  const back = (dow + 6) % 7;
  return formatUtc(t - back * 86400000);
}

export function addDays(date, days) {
  const t = parseIso(date);
  if (t === null) throw new RangeError('Некорректная дата: ' + String(date));
  return formatUtc(t + days * 86400000);
}

/* ---------- Нагрузка ---------- */

export function capacityFor(employee, week) {
  const own = employee && employee.capacities ? employee.capacities[week] : undefined;
  if (typeof own === 'number' && Number.isFinite(own)) return own;
  const base = employee ? employee.capacity : 0;
  return typeof base === 'number' && Number.isFinite(base) ? base : 0;
}

const sumHours = (list) => list.reduce((s, t) => s + t.hours, 0);

export function loadFor(state, employeeId, week) {
  const employee = state.employees.find((e) => e.id === employeeId);
  if (!employee) throw new Error('Неизвестный сотрудник: ' + employeeId);
  const tasks = state.tasks.filter((t) => t.assignee === employeeId && t.week === week);
  const active = tasks.filter((t) => t.status !== 'done');
  const capacity = capacityFor(employee, week);
  const hours = sumHours(active);
  const totalHours = sumHours(tasks);
  const doneHours = totalHours - hours;
  return {
    tasks,
    active,
    hours,
    capacity,
    totalHours,
    doneHours,
    overload: Math.max(0, hours - capacity),
    percent: capacity > 0 ? Math.round((hours / capacity) * 100) : null,
    progress: totalHours > 0 ? Math.round((doneHours / totalHours) * 100) : 0,
  };
}

/* ---------- Валидация ---------- */

function taskProblems(task, employees) {
  const errors = [];
  const out = {};
  const src = task && typeof task === 'object' ? task : {};

  if (typeof src.title !== 'string') errors.push({ field: 'title', message: 'Название: от 1 до 140 символов после удаления пробелов' });
  else {
    out.title = src.title.trim();
    if (out.title.length < 1 || out.title.length > 140) errors.push({ field: 'title', message: 'Название: от 1 до 140 символов после удаления пробелов' });
  }

  if (src.description === undefined || src.description === null) out.description = '';
  else if (typeof src.description !== 'string') errors.push({ field: 'description', message: 'Описание: должно быть текстом' });
  else {
    out.description = src.description.trim();
    if (out.description.length > 1000) errors.push({ field: 'description', message: 'Описание: не более 1000 символов' });
  }

  const h = src.hours;
  if (typeof h !== 'number' || !Number.isFinite(h) || h < 0.5 || h > MAX_HOURS || !Number.isInteger(h * 2)) {
    errors.push({ field: 'hours', message: 'Оценка: от 0,5 до 168 с шагом 0,5' });
  } else out.hours = h;

  const a = src.assignee;
  if (a === undefined || a === null || a === '') out.assignee = null;
  else if (typeof a === 'string' && Array.isArray(employees) && employees.some((e) => e.id === a)) out.assignee = a;
  else errors.push({ field: 'assignee', message: 'Ответственный: выберите существующего сотрудника или «Без ответственного»' });

  if (STATUSES.includes(src.status)) out.status = src.status;
  else errors.push({ field: 'status', message: 'Статус: выберите «Новая», «В работе» или «Готово»' });

  if (isMonday(src.week)) out.week = src.week;
  else errors.push({ field: 'week', message: 'Неделя: укажите дату понедельника в формате ГГГГ-ММ-ДД' });

  return { errors, out };
}

/** Возвращает нормализованную копию задачи или бросает Error (с полем errors). */
export function validateTask(task, employees) {
  const { errors, out } = taskProblems(task, employees);
  if (errors.length) {
    const err = new Error(errors.map((e) => e.message).join('; '));
    err.errors = errors;
    throw err;
  }
  const copy = { ...task, ...out };
  return copy;
}

/* ---------- Распределение ---------- */

/**
 * Предложение распределения активных задач недели.
 * Максимизируем число назначенных часов (поиск с ветвлением, не жадный проход),
 * при равенстве — стараемся сохранить текущие назначения. Сверх доступности не назначаем.
 */
export function proposePlan(state, week) {
  const tasks = state.tasks.filter((t) => t.week === week && t.status !== 'done');
  const emps = state.employees.map((e) => ({ id: e.id, cap: Math.max(0, capacityFor(e, week)) }));
  const order = tasks.map((t, i) => ({ t, i })).sort((a, b) => b.t.hours - a.t.hours || a.i - b.i);
  const n = order.length;
  const totalHours = order.reduce((s, x) => s + x.t.hours, 0);
  const suffix = new Array(n + 1).fill(0);
  for (let i = n - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + order[i].t.hours;

  const rem = emps.map((e) => e.cap);
  const current = new Array(n).fill(-1);
  let best = { assigned: -1, kept: -1, choice: null };
  let nodes = 0;
  const LIMIT = 400000;

  const candidates = (idx) => {
    const t = order[idx].t;
    const list = [];
    for (let e = 0; e < emps.length; e++) if (rem[e] >= t.hours) list.push(e);
    list.sort((a, b) => {
      const ka = emps[a].id === t.assignee ? 0 : 1;
      const kb = emps[b].id === t.assignee ? 0 : 1;
      if (ka !== kb) return ka - kb;
      const ua = emps[a].cap ? (emps[a].cap - rem[a] + t.hours) / emps[a].cap : 1;
      const ub = emps[b].cap ? (emps[b].cap - rem[b] + t.hours) / emps[b].cap : 1;
      return ua - ub || a - b;
    });
    return list;
  };

  const search = (idx, assigned, kept) => {
    if (best.assigned === totalHours && best.kept === n) return;
    if (nodes++ > LIMIT) return;
    if (idx === n) {
      if (assigned > best.assigned || (assigned === best.assigned && kept > best.kept)) {
        best = { assigned, kept, choice: current.slice() };
      }
      return;
    }
    const capRemaining = rem.reduce((s, r) => s + r, 0);
    const bound = assigned + Math.min(suffix[idx], capRemaining);
    if (bound < best.assigned) return;
    if (bound === best.assigned && kept + (n - idx) <= best.kept) return;
    const t = order[idx].t;
    for (const e of candidates(idx)) {
      rem[e] -= t.hours;
      current[idx] = e;
      search(idx + 1, assigned + t.hours, kept + (emps[e].id === t.assignee ? 1 : 0));
      rem[e] += t.hours;
      current[idx] = -1;
    }
    // Вариант «не назначать»
    current[idx] = -1;
    search(idx + 1, assigned, kept + (t.assignee === null ? 1 : 0));
  };
  search(0, 0, 0);

  const chosen = new Map();
  if (best.choice) order.forEach((x, k) => chosen.set(x.t.id, best.choice[k] >= 0 ? emps[best.choice[k]].id : null));
  const assignments = tasks.map((t) => ({ taskId: t.id, assignee: chosen.has(t.id) ? chosen.get(t.id) : null }));
  const unassignedHours = tasks.reduce((s, t) => s + (chosen.get(t.id) ? 0 : t.hours), 0);
  return { assignments, unassignedHours };
}

/** Новое состояние с применёнными назначениями; выполненные и отсутствующие задачи пропускаются. */
export function applyPlan(state, plan) {
  const next = JSON.parse(JSON.stringify(state));
  const byId = new Map(next.tasks.map((t) => [t.id, t]));
  const ids = new Set(next.employees.map((e) => e.id));
  for (const a of (plan && plan.assignments) || []) {
    const task = byId.get(a.taskId);
    if (!task || task.status === 'done') continue;
    task.assignee = typeof a.assignee === 'string' && ids.has(a.assignee) ? a.assignee : null;
  }
  return next;
}

/* ---------- Проверка сохранённого состояния ---------- */

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isHourValue = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_HOURS;

export function isValidState(state) {
  try {
    if (!isObj(state) || state.version !== 1) return false;
    if (!Number.isInteger(state.nextId) || state.nextId < MIN_NEXT_ID) return false;
    if (!Array.isArray(state.employees) || state.employees.length === 0 || !Array.isArray(state.tasks)) return false;
    const empIds = new Set();
    for (const e of state.employees) {
      if (!isObj(e) || typeof e.id !== 'string' || !e.id || empIds.has(e.id)) return false;
      if (typeof e.name !== 'string' || !e.name.trim()) return false;
      if (!isHourValue(e.capacity)) return false;
      if (e.capacities !== undefined) {
        if (!isObj(e.capacities)) return false;
        for (const [w, v] of Object.entries(e.capacities)) if (!isMonday(w) || !isHourValue(v)) return false;
      }
      empIds.add(e.id);
    }
    const taskIds = new Set();
    for (const t of state.tasks) {
      if (!isObj(t) || typeof t.id !== 'string' || !/^TASK-\d+$/.test(t.id) || taskIds.has(t.id)) return false;
      taskIds.add(t.id);
      const { errors } = taskProblems(t, state.employees);
      if (errors.length) return false;
      if (t.assignee !== null && !empIds.has(t.assignee)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
