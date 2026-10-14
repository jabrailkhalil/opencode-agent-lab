# Tracker Spec (delta)

## ADDED Requirements

### Requirement: CRUD задач
Система MUST поддерживать создание, просмотр, редактирование и удаление задач с полями: название,
описание, ответственный или «Без ответственного», оценка в часах, статус todo/doing/done, неделя.

#### Scenario: Создание задачи
- **WHEN** пользователь заполняет task-form валидными значениями и нажимает task-save
- **THEN** задача появляется в текущей неделе и в localStorage, id вида TASK-<nextId>

#### Scenario: Удаление задачи
- **WHEN** пользователь нажимает delete-TASK-101 и подтверждает действие
- **THEN** задача исчезает из обоих представлений, метрики недели пересчитаны

### Requirement: Доска и drag-and-drop
Система MUST показывать доску из трёх колонок column-todo/doing/done со сменой статуса
перетаскиванием и через форму; переключение view-board/view-employees использует те же данные.

#### Scenario: Перенос карточки
- **WHEN** карточка task-TASK-103 перенесена из column-todo в column-doing
- **THEN** status задачи = doing, в представлении по сотрудникам та же карточка

### Requirement: Поиск и фильтр
Поиск по названию/описанию (search) и фильтр по ответственному (filter-assignee)
MUST скрывать только карточки; недельная нагрузка и прогресс MUST считаться по всем
задачам недели, независимо от фильтра.

#### Scenario: Фильтр не меняет метрики
- **WHEN** filter-assignee = anna и Анна перегружена (32/24)
- **THEN** load-anna показывает 133% и +8 ч даже когда скрыты чужие задачи

### Requirement: Недели
Система MUST поддерживать prev-week/next-week с текущей current-week; начальная неделя —
2026-09-28 (DEMO_WEEK); задачи и доступности разных недель независимы. monday(date) MUST
возвращать понедельник ISO `YYYY-MM-DD` без зависимости от часового пояса (Date.UTC).

#### Scenario: Чужая неделя не влияет
- **WHEN** добавлена задача TASK-999 на 2026-10-05 c 100 ч у anna
- **THEN** loadFor(anna, '2026-09-28').hours остаётся 32

#### Scenario: Приведение к понедельнику
- **WHEN** monday('2026-10-01') или monday('2026-10-04')
- **THEN** возвращено '2026-09-28'; monday('2026-10-05') = '2026-10-05'

### Requirement: Нагрузка сотрудника
loadFor(state, employeeId, week) MUST возвращать tasks, active, hours, capacity,
totalHours, doneHours, overload, percent, progress. hours — сумма незавершённых
задач сотрудника за неделю; overload = max(0, hours − capacity).

#### Scenario: Done освобождает нагрузку
- **WHEN** TASK-101 (16 ч) переведена в done
- **THEN** hours=16, overload=0, tasks.length=2

### Requirement: Проценты и прогресс
Система MUST брать capacity из employees[].capacities[week] (иначе employees[].capacity),
percent — Math.round(hours/capacity*100), progress — Math.round(doneHours/totalHours*100)
(totalHours — все назначенные недели). Выполненные MUST давать прогресс и MUST NOT занимать доступность.

#### Scenario: Перегрузка Анны
- **WHEN** loadFor(seedState(), 'anna', DEMO_WEEK)
- **THEN** hours=32, percent=133, overload=8

#### Scenario: Прогресс после done
- **WHEN** TASK-101 (16 ч) переведена в done
- **THEN** progress=50

#### Scenario: Прогресс Марии и Ильи на seed
- **WHEN** metrics для seed-данных
- **THEN** progress maria=43 (6/14), ilya=25 (4/16)

### Requirement: Нулевая доступность
При capacity 0 percent MUST быть null; приложение MUST NOT показывать NaN/Infinity;
overload MUST равняться hours; progress = 0 при отсутствии назначенных часов
(нулевой знаменатель).

#### Scenario: Анна недоступна
- **WHEN** capacities[DEMO_WEEK]=0 у anna при 32 активных часах
- **THEN** percent=null, overload=32, Number.isFinite(progress)

#### Scenario: Нет назначенных задач
- **WHEN** у сотрудника нет задач недели
- **THEN** totalHours=0, progress=0, UI показывает «—»/0%, не NaN

