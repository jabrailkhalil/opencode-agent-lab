// «Поток»: чистая доменная логика (docs/BRIEF.md, docs/INTERFACES.md, reports/ANALYSIS.md).
// Данные продублированы из docs/seed-state.json: статический офлайн-модуль без fetch.

export const DEMO_WEEK = '2026-09-28';
export const STATUSES = ['todo', 'doing', 'done'];
export const STATUS_LABELS = { todo: 'Новая', doing: 'В работе', done: 'Готово' };

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
  return structuredClone(SEED);
}

// Понедельник недели без зависимости от часового пояса (ANALYSIS §3.7).
export function monday(date) {
  const s = (date instanceof Date ? date.toISOString() : String(date)).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return s;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}

export function addDays(week, days) {
  const [y, m, d] = String(week).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function capacityFor(state, employeeId, week) {
  const e = state.employees.find((x) => x.id === employeeId);
  if (!e) return 0;
  return e.capacities && week in e.capacities ? e.capacities[week] : e.capacity;
}

// Формулы — ANALYSIS §1: tasks — все задачи недели, active — число незавершённых.
export function loadFor(state, employeeId, week) {
  const tasks = state.tasks.filter((t) => t.assignee === employeeId && t.week === week);
  const active = tasks.filter((t) => t.status !== 'done');
  const hours = active.reduce((s, t) => s + t.hours, 0);
  const doneHours = tasks.reduce((s, t) => (t.status === 'done' ? s + t.hours : s), 0);
  const capacity = capacityFor(state, employeeId, week);
  const totalHours = hours + doneHours;
  return {
    tasks,
    active: active.length,
    hours,
    capacity,
    totalHours,
    doneHours,
    overload: Math.max(0, hours - capacity),
    percent: capacity === 0 ? null : Math.round((hours / capacity) * 100),
    progress: totalHours === 0 ? 0 : Math.round((doneHours / totalHours) * 100),
  };
}

// П.10 брифа: нормализованная копия или Error с полем fieldErrors; вход не мутируется.
export function validateTask(task, employees) {
  const errors = {};
  const title = String(task.title ?? '').trim();
  if (!title || title.length > 140) errors.title = 'Название: 1–140 символов после trim';
  const description = String(task.description ?? '').trim();
  if (description.length > 1000) errors.description = 'Описание: не более 1000 символов';
  const hours = Number(task.hours);
  if (!Number.isFinite(hours) || hours < 0.5 || hours > 168 || (hours * 2) % 1 !== 0) {
    errors.hours = 'Оценка: 0,5–168 часов с шагом 0,5';
  }
  const assignee = task.assignee === '' || task.assignee == null ? null : String(task.assignee);
  if (assignee !== null && !employees.some((e) => e.id === assignee)) errors.assignee = 'Ответственный не существует';
  if (!STATUSES.includes(task.status)) errors.status = 'Статус: Новая, В работе или Готово';
  const week = String(task.week ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || monday(week) !== week) errors.week = 'Неделя: понедельник в формате YYYY-MM-DD';
  if (Object.keys(errors).length) {
    const err = new Error(Object.values(errors).join('; '));
    err.fieldErrors = errors;
    throw err;
  }
  return { ...task, title, description, hours, assignee, week };
}

// ANALYSIS §3.4–3.5: LPT — активные задачи недели перераспределяются с нуля,
// по убыванию часов в сотрудника с наибольшей свободной ёмкостью (tie — по id).
export function proposePlan(state, week) {
  const caps = state.employees.map((e) => ({ id: e.id, free: capacityFor(state, e.id, week) }));
  const queue = state.tasks
    .filter((t) => t.week === week && t.status !== 'done')
    .sort((a, b) => b.hours - a.hours || String(a.id).localeCompare(String(b.id)));
  const assignments = [];
  let unassignedHours = 0;
  for (const t of queue) {
    let best = null;
    for (const c of caps) {
      if (c.free >= t.hours && (!best || c.free > best.free || (c.free === best.free && c.id < best.id))) best = c;
    }
    if (best) {
      best.free -= t.hours;
      assignments.push({ taskId: t.id, assignee: best.id });
    } else {
      unassignedHours += t.hours;
      assignments.push({ taskId: t.id, assignee: null });
    }
  }
  return { assignments, unassignedHours };
}

// П.8: применяет назначения только перечисленных задач; done и чужие недели сохраняются.
export function applyPlan(state, plan) {
  const next = structuredClone(state);
  const map = new Map((plan.assignments || []).map((a) => [a.taskId, a.assignee]));
  next.tasks = next.tasks.map((t) => (map.has(t.id) ? { ...t, assignee: map.get(t.id) } : t));
  return next;
}

export function isValidState(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.employees) || !Array.isArray(state.tasks)) return false;
  if (!Number.isInteger(state.nextId) || state.nextId < 110) return false;
  const empIds = new Set();
  for (const e of state.employees) {
    if (!e || typeof e.id !== 'string' || empIds.has(e.id) || typeof e.name !== 'string') return false;
    if (typeof e.capacity !== 'number' || !(e.capacity >= 0 && e.capacity <= 168)) return false;
    if (!e.capacities || typeof e.capacities !== 'object') return false;
    for (const [w, v] of Object.entries(e.capacities)) {
      if (monday(w) !== w || typeof v !== 'number' || !(v >= 0 && v <= 168)) return false;
    }
    empIds.add(e.id);
  }
  const taskIds = new Set();
  for (const t of state.tasks) {
    if (!t || typeof t.id !== 'string' || taskIds.has(t.id)) return false;
    if (typeof t.title !== 'string' || !t.title.trim() || t.title.trim().length > 140) return false;
    if (typeof t.description !== 'string' || t.description.length > 1000) return false;
    if (typeof t.hours !== 'number' || !Number.isFinite(t.hours) || t.hours < 0.5 || t.hours > 168 || (t.hours * 2) % 1 !== 0) return false;
    if (!STATUSES.includes(t.status)) return false;
    if (typeof t.week !== 'string' || monday(t.week) !== t.week) return false;
    if (t.assignee !== null && !empIds.has(t.assignee)) return false;
    taskIds.add(t.id);
  }
  return true;
}
