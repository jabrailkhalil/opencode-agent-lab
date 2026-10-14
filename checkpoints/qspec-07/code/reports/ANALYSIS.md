# ANALYSIS — build-tracker (роль: analyst)

Прочитаны: docs/BRIEF.md, INTERFACES.md, seed-state.json, OPENSPEC-WORKFLOW.md,
DESIGN-REFERENCE.md, tests/acceptance.test.mjs (только чтение). Созданы:
openspec/changes/build-tracker/{proposal.md, design.md, tasks.md,
specs/tracker/spec.md}. Код не написан.

## 1. Проверка seed-арифметики (сходится с брифом)

- Всего 9 задач, Σ часов = 16+16+8+6+8+12+4+6+4 = 80.
- Активные (todo/doing): TASK-101,102,103,104,105,106,109 → 7 задач, Σ=70 ч.
- Анна: active 16+16=32 при capacity 24 → percent=round(32/24·100)=133,
  overload=8. ✓
- Мария: задачи 105 (doing 8) + 108 (done 6): hours=8, capacity 24 → 33%;
  progress = doneHours/totalHours = 6/14 = 42.857 → round 43. ✓
- Илья: 106 (todo 12) + 107 (done 4): progress = 4/16 = 25%. ✓
- Дмитрий: 103+104 = 14 ч активных, 32 доступных → 44%, без перегрузки.

## 2. Ключевые разборы приёмочных сценариев

Нагрузка vs прогресс. done-задача снимается из hours/overload (не занимает
доступность), но остаётся в totalHours/doneHours → TASK-101→done даёт Анне
hours=16, overload=0, progress=50 (16/32), tasks.length=2. Специфицировано в
spec «Нагрузка и прогресс».

Нулевая доступность. capacity=0 → percent=null (не 0, не Infinity), overload=
hours=32, progress обязан остаться конечным; UI печатает «—». Отдельное требование
+ сценарии с null-знаменателем progress.

План 70 ч при доступности 16. Тест: все capacities=0, кроме dmitry=16. Активных
70 ч; 16 ч помещаются dmitry, unassignedHours=70−16=54 — это означает: алгоритм
обязан переиспользовать чужие активные задачи (снимать назначения сверх лимита) и
оставлять неприместившиеся с assignee=null. Дополнительно проверяется: proposePlan
deep-equal не мутирует state; после applyPlan сохранены количество задач, множество
id и done-задачи; overload=0 у всех. Во втором тесте (полные capacity 24/32/24/24,
Σ=104≥70) plan обязан погасить и TASK-109 (после apply нет безответственных
активных). В design зафиксирован жадный алгоритм: сортировка hours DESC, выдача
сотруднику с наибольшим остатком, лимит — остаток capacity недели.

Прочее: задачи чужой недели (TASK-999, 2026-10-05, 100 ч) не влияют на loadFor и
не трогаются plan; monday через UTC; валидация отклоняет часы -1,0,0.7,169,NaN,
Infinity, '   ' название, assignee:'missing', принимает 0.5; isValidState: дубли id
и nextId<110 → false; seed round-trip через JSON → true.

## 3. Риски реализации

1. Мутация state в proposePlan/applyPlan — главный способ провалить тесты;
   решено клонами (design).
2. Округление: только Math.round (133%, 43%); деление без guard даст NaN/Infinity.
3. localStorage: повреждённые данные не должны ронять app — фолбэк на seedState().
4. Формулировка «нулевой ответственный»: task-assignee select обязан поддерживать
   пустое значение = null; trim-валидация независимо от HTML required.
5. Адаптивность 390–1280 без горизонтального переполнения — проверить браузером
   (в этом прогоне браузер не запускался, визуальная проверка не заявляется).

## 4. Статус артефактов

- proposal.md: Why/What Changes/Impact.
- specs/tracker/spec.md: 11 требований MUST/SHALL, сценарии WHEN/THEN (156 строк).
- design.md: контекст, решения (метрики, алгоритм плана, хранилище, UI), риски.
- tasks.md: чеклист 3 секций × (домен/UI/проверка).
- Следующая роль: Designer уточняет design.md; Developer реализует по tasks.md;
   Tester сверяет сценарии. Запусков не было (запрещено задание-рельефом прогона).
