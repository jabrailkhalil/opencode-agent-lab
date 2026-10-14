# Tasks: build-tracker

## 1. Домен (dist/domain.js)

- [x] 1.1 Экспортировать DEMO_WEEK, seedState() (глубокая копия seed), monday()
- [x] 1.2 loadFor: tasks/active/hours/capacity/totalHours/doneHours/overload/
      percent/progress; capacity из capacities[week] ?? capacity; percent=null
      при 0; progress=0 при нулевом totalHours; Math.round
- [x] 1.3 validateTask: trim, название 1–140, описание ≤1000, часы 0.5–168 шаг
      0.5 (отклонять -1,0,0.7,169,NaN,±Infinity), assignee id|null, статус,
      week=понедельник; копия без мутации, throw Error
- [x] 1.4 proposePlan: не мутация, только активные задачи недели, лимит доступности,
      unassignedHours, неприместившиеся → assignee=null; applyPlan → новое состояние
- [x] 1.5 isValidState: схема, уникальные id, nextId ≥ 110

## 2. UI (index.html, app.js, styles.css)

- [x] 2.1 Каркас: подключение локального Tabler, testid app/header/current-week,
      prev-week/next-week, view-board/view-employees
- [x] 2.2 Доска column-todo/doing/done, карточки task-*, drag-and-drop статуса
- [x] 2.3 Представление по сотрудникам: employee-*, строки с load-*/progress-*
      (часы, %, перегрузка, прогресс), «—» при percent=null
- [x] 2.4 Форма task-form (task-title/description/hours/assignee/status/week,
      task-save/task-cancel/task-error), edit-*/delete-* карточек, ошибки без
      сброса значений
- [x] 2.5 Поиск search, фильтр filter-assignee; метрики считаются по всем задачам
- [x] 2.6 Поля capacity-anna/dmitry/maria/ilya (0–168), сохранение change/blur
- [x] 2.7 propose-plan → plan-preview, plan-apply/plan-cancel; исходный план
      до apply не меняется
- [x] 2.8 localStorage: запись после изменений, чтение с isValidState, фолбэк на
      seed, reset-demo с подтверждением

## 3. Проверка

- [x] 3.1 `node --test tests/acceptance.test.mjs` — все девять зелёные
- [ ] 3.2 Прогон спец-сценариев в DOM на 390/768/1100/1280 без переполнения
      (браузер в этом прогоне недоступен; вёрстка проверена только статически)
- [x] 3.3 Ручная проверка seed-метрик: Анна 32/24 133% +8; Мария progress 43;
      Илья 25; всего 80 ч, актив 70 ч/7 задач

## 4. Исправления по передаче QA (браузер 13.10.2026 + провалы проверок хранилища)

- [x] 4.1 domain.js isValidState — строгая схема по INTERFACES/BRIEF: task.hours и
      employee.capacity/capacities[] — настоящий number, диапазон (0.5–168 / 0–168) и
      шаг 0,5; ключи capacities — только валидные понедельники (monday(k)===k).
      Отклоняются «16», 0.75, −1, 169, «24», capacities.broken, ключ-непонедельник.
- [x] 4.2 app.js onCapacity — пустое/некорректное поле НЕ пишет 0: прежнее значение
      сохраняется, поле откатывается, рядом показывается понятная ошибка (input+change+blur).
- [x] 4.3 styles.css — читаемый контраст активной «Доска / По сотрудникам» (залитый
      акцент + белый текст вместо accent-текста на btn-primary ≈1:1, WCAG 1.4.3).
- [x] 4.4 styles.css — спокойная иерархия только локально: компактные ghost-действия с
      тонкой верхней границей, приглушённые чипы, мягкий drag-over без свечения, единый
      радиус. DOM-контракт и формулы не тронуты.
- [ ] 4.5 spec.md — сценарии «пустой/некорректный ввод доступности» и «строгая валидация
      хранилища» (текст ниже в DEVELOPMENT.md) вне прав этого прогона; перенести в delta.
- [ ] 4.6 agent-ui.test.mjs:22 красный на composed-testid — проверка тестировщика,
      правка тестов вне прав разработчика; элементы в разметке есть (подтверждено шаблонами).
