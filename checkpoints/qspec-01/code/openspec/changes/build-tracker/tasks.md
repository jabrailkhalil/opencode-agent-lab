# Tasks: build-tracker

## 1. Домен (dist/domain.js)

- [ ] 1.1 Экспортировать DEMO_WEEK, seedState() (глубокая копия seed), monday()
- [ ] 1.2 loadFor: tasks/active/hours/capacity/totalHours/doneHours/overload/
      percent/progress; capacity из capacities[week] ?? capacity; percent=null
      при 0; progress=0 при нулевом totalHours; Math.round
- [ ] 1.3 validateTask: trim, название 1–140, описание ≤1000, часы 0.5–168 шаг
      0.5 (отклонять -1,0,0.7,169,NaN,±Infinity), assignee id|null, статус,
      week=понедельник; копия без мутации, throw Error
- [ ] 1.4 proposePlan: не мутация, только активные задачи недели, лимит доступности,
      unassignedHours, неприместившиеся → assignee=null; applyPlan → новое состояние
- [ ] 1.5 isValidState: схема, уникальные id, nextId ≥ 110

## 2. UI (index.html, app.js, styles.css)

- [ ] 2.1 Каркас: подключение локального Tabler, testid app/header/current-week,
      prev-week/next-week, view-board/view-employees
- [ ] 2.2 Доска column-todo/doing/done, карточки task-*, drag-and-drop статуса
- [ ] 2.3 Представление по сотрудникам: employee-*, строки с load-*/progress-*
      (часы, %, перегрузка, прогресс), «—» при percent=null
- [ ] 2.4 Форма task-form (task-title/description/hours/assignee/status/week,
      task-save/task-cancel/task-error), edit-*/delete-* карточек, ошибки без
      сброса значений
- [ ] 2.5 Поиск search, фильтр filter-assignee; метрики считаются по всем задачам
- [ ] 2.6 Поля capacity-anna/dmitry/maria/ilya (0–168), сохранение change/blur
- [ ] 2.7 propose-plan → plan-preview, plan-apply/plan-cancel; исходный план
      до apply не меняется
- [ ] 2.8 localStorage: запись после изменений, чтение с isValidState, фолбэк на
      seed, reset-demo с подтверждением

## 3. Проверка

- [ ] 3.1 `node --test tests/acceptance.test.mjs` — все девять зелёные
- [ ] 3.2 Прогон спец-сценариев в DOM на 390/768/1100/1280 без переполнения
- [ ] 3.3 Ручная проверка seed-метрик: Анна 32/24 133% +8; Мария progress 43;
      Илья 25; всего 80 ч, актив 70 ч/7 задач
