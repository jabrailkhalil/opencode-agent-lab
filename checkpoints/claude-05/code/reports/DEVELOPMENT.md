# DEVELOPMENT: «Поток» — отчёт разработчика

## Файлы
- `dist/domain.js` — чистая доменная логика (ES-модуль, без DOM).
- `dist/index.html` — разметка, подключает `vendor/tabler/tabler.min.css`, `styles.css`, `app.js` (type=module).
- `dist/styles.css` — токены, адаптивная раскладка (390/768/1100/1280), форма-модалка, стек таблиц на узких экранах.
- `dist/app.js` — состояние, localStorage, рендер, события, drag-and-drop, форма, план.
- Служебные: `scratch/css.mjs`, `scratch/dnd.mjs`, `scratch/layout.mjs`, `scratch/domain-check.mjs` (диагностика, не часть приложения).
Не менялись: tests, docs, scripts, vendor.

## Функции domain.js
`DEMO_WEEK`, `seedState` (встроенная копия seed, сверена с `docs/seed-state.json` через deepEqual), `monday` (UTC-арифметика), `addDays`, `isMonday`, `isIsoDate`, `capacityFor`, `loadFor`, `validateTask` (бросает Error с `errors[{field,message}]`), `proposePlan` (перебор с ветвлением и отсечением, максимизирует назначенные часы, затем число сохранённых назначений; лимит узлов 400000; в `assignments` все активные задачи недели, не поместившиеся получают явное `assignee:null`), `applyPlan` (новое состояние, пропускает done и отсутствующие задачи, `null` снимает старое назначение), `isValidState`.

## Функции app.js (основные)
`loadState/saveState` (ключ `potok.state.v1`, try/catch, откат к seed + `storage-notice`), `renderAll/renderWeek/renderMetrics/renderTeam/renderControls/renderView/renderBoard/renderEmployeesView/renderPlan`, `commitCapacity`, `openForm/closeForm/submitForm/showFormErrors` (прикладная валидация, форма `novalidate`, ошибки в `task-error` и у полей, значения не сбрасываются, фокус-ловушка, Esc), `deleteTask`, `moveTask`, `resetDemo` (native `confirm`), `proposeClick/applyClick/cancelPlan/resetPlan`, `setWeek`, HTML5 drag-and-drop на `column-*`.
Тестовые id только у активного представления (скрытое очищается и теряет `board`/`employees-view` testid); `employee-*`, `load-*`, `progress-*`, `capacity-*` — всегда в блоке «Загрузка команды».

## Найденные дефекты и причины
1. QA-08b (drag-and-drop): `dragstart` не срабатывал. Причина: цель `column-done` (+450 px от её верха) была ниже окна 900 px, Playwright прокручивал страницу между mousedown и mousemove, Chromium заново hit-тестил точку нажатия и попадал в другую карточку. Исправление: на ≥1100 px метрики и загрузка команды вынесены в боковую колонку (CSS grid, порядок DOM не изменён), доска начинается выше, и перетаскивание не требует прокрутки. Попутно задан `grid-template-rows: auto auto auto auto 1fr`, чтобы сквозной блок боковой колонки не растягивал пустую строку плана.
2. 404 favicon в консоли — добавлен `<link rel="icon" href="data:,">`.

## Отклонения от DESIGN-PLAN
- На ≥1100 px порядок визуально отличается (боковая колонка), на меньших ширинах порядок как в плане. Причина — п.1 выше.
- Подтверждения удаления/восстановления — нативный `confirm()` (verify.mjs принимает диалоги и не нажимает кнопки собственных модалок).
- Поле доступности принимает шаг 0,5.

## Фактические проверки
- `node --check dist/app.js` — без вывода (OK).
- `node --check dist/domain.js` — без вывода (OK).
- `node --test tests/acceptance.test.mjs` — tests 9, pass 9, fail 0.
- `node scripts/verify.mjs` — `{"summary":"PASS","native":{"exitCode":0,"passed":9,"failed":0,"tests":9},"browserPassed":19,"browserFailed":0,"total":19}`; отчёт в `reports/host-verification.json`.
- `node scratch/layout.mjs`: на 390/768/1100/1280 `scrollWidth == ширина окна`, `load-anna` = «32 / 24 ч · 133%», `progress-maria` = «43% · 6 из 14 ч», NaN/Infinity/undefined/null в тексте нет.
- `node scratch/domain-check.mjs`: seedState совпадает с seed; план на 47 активных задач за 23 мс без перегрузки.

## Не проверялось
Ручной просмотр скриншотов, DOM-ревью с `getBoundingClientRect` по всем элементам, клавиатурная фокус-ловушка в реальном браузере (реализована, автоматически не прогонялась), сценарий недоступного localStorage.
