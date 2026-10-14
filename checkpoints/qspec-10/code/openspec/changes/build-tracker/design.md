# Design: build-tracker

## Context

Статическое SPA без сборки: `dist/index.html` подключает локальный
`vendor/tabler/tabler.min.css`, `styles.css`, `app.js`; домен — ES-модуль
`domain.js` (импортируется и тестами, и приложением). Хранилище — localStorage.

## Decisions

- Состояние: `{version:1, employees[], tasks[], nextId, ui}`; `ui.view/week` —
  только в localStorage, не часть доменных инвариантов. Ключ `potok.state.v1`.
- Недели: ISO-строки `YYYY-MM-DD` (понедельник). `monday(date)` — через
  `Date.parse` + `Date.UTC`, сдвиг `dow = (getUTCDay()+6)%7`, без локального
  часового пояса.
- Нагрузка (`loadFor`): задачи сотрудника за неделю → `tasks`; `active` =
  status!=='done'; `hours` = Σ active; `capacity` = capacities[week] ?? capacity;
  `percent` = capacity>0 ? Math.round(hours/capacity*100) : null;
  `overload` = Math.max(0, hours-capacity); `progress` = totalHours>0 ?
  Math.round(doneHours/totalHours*100) : 0.
- `proposePlan`: только активные задачи данной недели. Жадно: сортировка по
  hours DESC, затем id; для каждой — сотрудник с достаточным остатком capacity,
  выбирается максимальный остаток (balance-friendly); итог — `assignments` и
  `unassignedHours` = Σ часов non-fit задач. Вход не мутируется (клон), остальные
  активные задачи становятся `assignee=null`; done и чужие недели не меняются.
  Проверка на seed-сценариях: все 104 чcapacity вмещают 70 ч; при 16 ч (dmitry)
  помещается 16 ч, unassignedHours=54 (например TASK-101+102 не берутся, dmitry
  берёт набор ≤16).
- `applyPlan`: клон state + назначения; возврат нового объекта.
- `validateTask`: нормализация trim, число через Number, шаг 0.5
  (`hours*2` — целое), границы 0.5–168; throw Error с русским сообщением по полю.
- `isValidState`: схема полей, уникальность id, `nextId` — целое ≥ 110.
- UI: единый `render()` из state; drag-and-drop через HTML5 (dragstart/drop на
  column-*), статус дублируется select в форме; форма — инлайн-панель, ошибки
  в `task-error` внутри формы без сброса значений; предпросмотр плана — модалка
  plan-preview, кнопки plan-apply / plan-cancel; reset-demo — `window.confirm`.
- Деструктурированный JSON в localStorage → `isValidState` false → seedState().

## UI-решения (уточнены дизайнером, детали в reports/DESIGN-PLAN.md)

- Каркас: navbar → page-header «План команды» + prev-week/current-week/
  next-week → tabs view-board/view-employees → строка действий → метрики
  недели → board | employees-view → task-form → plan-preview.
- Боковой панели нет; длинные кнопки действий (new-task, propose-plan,
  reset-demo) — `d-flex flex-wrap gap-2` полной строкой, на ≤768 вертикально,
  без truncate и без сетки «четыре колонки рядом с sidebar». Сетка col-6/
  col-lg-3 допустима только для цифровых карточек метрик.
- Палитра Tabler: фон #f6f7f9, текст #182433, границы #e6e8ec, акцент #206bc4,
  ошибка #d63939, успех #2fb344; focus-visible по акценту.
- Нагрузка и прогресс — два отдельных подписанных блока в employee-<id>:
  load-<id> («32/24 ч», «133%», «перегрузка +8 ч») и progress-<id> («43%»,
  «выполнено 6 из 14 ч»); в одном баре не смешивать; percent=null → «—» +
  «нет доступных часов».
- Метрики недели считаются по всем задачам; поиск/фильтр их не пересчитывают
  (соответствует сценариям спеки).
- Пустые состояния: колонка канбана «Нет задач» (drop-зона сохраняется),
  employees-view «На этой неделе задач нет» + new-task, пустой поиск —
  подсказка сброса.
- plan-preview: «было/стало» по сотрудникам, список задач без ответственного,
  unassignedHours, подпись «предпросмотр не меняет план»; план меняется только
  по plan-apply.
- Брейкпоинты: 390 — одна колонка, board вертикально, capacity-поля и
  load/progress — стопкой; 768 — board 3 колонки, форма 2 колонки; 1100/1280 —
  контейнер ≤1200, полная employees-таблица. Никакого горизонтального
  переполнения, load-*/progress-* не скрываются ни на одной ширине.

## Risks / Trade-offs

- Жадный алгоритм не оптимален теоретически, но детерминирован и проходит
  зафиксированные тесты; компактность важнее оптимальности.
- confirm() вместо модалки Tabler — допустимо контрактом («сам контроллер умеет
  нажать подтверждение»); при проблемах — своя модалка с кнопкой.
- Округление Math.round кратно тестам (32/24→133, 6/14→43).
