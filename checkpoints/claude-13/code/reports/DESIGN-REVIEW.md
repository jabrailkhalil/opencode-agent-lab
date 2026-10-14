# DESIGN-REVIEW: «Поток» — DOM-ревью через Playwright MCP

VERDICT: PASS

Метод: реальный Playwright MCP, http://127.0.0.1:4191/, ширины 390 / 768 / 1100 / 1280 (высота 900). Выводы сделаны по DOM, computed style и `getBoundingClientRect`. Изображения я не читал и визуальных оценок по ним не даю: скриншоты сохранены как артефакты.

Примечание о состоянии: в начале прогона в localStorage профиля браузера остались данные прежних прогонов (10 задач, Дмитрий 17/32). Это пользовательское состояние, не дефект. Я нажал `reset-demo`, подтвердил нативный `confirm`, дальше все замеры сделаны на seed.

## Скриншоты (`reports/screenshots/`)
- `review-390.png`, `review-768.png`, `review-1100.png`, `review-1280.png` — полная страница, seed.
- `review-seed-1280.png` — seed, 1280.
- `review-form-error-1280.png` — форма с ошибкой.
- `review-plan-1280.png` — открытый предпросмотр распределения.
- `review-employees-390.png` — «По сотрудникам», 390.
- `review-focus-search-1280.png` — фокус в поле поиска.

## Результаты

| Проверка | 390 | 768 | 1100 | 1280 |
|---|---|---|---|---|
| `documentElement.scrollWidth` / innerWidth | 390/390 | 768/768 | 1100/1100 | 1280/1280 |
| Элементы за границами viewport | 0 | 0 | 0 | 0 |
| `.progress-bar` в DOM | 4 | 4 | 4 | 4 |
| 4 `employee-*`, 4 `load-*`, 4 `progress-*` внутри viewport | да | да | да | да |
| Раскладка `employee-*` | 1 колонка, 366 px | 2×2, 363 px | колонка справа, 320 px | колонка справа, 320 px |
| Ширина `progress-*` | 340 | 337 | 294 | 294 |
| Обрезанные блоки (`overflow` + `scrollWidth>clientWidth`) | 0 | 0 | 0 | 0 |
| NaN / Infinity / undefined / null в `innerText` | нет | нет | нет | нет |

Значения seed (текст `data-testid`):
- Метрики: `metric-tasks` 9, `metric-hours` 80 ч, `metric-active` «7 задач / 70 ч», `metric-done` «10 ч · 13%».
- `load-anna` «32 / 24 ч · 133%» (в карточке есть «Перегрузка …»), `load-dmitry` «14 / 32 ч · 44%», `load-maria` «8 / 24 ч · 33%», `load-ilya` «12 / 24 ч · 50%».
- `progress-anna` «0% · 0 из 32 ч», `progress-dmitry` «0% · 0 из 14 ч», `progress-maria` «43% · 6 из 14 ч», `progress-ilya` «25% · 4 из 16 ч».
- Пустая неделя (9–15 ноя 2026, 390): `progress-*` «0% · 0 из 0 ч», `load-anna` «0 / 24 ч · 0%», NaN нет, scrollWidth 390.

## Форма и план
- `new-task` открывает диалог: `role=dialog`, `aria-modal=true`, `aria-labelledby=task-modal-title`, `novalidate=true`. Фокус сразу в `task-title`.
- Поля `task-title`, `task-description`, `task-assignee`, `task-hours`, `task-status`, `task-week` имеют `<label for>`, `input.labels[0]` есть у всех. Высота полей 40 px.
- Ошибка (пустое название и оценка 0.7): `task-error` внутри `task-form`, `role=alert`, видим. Текст: «Название: от 1 до 140 символов после удаления пробелов», «Оценка: от 0,5 до 168 с шагом 0,5». `aria-invalid=true` и `.is-invalid` у `task-title` и `task-hours`. Значение 0.7 сохранено, форма осталась открытой, фокус на первом невалидном поле (`task-title`).
- Esc закрывает форму, фокус возвращается на `new-task`.
- `propose-plan` открывает `plan-preview`: «Это предпросмотр — план не изменён», таблица «Задача | Было | Станет | Часы» (7 активных задач, TASK-102 Анна→Дмитрий, TASK-109 Без ответственного→Мария), есть `plan-apply` и `plan-cancel`. `propose-plan` при этом `disabled`. scrollWidth 1280. `plan-cancel` закрывает предпросмотр.
- «По сотрудникам»: `employees-view` есть, `board` убран, `aria-pressed=true`, `task-TASK-101` ровно один, 4 `progress-*` на месте, на 390 scrollWidth 390.

## Подписи и фокус
- Все `input/select/textarea` на странице имеют label (неподписанных 0). `search` — «Поиск», `capacity-*` — «Доступность, ч/нед». Клик по label «Поиск» переводит фокус в `search`.
- Tab с клавиатуры: у 11 проверенных контролов `:focus-visible` = true, `outline` solid 2px с непрозрачным цветом (после окончания transition). У кнопок offset 2px, у полей −1px.
- Консоль: ошибок и `pageerror` за прогон нет.

## Замечания (не блокируют, фактические отклонения от DESIGN-PLAN)
1. `edit-TASK-*` / `delete-TASK-*`: высота 36 px на 390 и 768 (18 контролов). План требовал ≥40 px на ≤768. На 1100/1280 нарушений нет.
2. Цвет outline фокуса: computed `oklab(0.758 -0.019 -0.076)`, а в `styles.css` объявлен `#206bc4`. Правила Tabler для `.form-control:focus` перекрывают его. Фокус видим по computed-стилям, но цвет не равен заявленному.
3. На ≥1100 `team-load` стоит правой колонкой, а не над панелью управления. Порядок Tab: `reset-demo`, неделя, `new-task`, `capacity-*`, затем `search`. Он идёт через правую колонку раньше поиска слева, то есть не совпадает с визуальным порядком.
4. `reset-demo` использует нативный `window.confirm` без `confirm-ok` / `confirm-cancel`, как в плане §2 п.9. Работает, но не тестируется через testid.

## Шаги воспроизведения замечаний
1. Замечание 1: открыть страницу при ширине 390, выполнить `document.querySelector('[data-testid="edit-TASK-102"]').getBoundingClientRect().height`. Результат 36.
2. Замечание 3: ширина 1280, нажать Tab пять-семь раз от начала страницы. Фокус попадёт в `capacity-anna`, потом ещё три `capacity-*`, и только потом в `search`.
