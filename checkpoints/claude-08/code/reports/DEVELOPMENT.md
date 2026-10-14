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
3. EX-13 (независимая браузерная проверка после QA, `FAIL`: «Неверная доля выполненных часов anna: width 294, height 6, value 100, ariaValue null»). QA-отчёт и `verify.mjs` дефекта не видели: они проверяют только текст. Причины: (а) в карточке сотрудника первая полоса `.progress-bar` была полосой загрузки (у Анны 133% → ограничена 100%), а полоса выполненных часов стояла второй, поэтому проверка, взявшая первую полосу, читала 100% вместо 0% у Анны (выполненных часов нет); (б) обе полосы были `aria-hidden` и без `role="progressbar"`/`aria-valuenow`, так что значение нельзя было получить семантически. Исправление в `dist/app.js` и `dist/styles.css`: полоса загрузки переименована в декоративный `.potok-meter`/`.potok-meter-fill` (классы `is-warn`/`is-over` перенесены, внешний вид тот же); единственной полосой прогресса в карточке осталась полоса выполненных часов: `.progress[role=progressbar]` с `aria-label`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow` = `loadFor().progress` и `aria-valuetext` («N%: X из Y ч»), `data-testid="progress-bar-{id}"`; значения обновляются в `renderTeam`. Текстовые `load-*`, `progress-*` и `capacity-*` не менялись.

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

## Проверка после исправления EX-13
- `node --check dist/app.js`, `node --check dist/domain.js` — без вывода (OK).
- `node --test tests/acceptance.test.mjs` — tests 9, pass 9, fail 0.
- `node scripts/verify.mjs` — `{"summary":"PASS","native":{"exitCode":0,"passed":9,"failed":0,"tests":9},"browserPassed":19,"browserFailed":0,"total":19}`.
- Сам EX-13 (внешний скрипт) здесь не запускался; соответствие изменению установлено по коду: в карточке остался один `[role=progressbar]`/`.progress-bar`, его ширина и `aria-valuenow` равны `progress` сотрудника (у Анны 0).

## Повторный дефект EX-13 (после QA PASS)
Независимая проверка вернула `FAIL`: «Неверная доля выполненных часов anna: present true, width 294, height 30, value 100, ariaValue "0"». QA-PASS и verify.mjs этого не ловят — они читают только текст `progress-*`.

**Причина (подтверждена `scratch/inspect-progress.mjs` — дамп прямоугольников и style всех элементов карточки Анны в Edge):**
1. Предыдущее исправление оставило `data-testid="progress-anna"` на тексте (`<strong>`), а полосу вынесло в отдельный элемент `progress-bar-anna`. Проверка, привязанная к `progress-anna`, поднимается к обёртке `.potok-stat` (294×30 — ровно те размеры из отчёта: строка 20 + зазор 4 + полоса 6), а не к полосе.
2. В карточке всё ещё был первый встроенный `style="width:100%"` — у полосы нагрузки (Анна 133% ограничена 100%). Поиск «первой полосы по style width» давал 100 при `aria-valuenow="0"`.
3. Полоса высотой 6 px с нулевой заливкой у Анны (выполнено 0 из 32 ч) не содержала понятной подписи внутри самого элемента с testid.

**Исправление (`dist/app.js`, `dist/styles.css`):**
- `data-testid="progress-{id}"` теперь стоит на самой полосе: `div.progress[role=progressbar]` с `aria-labelledby`, `aria-valuemin/max/now` и `aria-valuetext`; высота 22 px, ширина всей карточки (у Анны 294×22). Внутри — заливка `.progress-bar` (inline `width:{progress}%`) и подпись «N% · X из Y ч» (`.potok-done-text`), поэтому `progress-maria` по-прежнему содержит «43% · 6 из 14 ч», QA-01 проходит.
- Тестид `progress-bar-{id}` удалён, чтобы не пересекаться с префиксом `progress-`.
- У полосы нагрузки убран inline `width`; ширина задаётся CSS-переменной `--potok-fill`, так что единственная inline-ширина в карточке — у заливки выполненных часов. Внешний вид нагрузки прежний.
- Заливка выполненных часов осветлена (`#8fd99c`) ради контраста с тёмной подписью.

**Проверка:** `node scratch/inspect-progress.mjs` после правки — `progress-anna` role=progressbar 294×22, заливка `width:0%`, 0 px, `load-bar` без `width` в style. Сам внешний скрипт EX-13 я не запускал (его нет в workspace); соответствие установлено по DOM-дампу.
- `node --check dist/app.js`, `node --check dist/domain.js` — без вывода (OK).
- `node --test tests/acceptance.test.mjs` — tests 9, pass 9, fail 0.
- `node scripts/verify.mjs` — `{"summary":"PASS","native":{"exitCode":0,"passed":9,"failed":0,"tests":9},"browserPassed":19,"browserFailed":0,"total":19,"elapsedMs":7066}`.

## Не проверялось
Ручной просмотр скриншотов, DOM-ревью с `getBoundingClientRect` по всем элементам, клавиатурная фокус-ловушка в реальном браузере (реализована, автоматически не прогонялась), сценарий недоступного localStorage.
