# DEVELOPMENT — build-tracker (роль: developer)

Реализован весь трекер «Поток» с нуля по docs/BRIEF.md, INTERFACES.md,
seed-state.json, reports/DESIGN-PLAN.md и openspec/changes/build-tracker.

## Артефакты

- dist/domain.js — DEMO_WEEK, seedState (копия seed, structuredClone),
  monday (Date.UTC, без поясов), loadFor (capacity=capacities[week] ?? capacity,
  percent=null при 0, progress=0 при нуле знаменателя, Math.round),
  validateTask (trim, 1–140, ≤1000, 0.5–168 шаг 0.5, assignee id|null,
  статус, понедельник; копия без мутации), proposePlan (жадно: часы DESC → id,
  максимум остатка доступности; неприместившиеся → null; без мутации),
  applyPlan (новое состояние), isValidState (схема, уникальные id, nextId ≥ 110).
- dist/index.html — локальный Tabler, метрики недели, search/filter-assignee,
  board (column-todo/doing/done), employees-view, инлайн task-form,
  модал plan-preview; все data-testid контракта.
- dist/app.js — рендер из состояния; CRUD, edit-*/delete-* (удаление с
  подтверждением), drag-and-drop + смена статуса формой, недели ±7 (prev/next,
  current-week), capacity-<id> 0–168 с сохранением change/blur, предпросмотр
  плана «было/стало» с plan-apply/plan-cancel, localStorage potok.state.v1:
  запись после каждого изменения, чтение с isValidState и фолбэком на seed с
  уведомлением, reset-demo после confirm.
- dist/styles.css — палитра брифа; board стопкой ≤768, load/progress двумя
  независимыми подписанными блоками, «—» при null, word-break, focus-visible,
  без скрытых показателей; кнопки действий полной строкой без сетки 4-в-ряд.

## Проверки (фактически выполнено)

- node --check dist/domain.js, node --check dist/app.js — чисто.
- node --test tests/acceptance.test.mjs — 9/9 зелёные (дважды, до и после UI).
- scratch/verify.mjs: testid-контракт найден в index.html/app.js; метрики seed
  из данных: anna 32/24 · 133% · +8 · progress 0; dmitry 14/32 · 44%;
  maria 8/24 · 33% · progress 43; ilya 12/24 · 50% · progress 25;
  всего 9 задач / 80 ч; активных 7 / 70 ч — совпадает с брифом.
- scratch/sel.mjs: все селекторы app.js существуют в разметке;
  scratch/html.mjs: теги сбалансированы, реальных дублей id нет.

## Ограничения прогона

- Браузер не запускался: визуальная проверка раскладки на 390/768/1100/1280
  НЕ заявлена (tasks 3.2 оставлен открытым); адаптивность обеспечена стилями
  и статическим ревью, но требует DOM-прогона тестировщиком.
- docs, tests/acceptance.test.mjs, dist/vendor не менялись.

## Исправления по передаче QA (13.10.2026, роль: developer)

Прочитан заполненный reports/QA-RESULTS.md. Визуальные наблюдения — оператора/QA,
браузер в этом прогоне НЕ запускался, «сам видел» не заявляется. Исправлены
подтверждённые дефекты; acceptance-тесты и dist/vendor не тронуты.

Причины и правки:

1.isValidState (хранилище) — `domain.js:121–133` проверял значения через `Number()`
   (коэрция) и без типа/ключа: принимал часы «16» (строку), дробь вне шага, базовую
   capacity −1/169/«24» и ключ `capacities.broken=24`. Добавлены хелперы `isHours`
   (настоящий `typeof number`, конечность, диапазон, шаг 0,5 через `Number.isInteger(v*2)`)
   и `isWeekKey` (`YYYY-MM-DD` и `monday(k)===k`). Часы задач: 0.5–168; capacity и
   capacities[]: 0–168; ключи capacities — только понедельники. Seed и сериализованный
   seed по-прежнему валидны (проверено scratch/store.mjs и `node --test`).
   Сценарий для spec.md delta (файл вне прав прогона, зафиксирован здесь):
   «Повреждённые данные в хранилище отклоняются»: WHEN часы «16»/7.3, capacity
   −1/169/«24» или ключ capacities.broken/непонедельник → THEN isValidState=false,
   старт на seedState() без падения.

2. Пустая доступность писала 0 — `app.js:290–291`: `Number('')`=0 и `isFinite(0)`=true,
   ветка возврата прежнего значения недостижима → capacity Анны 24→0, доступность
   команды 104→80, перегрузка 8→32 (цифры оператора сходятся). `onCapacity` переписан:
   пустое/некорректное значение → прежнее (`loadFor().capacity`) возвращается в поле,
   состояние/`localStorage` НЕ изменяются, рядом показывается `.capacity-error`
   («Нужно число 0–168 с шагом 0,5. Прежнее значение сохранено.»). Флаг `ptRestored`
   гасит повтор blur-после-change, чтобы сообщение не затиралось; `input` снимает его
   при новом наборе. Сценарий для spec.md delta:
   «Пустой или некорректный ввод доступности»: WHEN capacity-anna очищено/«abc»/−1/169/7.3
   и потерян фокус → THEN capacities[недели] не изменилось, поле откатано к прежнему,
   рядом видна ошибка, load-anna не меняется.

3. Контраст активной кнопки — `app.js:66–67` вешает `btn-primary` (синий фон) и
   `aria-pressed=true`, а старый `styles.css:61` красил текст в `--pt-accent` #206bc4 →
   ровно accent-on-accent (≈1:1, WCAG 1.4.3). Заменено на читаемое активное состояние:
   залитый акцент + белый текст (~5.5:1) и нейтральное неактивное; правка только CSS,
   DOM-контракт и `renderHeader` не менялись.

4. Спокойная иерархия (только локальные CSS): компактные ghost-кнопки карточек с тонкой
   верхней разделительной линией; приглушённые чипы задач; drag-over без жёлтого
   свечения (рамка + лёгкий фон); единый радиус 8px и согласованные отступы колонок/карт.
   Формулы домена и структура DOM не тронуты.

Прогон: `node --test tests/acceptance.test.mjs` → 9/9 зелёные (см. ниже). Общий прогон
`node --test tests/*` → 22/23: единственный красный — `agent-ui.test.mjs:22` (собственная
assertion-строка тестировщика про composed-testid; элементы собираются шаблонами
`employee-${…}`, в разметке присутствуют). Правка тестов вне прав разработчика — не менял.
Не закрыто этим прогоном: потеря фокуса из-за полного `render()` в `#employees-view`,
ARIA `role=tablist` без `role=tab`, общие ссылки в `applyPlan` — это статические находки
QA, не браузерные дефекты и не входили в задание.
