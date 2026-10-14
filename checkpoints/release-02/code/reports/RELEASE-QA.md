# Финальная приёмка · 12 октября 2026

Доработки выполнены после измеренного прогона sdd-19. Его исходные файлы, ответы моделей и стоимость сохранены.

## Исправлено
- Возврат фокуса после формы, подтверждения и плана.
- Сообщение об ошибке в начале формы и связь с полями.
- Перенос длинного текста в подтверждении; адаптация промежуточных ширин и низких окон.
- Восстановление учебного примера сбрасывает фильтры и неделю.
- Сохранение выбранной недели; повреждённое хранилище восстанавливается.
- В представлении по сотрудникам отключён неподдерживаемый drag-and-drop.
- Защита доменных данных от массива вместо даты и пустого списка сотрудников.

## Проверено в браузере
- PASS · trim validation
- PASS · create + preserved description
- PASS · reload/edit/status/focus
- PASS · delete cancel
- PASS · delete confirm
- PASS · search leaves load unchanged
- PASS · assignee filter
- PASS · 70 active hours / 16 capacity =54 unassigned
- PASS · plan cancel focus
- PASS · plan apply
- PASS · reset from other week
- PASS · corrupted storage recovery
- PASS · Escape returns focus
- PASS · Native drag TASK-102 to done recalculates active hours 70→54 and Anna 32→16
- PASS · 140-character title and 999-character description, 390px confirmation stays within viewport
- PASS · Employee view does not advertise unsupported drag

## Размеры экрана
- 1280×900: без выхода элементов по горизонтали
- 1100×800: без выхода элементов по горизонтали
- 992×650: без выхода элементов по горизонтали
- 768×800: без выхода элементов по горизонтали
- 390×844: без выхода элементов по горизонтали
- 1280×500: без выхода элементов по горизонтали

Исходные 9 доменных тестов: 9 прошли, 0 упали. Это проверка перечисленных сценариев, а не гарантия отсутствия любых ошибок. Браузерные свидетельства: checks/final-70/browser-qa.json и screens.
