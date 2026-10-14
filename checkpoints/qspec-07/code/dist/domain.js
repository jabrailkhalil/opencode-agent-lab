// Домен «Потока»: чистые функции без DOM. Контракт — docs/INTERFACES.md.
export const DEMO_WEEK = '2026-09-28';
export const STATUSES = ['todo', 'doing', 'done'];

// Копия данных docs/seed-state.json (вымышленные данные).
const SEED = {
  version: 1,
  employees: [
    { id: 'anna', name: 'Анна Смирнова', initials: 'АС', role: 'Разработка', color: '#5468d3', capacity: 24, capacities: {} },
    { id: 'dmitry', name: 'Дмитрий Волков', initials: 'ДВ', role: 'Разработка', color: '#007d87', capacity: 32, capacities: {} },
    { id: 'maria', name: 'Мария Орлова', initials: 'МО', role: 'Аналитика', color: '#a25a23', capacity: 24, capacities: {} },
    { id: 'ilya', name: 'Илья Соколов', initials: 'ИС', role: 'Тестирование', color: '#a34e88', capacity: 24, capacities: {} }
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
    { id: 'TASK-109', title: 'Добавить подсказки на доске', description: 'Короткие пояснения статусов задач.', assignee: null, hours: 4, status: 'todo', week: '2026-09-28' }
  ],
  nextId: 110
};

export function seedState() { return structuredClone(SEED); }

// Понедельник ISO-недели; вычисления только через UTC, без часового пояса.
export function monday(date) {
  const s = date instanceof Date ? date.toISOString() : String(date);
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const t = Date.UTC(y, (m || 1) - 1, d || 1);
  const dow = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - dow * 86400000).toISOString().slice(0, 10);
}

function capacityOf(employee, week) {
  const c = employee.capacities && Object.prototype.hasOwnProperty.call(employee.capacities, week)
    ? Number(employee.capacities[week]) : Number(employee.capacity);
  return Number.isFinite(c) ? c : 0;
}

export function loadFor(state, employeeId, week) {
  const tasks = state.tasks.filter(t => t.assignee === employeeId && t.week === week);
  const active = tasks.filter(t => t.status !== 'done');
  const done = tasks.filter(t => t.status === 'done');
  const sum = list => list.reduce((s, t) => s + Number(t.hours), 0);
  const hours = sum(active);
  const doneHours = sum(done);
  const totalHours = hours + doneHours;
  const employee = state.employees.find(e => e.id === employeeId);
  const capacity = employee ? capacityOf(employee, week) : 0;
  return {
    tasks, active, hours, capacity, totalHours, doneHours,
    overload: Math.max(0, hours - capacity),
    percent: capacity > 0 ? Math.round((hours / capacity) * 100) : null,
    progress: totalHours > 0 ? Math.round((doneHours / totalHours) * 100) : 0
  };
}

// Нормализованная копия задачи или Error; вход не мутируется.
export function validateTask(task, employees) {
  const fail = m => { throw new Error(m); };
  const title = String(task.title ?? '').trim();
  if (title.length < 1 || title.length > 140) fail('Название: от 1 до 140 символов после пробелов.');
  const description = String(task.description ?? '').trim();
  if (description.length > 1000) fail('Описание: не длиннее 1000 символов.');
  const hours = Number(task.hours);
  if (!Number.isFinite(hours) || hours < 0.5 || hours > 168 || !Number.isInteger(hours * 2))
    fail('Оценка: от 0,5 до 168 часов с шагом 0,5.');
  const rawAssignee = task.assignee;
  const assignee = rawAssignee === null || rawAssignee === undefined || rawAssignee === ''
    ? null : String(rawAssignee);
  if (assignee !== null && !employees.some(e => e.id === assignee))
    fail('Ответственный: выберите сотрудника или «Без ответственного».');
  if (!STATUSES.includes(task.status)) fail('Статус: только «Новая», «В работе» или «Готово».');
  const week = String(task.week ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || monday(week) !== week)
    fail('Неделя: дата должна быть понедельником (YYYY-MM-DD).');
  const clean = { title, description, assignee, hours, status: task.status, week };
  if (typeof task.id === 'string' && task.id) clean.id = task.id;
  return clean;
}

// Жадно: часы DESC, затем id; сотрудник с наибольшим остатком доступности.
export function proposePlan(state, week) {
  const pool = state.employees.map(e => ({ id: e.id, remaining: Math.max(0, capacityOf(e, week)) }));
  const active = state.tasks
    .filter(t => t.week === week && t.status !== 'done')
    .sort((a, b) => b.hours - a.hours || String(a.id).localeCompare(String(b.id)));
  const assignments = [];
  let unassignedHours = 0;
  for (const t of active) {
    let best = null;
    for (const e of pool) if (e.remaining >= t.hours && (!best || e.remaining > best.remaining)) best = e;
    if (best) { best.remaining -= t.hours; assignments.push({ taskId: t.id, assignee: best.id }); }
    else { assignments.push({ taskId: t.id, assignee: null }); unassignedHours += Number(t.hours); }
  }
  return { assignments, unassignedHours };
}

export function applyPlan(state, plan) {
  const map = new Map(plan.assignments.map(a => [a.taskId, a.assignee]));
  const tasks = state.tasks.map(t => (map.has(t.id) ? { ...t, assignee: map.get(t.id) } : t));
  return { ...structuredClone(state), tasks };
}

export function isValidState(state) {
  try {
    if (!state || typeof state !== 'object') return false;
    if (!Array.isArray(state.employees) || !Array.isArray(state.tasks)) return false;
    if (!Number.isInteger(state.nextId) || state.nextId < 110) return false;
    const ids = new Set();
    for (const e of state.employees) {
      if (!e || typeof e.id !== 'string' || !e.id || ids.has(e.id)) return false;
      ids.add(e.id);
      if (typeof e.name !== 'string' || typeof e.initials !== 'string') return false;
      if (typeof e.role !== 'string' || typeof e.color !== 'string') return false;
      if (!Number.isFinite(Number(e.capacity))) return false;
      if (e.capacities && (typeof e.capacities !== 'object' || Array.isArray(e.capacities))) return false;
      for (const v of Object.values(e.capacities || {}))
        if (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 168) return false;
    }
    const taskIds = new Set();
    for (const t of state.tasks) {
      if (!t || typeof t.id !== 'string' || !t.id || taskIds.has(t.id)) return false;
      taskIds.add(t.id);
      if (typeof t.title !== 'string' || !t.title.trim() || t.title.length > 140) return false;
      if (typeof t.description !== 'string' || t.description.length > 1000) return false;
      if (!(t.assignee === null || ids.has(t.assignee))) return false;
      if (!Number.isFinite(Number(t.hours)) || Number(t.hours) < 0.5 || Number(t.hours) > 168) return false;
      if (!STATUSES.includes(t.status)) return false;
      if (typeof t.week !== 'string' || monday(t.week) !== t.week) return false;
    }
    return true;
  } catch {
    return false;
  }
}
