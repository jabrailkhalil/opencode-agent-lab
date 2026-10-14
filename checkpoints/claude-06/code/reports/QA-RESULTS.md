# QA-RESULTS

VERDICT: PASS

Проверка выполнена независимо: код и готовые тесты не менялись.

## Запуски (по одному разу)
- `node --test tests/acceptance.test.mjs`: 9 из 9 PASS, fail 0 (вывод также в reports/node-tests.txt).
- `node scripts/verify.mjs`: summary PASS. Native 9/9, браузерных кейсов 19 из 19 PASS, 0 FAIL. Отчёт: reports/host-verification.json. Скриншоты скрипта: screenshots/acceptance-1791233146288/.
- Команда `node --test tests/*.test.mjs` отдельно не запускалась: окружение разрешает только точные команды из конфигурации. Файлов `tests/agent-*.test.mjs` нет.

## Результаты по пунктам QA-CHECKLIST (по host-verification.json)
| Пункт | Статус | Свидетельство |
|---|---|---|
| QA-01 начальные данные | PASS | verify QA-01 PASS. Личная проверка DOM: 9 задач, Анна `32 / 24 ч · 133%`, Мария `43% · 6 из 14 ч`, Илья `25% · 4 из 16 ч` |
| QA-02 адаптивность 390/768/1100/1280 | PASS | verify QA-02 PASS. Личная проверка: при 1280 и 390 scrollWidth равен innerWidth, 4 прогресса видны (right ≤ 365 при ширине 390). 768 и 1100 проверены только скриптом |
| QA-03 валидация (пробелы, -1, 0,7) | PASS | verify QA-03a, QA-03-_1, QA-03-0_7: все PASS. В личной проверке не повторялось |
| QA-04 создание и перезагрузка | PASS | verify QA-04 PASS. Личная проверка: задача создана через форму, после reload ровно одна (10 задач, одна «MCP smoke»), нагрузка Дмитрия 14→16/32 |
| QA-05 правка / завершение / удаление | PASS | verify QA-05a, QA-05b, QA-05c: все PASS |
| QA-06 поиск + фильтр | PASS | verify QA-06 PASS |
| QA-07 недели | PASS | verify QA-07a, QA-07b: PASS |
| QA-08 представления и drag-and-drop | PASS | verify QA-08a, QA-08b: PASS |
| QA-09 предпросмотр и отмена | PASS | verify QA-09 PASS. Личная проверка: предпросмотр открылся (772x743, есть plan-apply и plan-cancel), Анна осталась 32/24. После отмены `plan-preview` hidden (display:none, 0x0), нагрузки и число задач не изменились |
| QA-10 применение плана | PASS | verify QA-10 PASS. В личной проверке не применялось |
| QA-11 нулевая доступность | PASS | verify QA-11 PASS |
| QA-12 восстановление и повреждённые данные | PASS | verify QA-12a, QA-12b: PASS |

## Личный smoke через Playwright MCP (http://127.0.0.1:4191/)
- Все проверенные data-testid присутствуют и видимы: app, employee-*, load-*, progress-*, new-task, search, filter-assignee, prev/next/current-week, view-*, board, column-*, capacity-*, propose-plan, reset-demo.
- Создание задачи, reload и сохранение: PASS.
- Предпросмотр плана и отмена: PASS. Контейнер `plan-preview` остаётся в DOM с атрибутом `hidden`, поэтому проверка «элемент существует» после отмены даёт ложный результат. Нужно смотреть display или hidden.
- Консоль и сеть отдельно не анализировались.
- Скриншоты: screenshots/mcp/mcp-01-initial.png, mcp-02-after-reload.png, mcp-03-plan-preview.png, mcp-04-after-cancel.png, mcp-05-390.png.

## Ограничения
- В QA-CHECKLIST 12 пунктов, verify.mjs выполняет 19 кейсов (подпункты a/b/c). NOT RUN нет, но пункты QA-03, QA-06 — QA-12 в личной проверке не повторялись, их статус взят из verify.mjs.
- В тестовом профиле MCP-браузера остался localStorage с задачей «MCP smoke задача». Это не влияет на репозиторий.

## Передача разработчику
Дефектов не найдено. Замечаний к коду нет.
