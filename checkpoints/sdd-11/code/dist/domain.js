// Чистая доменная логика «Потока»: без DOM и localStorage.
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
    { id: 'TASK-101', title: 'Обновить форму заявки', description: 'Добавить выбор типа ресурса и понятные подсказки.', assignee: 'anna', hours: 16, status: 'doing', week: DEMO_WEEK },
    { id: 'TASK-102', title: 'Подключить витрину метрик', description: 'Показать основные показатели на странице команды.', assignee: 'anna', hours: 16, status: 'todo', week: DEMO_WEEK },
    { id: 'TASK-103', title: 'Добавить фильтры в реестр', description: 'Фильтрация по статусу и ответственному.', assignee: 'dmitry', hours: 8, status: 'doing', week: DEMO_WEEK },
    { id: 'TASK-104', title: 'Исправить выгрузку отчёта', description: 'Сохранить порядок столбцов и заголовки.', assignee: 'dmitry', hours: 6, status: 'todo', week: DEMO_WEEK },
    { id: 'TASK-105', title: 'Описать правила согласования', description: 'Зафиксировать переходы статусов и критерии приёмки.', assignee: 'maria', hours: 8, status: 'doing', week: DEMO_WEEK },
    { id: 'TASK-106', title: 'Проверить сценарии заявок', description: 'Проверить создание, редактирование и завершение заявки.', assignee: 'ilya', hours: 12, status: 'todo', week: DEMO_WEEK },
    { id: 'TASK-107', title: 'Подготовить тестовые данные', description: 'Набор вымышленных заявок для демонстрации.', assignee: 'ilya', hours: 4, status: 'done', week: DEMO_WEEK },
    { id: 'TASK-108', title: 'Согласовать поля заявки', description: 'Названия, обязательность и ограничения полей.', assignee: 'maria', hours: 6, status: 'done', week: DEMO_WEEK },
    { id: 'TASK-109', title: 'Добавить подсказки на доске', description: 'Короткие пояснения статусов задач.', assignee: null, hours: 4, status: 'todo', week: DEMO_WEEK },
  ],
  nextId: 110,
};
export const seedState = () => structuredClone(SEED);

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function parseDate(s) {
  const m = DATE_RE.exec(String(s));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const ok = d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  return ok ? d : null;
}
const fmt = (d) => d.toISOString().slice(0, 10);
export function addDays(date, n) {
  const d = parseDate(date);
  if (!d) throw new Error('Некорректная дата');
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}
export function monday(date) {
  const d = date instanceof Date
    ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    : parseDate(date);
  if (!d) throw new Error('Некорректная дата');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return fmt(d);
}
export const isMonday = (s) => { const d = parseDate(s); return !!d && d.getUTCDay() === 1; };

export const isActive = (t) => t.status === 'todo' || t.status === 'doing';
export function capacityFor(emp, week) {
  const c = emp.capacities;
  return c && Object.hasOwn(c, week) ? c[week] : emp.capacity;
}
export function loadFor(state, employeeId, week) {
  const emp = state.employees.find((e) => e.id === employeeId);
  const tasks = state.tasks.filter((t) => t.assignee === employeeId && t.week === week);
  const active = tasks.filter(isActive);
  const sum = (a) => a.reduce((s, t) => s + t.hours, 0);
  const hours = sum(active);
  const doneHours = sum(tasks.filter((t) => t.status === 'done'));
  const totalHours = sum(tasks);
  const capacity = emp ? capacityFor(emp, week) : 0;
  return {
    tasks, active, hours, capacity, totalHours, doneHours,
    overload: Math.max(0, hours - capacity),
    percent: capacity > 0 ? Math.round((hours / capacity) * 100) : null,
    progress: totalHours > 0 ? Math.round((doneHours / totalHours) * 100) : 0,
  };
}