### Requirement: План распределения нагрузки
proposePlan(state, week) MUST возвращать {assignments:[{taskId,assignee}], unassignedHours}
и MUST NOT мутировать state; MUST NOT назначать активные сверх доступности недели, непоместившиеся
MUST оставаться без ответственного (assignee=null). Выполненные, чужие недели, количество и суммы MUST
сохраняться. applyPlan возвращает новое состояние; применяется только после plan-apply; plan-cancel отменяет.

#### Scenario: 70 активных часов при суммарной доступности 16
- **WHEN** все capacities[DEMO_WEEK]=0, кроме dmitry=16, и proposePlan вызван
- **THEN** unassignedHours=54; state deep-equal исходному (предпросмотр не мутирует)
- **AND** после applyPlan overload=0 у всех, задачи и их id сохранены, done не тронуты

#### Scenario: Полное распределение на seed
- **WHEN** capacities 24/32/24/24 и proposePlan+applyPlan
- **THEN** ни один сотрудник не перегружен и нет активных задач без ответственного

#### Scenario: Отмена предпросмотра
- **WHEN** пользователь нажал propose-plan, увидел preview и нажал plan-cancel
- **THEN** назначения не изменились

### Requirement: Валидация формы
validateTask(task, employees) MUST возвращать нормализованную копию (trim) или бросать Error,
не мутируя вход. Название 1–140; описание ≤ 1000; оценка 0.5–168 шаг 0.5 (отклоняются
-1, 0, 0.7, 169, NaN, Infinity); assignee — id или null; status ∈ todo/doing/done; week —
понедельник. Ошибка MUST показываться в task-error открытой формы без сброса значений.

#### Scenario: Пустое название
- **WHEN** task-title = '   ' и нажат task-save
- **THEN** ошибка в task-error, форма открыта, введённые значения сохранены

#### Scenario: Дробная оценка вне шага
- **WHEN** task-hours = 0.7
- **THEN** validateTask бросает Error; 0.5 принимается

### Requirement: Сохранение состояния
Состояние MUST сохраняться в localStorage после каждого изменения и восстанавливаться после
перезагрузки. isValidState MUST принимать корректный сериализованный seed и MUST отклонять дубли
id, некорректные поля, nextId < 110. Повреждённые данные MUST обрабатываться без падения
(переход к seed с уведомлением); reset-demo MUST восстанавливать данные только после подтверждения.

#### Scenario: Перезагрузка
- **WHEN** пользователь создал задачу и перезагрузил страницу
- **THEN** задача на месте

#### Scenario: Испорченный JSON
- **WHEN** в localStorage невалидный JSON или дубли id
- **THEN** приложение стартует на seedState() без исключения

#### Scenario: Строгие числа и ключи недель
- **WHEN** в хранилище часы задачи «16»/0.75/169, capacity −1/«24» или ключ capacities — не понедельник
- **THEN** isValidState=false; приложение переходит к seed без падения

### Requirement: Доступность сотрудников
Поля capacity-anna/dmitry/maria/ilya MUST принимать 0–168 часов и сохраняться на
change/blur в capacities[текущей недели]; UI (employee-*, load-*, progress-*)
обновляется сразу.

#### Scenario: Обнуление доступности
- **WHEN** capacity-anna = 0
- **THEN** load-anna: percent пустой/«—», overload = активные часы, NaN нет

#### Scenario: Пустой или некорректный ввод
- **WHEN** capacity-anna очищено или «abc»/−1/7.3 и потеряло фокус
- **THEN** прежнее значение сохранено в поле и хранилище, рядом ошибка, load-anna не меняется

### Requirement: Адаптивный интерфейс
UI MUST использовать локальный Tabler, быть рабочим на 390/768/1100/1280 px без горизонтального
переполнения; метрики сотрудников видимы; формы подписаны и управляемы клавиатурой; data-testid — по контракту.

#### Scenario: Мобильная ширина
- **WHEN** ширина 390 px
- **THEN** метрики load-*/progress-* видны, горизонтального скролла нет

#### Scenario: Контраст активной кнопки
- **WHEN** view-board активна (aria-pressed=true, btn-primary)
- **THEN** белый текст на акцентном фоне, контраст ≥ 4.5:1, не accent-on-accent
