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
  column-*); форма — инлайн-панель, ошибки в `task-error`, значения не сбрасываются;
  предпросмотр плана — модалка preview (список assignments), кнопки plan-apply /
  plan-cancel; reset-demo — через `window.confirm`.
- Деструктурированный JSON в localStorage → `isValidState` false → seedState().

## Risks / Trade-offs

- Жадный алгоритм не оптимален теоретически, но детерминирован и проходит
  зафиксированные тесты; компактность важнее оптимальности.
- confirm() вместо модалки Tabler — допустимо контрактом («сам контроллер умеет
  нажать подтверждение»); при проблемах — своя модалка с кнопкой.
- Округление Math.round кратно тестам (32/24→133, 6/14→43).
