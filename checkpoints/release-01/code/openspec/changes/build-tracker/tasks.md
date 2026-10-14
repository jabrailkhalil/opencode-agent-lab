## 1. Доменный модуль (`dist/domain.js`)

- [x] 1.1 Каркас экспортов: DEMO_WEEK, seedState (встроенная копия seed), monday
- [x] 1.2 loadFor: capacity из capacities (0 допустим), percent=null при 0, progress, overload
- [x] 1.3 validateTask: trim, длины, hours 0,5–168 шаг 0,5, assignee, status, week-понедельник; без мутации
- [x] 1.4 isValidState: типы, дубли id, ссылки на сотрудников, nextId ≥ 110 и > суффиксов
- [x] 1.5 proposePlan (жадный, остаток доступности, null для не поместившихся, unassignedHours)
- [x] 1.6 applyPlan: новое состояние, только assignee активных задач недели

## 2. Хранение (`dist/app.js`, модуль store)

- [x] 2.1 load/save localStorage с try/catch, откат к seed + уведомление
- [x] 2.2 reset-demo с подтверждением

## 3. Разметка и стили

- [x] 3.1 `index.html`: подключение локального Tabler, `styles.css`, `app.js` как module; корневой `app`
- [x] 3.2 Панель: недели (prev/next/current), переключатели видов, search, filter-assignee, new-task, propose-plan, reset-demo
- [x] 3.3 Адаптив 390/768/1100/1280 без горизонтального переполнения (проверено 12.10: 390/768/992/1100/1280 и низкое окно; reports/RELEASE-QA.md)

## 4. Представления

- [x] 4.1 Карточки сотрудников: load-*, progress-*, capacity-* с подписями; текст «нет доступности», «+N ч»
- [x] 4.2 Доска с колонками и drag-and-drop; карточки task-*, edit-*, delete-*
- [x] 4.3 Представление по сотрудникам и «Без ответственного»; переключение сохраняет фильтры
- [x] 4.4 Поиск/фильтр только для списка, нагрузка по всем задачам недели

## 5. Форма и план

- [x] 5.1 task-form: создание/правка, ошибки в task-error, значения не сбрасываются
- [x] 5.2 Подтверждение удаления
- [x] 5.3 plan-preview (было → станет, unassignedHours), plan-apply, plan-cancel

## 6. Проверка

- [x] 6.1 Запуск tests/acceptance.test.mjs (разработчик/тестировщик)
- [x] 6.2 Ручной/браузерный проход сценариев spec.md (нулевая доступность, 70 ч при 16, форма, перезагрузка)
- [x] 6.3 Проверка клавиатуры и ширин 390/768/1100/1280 в браузере