const NUM_RE = /^(\d+([.,]\d*)?|[.,]\d+)$/; // только десятичная запись: без 0x10, 1e1, знака
const EMP_ID_RE = /^[a-z0-9_-]+$/;
const TASK_ID_RE = /^TASK-\d+$/;
export const isHours = (h) => typeof h === 'number' && Number.isFinite(h) && h >= 0.5 && h <= 168 && Number.isInteger(h * 2);
export function validateTask(task, employees) {
  const t = { ...task };
  if (typeof t.title !== 'string') throw new Error('Введите название задачи');
  t.title = t.title.trim();
  if (t.title.length < 1) throw new Error('Название не может быть пустым');
  if (t.title.length > 140) throw new Error('Название не длиннее 140 символов');
  if (t.description == null) t.description = '';
  if (typeof t.description !== 'string') throw new Error('Описание должно быть текстом');
  t.description = t.description.trim();
  if (t.description.length > 1000) throw new Error('Описание не длиннее 1000 символов');
  const raw = t.hours;
  const h = typeof raw === 'string' ? (NUM_RE.test(raw.trim()) ? Number(raw.trim().replace(',', '.')) : NaN) : raw;
  if (!isHours(h)) throw new Error('Оценка — число от 0,5 до 168 с шагом 0,5');
  t.hours = h;
  if (t.assignee === undefined) t.assignee = null;
  if (t.assignee !== null && !(employees || []).some((e) => e.id === t.assignee)) throw new Error('Выберите существующего ответственного');
  if (!STATUSES.includes(t.status)) throw new Error('Недопустимый статус задачи');
  if (!isMonday(t.week)) throw new Error('Неделя должна начинаться с понедельника (дата YYYY-MM-DD)');
  return t;
}

export function isValidState(s) {
  const obj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
  try {
    if (!obj(s) || !Array.isArray(s.employees) || !Array.isArray(s.tasks)) return false;
    if (!Number.isInteger(s.nextId) || s.nextId < 110) return false;
    const ids = new Set();
    const capOk = (c) => typeof c === 'number' && Number.isFinite(c) && c >= 0 && c <= 168 && Number.isInteger(c * 2);
    for (const e of s.employees) {
      if (!obj(e) || typeof e.id !== 'string' || !EMP_ID_RE.test(e.id) || ids.has(e.id)) return false;
      ids.add(e.id);
      if (typeof e.name !== 'string' || !e.name || !capOk(e.capacity) || !obj(e.capacities)) return false;
      if (Object.entries(e.capacities).some(([w, c]) => !isMonday(w) || !capOk(c))) return false;
    }
    const taskIds = new Set();
    let maxN = 0;
    for (const t of s.tasks) {
      if (!obj(t) || typeof t.id !== 'string' || !TASK_ID_RE.test(t.id) || taskIds.has(t.id)) return false;
      taskIds.add(t.id);
      maxN = Math.max(maxN, +t.id.slice(5));
      if (typeof t.hours !== 'number') return false;
      if (t.assignee !== null && !ids.has(t.assignee)) return false;
      if (typeof t.description !== 'string' || typeof t.title !== 'string') return false;
      validateTask(t, s.employees);
    }
    return s.nextId > maxN;
  } catch { return false; }
}

// Жадное распределение: крупные задачи первыми, тому, у кого наибольший остаток.
export function proposePlan(state, week) {
  const rest = new Map(state.employees.map((e) => [e.id, capacityFor(e, week)]));
  const tasks = state.tasks.filter((t) => t.week === week && isActive(t))
    .sort((a, b) => b.hours - a.hours || a.id.localeCompare(b.id));
  const assignments = [];
  let unassignedHours = 0;
  for (const t of tasks) {
    let best = null;
    for (const e of state.employees) {
      const r = rest.get(e.id);
      if (r >= t.hours && (best === null || r > rest.get(best))) best = e.id;
    }
    if (best) rest.set(best, rest.get(best) - t.hours); else unassignedHours += t.hours;
    assignments.push({ taskId: t.id, assignee: best });
  }
  return { assignments, unassignedHours };
}

export function applyPlan(state, plan) {
  const next = structuredClone(state);
  const map = new Map(plan.assignments.map((a) => [a.taskId, a.assignee]));
  for (const t of next.tasks) if (isActive(t) && map.has(t.id)) t.assignee = map.get(t.id);
  return next;
}
