# DEVELOPMENT — «Поток» (роль: developer)

Реализован весь трекер с нуля по docs/BRIEF.md, docs/INTERFACES.md, отчётам ANALYSIS/DESIGN-PLAN и данным docs/seed-state.json. Использованы только локальный Tabler (dist/vendor, не трогал) и свои файлы.

## Созданные файлы
- `dist/domain.js` — чистая логика: DEMO_WEEK, seedState, monday, addDays, capacityFor, loadFor, validateTask, proposePlan, applyPlan, isValidState (+ STATUSES/STATUS_LABELS). Формулы и алгоритмы — строго ANALYSIS §1–§3 (LPT без аффинитета, UTC-понедельник, percent=null при нулевой доступности, округление Math.round).
- `dist/app.js` — контроллер UI: состояние + localStorage, рендер метрик/доски/сотрудников, форма с trim-валидацией и показом ошибок без сброса значений, drag-and-drop статусов, предпросмотр распределения с явным применением, кастомные подтверждения удаления и сброса демо, недельная навигация.
- `dist/index.html` — семантический каркас с модальными окнами (задача, предпросмотр, подтверждение); подключены vendor CSS и styles.css; скрипт `type=module`.
- `dist/styles.css` — адаптивная сетка (4 колонки метрик → 2 → 1; доска 3 → 1; карточки сотрудников), палитра DESIGN-REFERENCE, overlay-модалки, переносы слов, кнопки ≥44 px на мобильной ширине.
- `scratch/check-testids.mjs` — вспомогательная статическая сверка контракта testid.

## Соответствие 11 пунктам брифа
1. CRUD задач; поля название/описание/ответственный (или «Без ответственного»)/часы/статус/неделя — форма task-form.
2. todo/doing/done («Новая», «В работе», «Готово»); доска column-todo/doing/done с drag-and-drop; смена статуса и через select формы.
3. Двойное представление view-board/view-employees из одних данных.
4. search (название+описание) и filter-assignee; недельные метрики и loadFor считаются по полным данным недели.
5. prev-week/next-week; старт DEMO_WEEK='2026-09-28'; недели независимы (фильтр по t.week).
6. capacity-anna/dmitry/maria/ilya — 0…168 на текущую неделю (capacities[week]); нагрузка — по незавершённым; done только в прогрессе.
7. Загрузка hours/capacity + процент + «Перегрузка +N ч»; прогресс doneHours/totalHours; нулевые знаменатели: percent=null («—»), progress=0 — без NaN/Infinity.
8. propose-plan → plan-preview (не трогает state), plan-cancel, plan-apply — единственная точка записи; сверх доступности не назначает; непоместившиеся остаются без ответственного; done/чужие недели/состав/суммы часов сохраняются; apply отключён при «Изменений нет».
9. localStorage ключ potok-v1-state; повреждённые/чужие данные → isValidState/fallback на seed без падения; reset-demo только после подтверждения (confirm-ok).
10. validateTask: trim-название 1–140, описание ≤1000, часы 0.5–168 шаг 0.5, существующий ответственный или null, допустимый статус, неделя — понедельник; все ошибки в task-error внутри формы, значения сохраняются, фокус на первое проблемное поле.
11. Адаптив на 390/768/1100/1280: grid-перестройки, flex-wrap, overflow-wrap, overflow-x: clip; подписанные load-*/progress-* у каждого сотрудника; label+for везде; клавиатура (Tab, Escape закрывает модалки); единый Tabler-стиль.

## Проверки (фактические запуски)
- `node --check dist/domain.js` — OK.
- `node --check dist/app.js` — OK.
- `node --test tests/*` — 9/9 pass (все acceptance-тесты зелёные, включая 133%/+8 ч, 54 ч unassigned, отсутствие NaN).
- `node scratch/check-testids.mjs` — MISSING static: none; все динамические шаблоны (task-*/edit-*/delete-*/employee-*/load-*/progress-*/capacity-*/column-*) присутствуют; id сотрудников anna,dmitry,maria,ilya покрыты.
- Итоговый повторный прогон после последних правок — см. ниже.

## Ограничения
- Визуальная браузерная проверка (переполнения на 390/768/1100/1280, DOM-ревью) в этом прогоне не выполнялась — браузер не запускался; адаптивность обеспечена декларативно CSS-сетками, но не подтверждена в браузере.
- Исходные docs, tests/acceptance.test.mjs и dist/vendor не изменялись.
