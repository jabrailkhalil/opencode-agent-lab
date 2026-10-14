# Публичный интерфейс для одинаковых приёмочных проверок

В dist/domain.js экспортировать DEMO_WEEK='2026-09-28', seedState(), monday(date), loadFor(state, employeeId, week), validateTask(task, employees), proposePlan(state, week), applyPlan(state, plan), isValidState(state).

seedState() возвращает отдельную копию данных docs/seed-state.json. monday возвращает понедельник YYYY-MM-DD, расчёт не зависит от часового пояса.
loadFor возвращает {tasks, active, hours, capacity, totalHours, doneHours, overload, percent, progress}. capacity — employees[].capacities[week] при наличии, иначе capacity. percent = null при нулевой доступности; progress = 0 при отсутствии назначенных часов. Округлять проценты Math.round.
validateTask возвращает нормализованную копию или бросает Error. Проверить поля по постановке, trim названия/описания; не мутировать вход.
proposePlan возвращает {assignments:[{taskId,assignee}],unassignedHours}, не мутирует state. Алгоритм распределения можно выбрать самостоятельно, соблюдая ограничения и сохранение задач.
applyPlan возвращает новое состояние, применяя предложенные назначения активных задач. isValidState принимает корректно сериализованный seed, отклоняет дубли IDs, неправильные поля и nextId < 110.

tests/acceptance.test.mjs — девять заранее зафиксированных независимых проверок. Разработчик и тестировщик не имеют права их менять. Тестировщик может добавлять tests/agent-*.test.mjs.

## Контракт UI для повторяемых браузерных действий

Добавить data-testid к реальным элементам:
- app — корневой контейнер после загрузки; employee-anna/dmitry/maria/ilya — строки/карточки; load-anna и т.д., progress-maria и т.д. — значения с подписями.
- new-task, task-form, task-title, task-description, task-hours, task-assignee, task-status, task-week, task-save, task-cancel, task-error.
- task-TASK-101 и т.д. — карточки; edit-TASK-101, delete-TASK-101 — реальные кнопки изменения и удаления. task-assignee — select со значениями employee.id и пустым значением для null; task-status — select todo/doing/done.
- search, filter-assignee (select employee.id; пустое — все), prev-week, next-week, current-week.
- view-board, view-employees, board, employees-view; column-todo/doing/done — зоны drag-and-drop.
- capacity-anna/dmitry/maria/ilya — поля недельной доступности; сохранять на change/blur.
- propose-plan, plan-preview, plan-apply, plan-cancel, reset-demo.

Поля с testid task-title/hours/week — input; task-description — textarea; для пустого названия должна срабатывать прикладная trim-валидация, независимо от HTML required. Модальные подтверждения допускаются, сам контроллер умеет нажать подтверждение.
