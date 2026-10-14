// Предметная логика «Потока»: без DOM, без побочных эффектов.
export const DEMO_WEEK = '2026-09-28';
export const STATUSES = { todo: 'Новая', doing: 'В работе', done: 'Готово' };

const E = (id, name, initials, role, color, capacity) => ({ id, name, initials, role, color, capacity, capacities: {} });
const T = (n, title, description, assignee, hours, status) =>
  ({ id: `TASK-${n}`, title, description, assignee, hours, status, week: DEMO_WEEK });

export function seedState() {
  return {
    version: 1,
    employees: [
      E('anna', 'Анна Смирнова', 'АС', 'Разработка', '#5468d3', 24),
      E('dmitry', 'Дмитрий Волков', 'ДВ', 'Разработка', '#007d87', 32),
      E('maria', 'Мария Орлова', 'МО', 'Аналитика', '#a25a23', 24),
      E('ilya', 'Илья Соколов', 'ИС', 'Тестирование', '#a34e88', 24),
    ],
    tasks: [
      T(101, 'Обновить форму заявки', 'Добавить выбор типа ресурса и понятные подсказки.', 'anna', 16, 'doing'),
      T(102, 'Подключить витрину метрик', 'Показать основные показатели на странице команды.', 'anna', 16, 'todo'),
      T(103, 'Добавить фильтры в реестр', 'Фильтрация по статусу и ответственному.', 'dmitry', 8, 'doing'),
      T(104, 'Исправить выгрузку отчёта', 'Сохранить порядок столбцов и заголовки.', 'dmitry', 6, 'todo'),
      T(105, 'Описать правила согласования', 'Зафиксировать переходы статусов и критерии приёмки.', 'maria', 8, 'doing'),
      T(106, 'Проверить сценарии заявок', 'Проверить создание, редактирование и завершение заявки.', 'ilya', 12, 'todo'),
      T(107, 'Подготовить тестовые данные', 'Набор вымышленных заявок для демонстрации.', 'ilya', 4, 'done'),
      T(108, 'Согласовать поля заявки', 'Названия, обязательность и ограничения полей.', 'maria', 6, 'done'),
      T(109, 'Добавить подсказки на доске', 'Короткие пояснения статусов задач.', null, 4, 'todo'),
    ],
    nextId: 110,
  };
}

// ---- Даты (UTC, без зависимости от часового пояса) ----
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function parseDate(s) {
  const m = DATE_RE.exec(String(s));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
}
const fmt = (d) => d.toISOString().slice(0, 10);
export const isDate = (s) => parseDate(s) !== null;

export function monday(date) {
  const d = parseDate(date);
  if (!d) throw new Error('Неверная дата');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return fmt(d);
}
export function addDays(date, n) {
  const d = parseDate(date);
  if (!d) throw new Error('Неверная дата');
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}
export const isMonday = (s) => isDate(s) && monday(s) === s;

// ---- Нагрузка ----
export function capacityOf(emp, week) {
  const v = emp && emp.capacities && emp.capacities[week];
  return typeof v === 'number' && Number.isFinite(v) ? v : emp ? emp.capacity : 0;
}

export function loadFor(state, employeeId, week) {
  const emp = state.employees.find((e) => e.id === employeeId);
  const tasks = state.tasks.filter((t) => t.assignee === employeeId && t.week === week);
  const act = tasks.filter((t) => t.status !== 'done');
  const sum = (a) => a.reduce((s, t) => s + t.hours, 0);
  const hours = sum(act), capacity = capacityOf(emp, week);
  const totalHours = sum(tasks), doneHours = totalHours - hours;
  return {
    tasks, active: act.length, hours, capacity, totalHours, doneHours,
    overload: Math.max(0, hours - capacity),
    percent: capacity > 0 ? Math.round((hours / capacity) * 100) : null,
    progress: totalHours > 0 ? Math.round((doneHours / totalHours) * 100) : 0,
  };
}

// ---- Валидация ----
function fail(field, msg) {
  const e = new Error(msg);
  e.field = field;
  return e;
}
const okHours = (h) => typeof h === 'number' && Number.isFinite(h) && h >= 0.5 && h <= 168 && Number.isInteger(h * 2);

