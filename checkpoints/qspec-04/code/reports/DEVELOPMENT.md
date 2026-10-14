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