export function validateTask(task, employees) {
  if (!task || typeof task !== 'object') throw fail('title', 'Задача: неверные данные');
  const title = typeof task.title === 'string' ? task.title.trim() : '';
  if (title.length < 1 || title.length > 140) throw fail('title', 'Название: от 1 до 140 символов');
  const desc = task.description == null ? '' : task.description;
  if (typeof desc !== 'string' || desc.trim().length > 1000) throw fail('description', 'Описание: не более 1000 символов');
  if (!okHours(task.hours)) throw fail('hours', 'Оценка: от 0,5 до 168 часов с шагом 0,5');
  const assignee = task.assignee === '' || task.assignee == null ? null : task.assignee;
  if (assignee !== null && !(employees || []).some((e) => e.id === assignee))
    throw fail('assignee', 'Ответственный: выберите сотрудника из списка или «Без ответственного»');
  if (!Object.hasOwn(STATUSES, task.status)) throw fail('status', 'Статус: выберите Новая, В работе или Готово');
  if (!isMonday(task.week)) throw fail('week', 'Неделя: укажите дату понедельника (ГГГГ-ММ-ДД)');
  return { ...task, title, description: desc.trim(), assignee, hours: task.hours, status: task.status, week: task.week };
}

// ---- Распределение ----
// Жадно: крупные задачи первыми; текущий ответственный сохраняется, если помещается,
// иначе — сотрудник с наибольшим остатком, куда задача влезает; иначе без ответственного.
export function proposePlan(state, week) {
  const left = new Map(state.employees.map((e) => [e.id, capacityOf(e, week)]));
  const tasks = state.tasks
    .filter((t) => t.week === week && t.status !== 'done')
    .map((t, i) => ({ t, i }))
    .sort((a, b) => b.t.hours - a.t.hours || a.i - b.i);
  const assignments = [];
  let unassignedHours = 0;
  for (const { t } of tasks) {
    let pick = t.assignee && left.has(t.assignee) && left.get(t.assignee) >= t.hours ? t.assignee : null;
    if (!pick) {
      let best = -1;
      for (const [id, rest] of left) if (rest >= t.hours && rest > best) { best = rest; pick = id; }
    }
    if (pick) left.set(pick, left.get(pick) - t.hours);
    else unassignedHours += t.hours;
    assignments.push({ taskId: t.id, assignee: pick });
  }
  const order = new Map(state.tasks.map((t, i) => [t.id, i]));
  assignments.sort((a, b) => order.get(a.taskId) - order.get(b.taskId));
  return { assignments, unassignedHours };
}

export function applyPlan(state, plan) {
  const map = new Map(plan.assignments.map((a) => [a.taskId, a.assignee]));
  const next = structuredClone(state);
  for (const t of next.tasks) if (t.status !== 'done' && map.has(t.id)) t.assignee = map.get(t.id);
  return next;
}

// ---- Проверка сохранённого состояния ----
const isStr = (v) => typeof v === 'string' && v.length > 0;
const okCap = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 168;

export function isValidState(s) {
  try {
    if (!s || typeof s !== 'object' || s.version !== 1) return false;
    if (!Array.isArray(s.employees) || !s.employees.length || !Array.isArray(s.tasks)) return false;
    const ids = new Set();
    for (const e of s.employees) {
      if (!e || !isStr(e.id) || ids.has(e.id) || !isStr(e.name) || !okCap(e.capacity)) return false;
      if (!e.capacities || typeof e.capacities !== 'object' || Array.isArray(e.capacities)) return false;
      for (const [w, v] of Object.entries(e.capacities)) if (!isMonday(w) || !okCap(v)) return false;
      ids.add(e.id);
    }
    const taskIds = new Set();
    let max = 0;
    for (const t of s.tasks) {
      const m = t && typeof t.id === 'string' && /^TASK-(\d+)$/.exec(t.id);
      if (!m || taskIds.has(t.id)) return false;
      taskIds.add(t.id);
      max = Math.max(max, +m[1]);
      if (typeof t.title !== 'string' || t.title !== t.title.trim()) return false;
      validateTask(t, s.employees);
    }
    return Number.isInteger(s.nextId) && s.nextId >= 110 && s.nextId > max;
  } catch {
    return false;
  }
}
