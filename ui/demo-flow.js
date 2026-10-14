import {workshopStreams} from './workshop-flow.js';
// One route is used by the local replay, console and presenter guide.
export const routes={
claude:[
 ['01','analyst','Прочитай требования проекта, проверь формулы нагрузки и прогресса. Сохрани анализ, перечисли неоднозначности и передай результат дизайнеру.'],
 ['02','designer','Подготовь план интерфейса по требованиям и результату аналитика. Раздели нагрузку и прогресс, опиши состояния формы и адаптацию.'],
 ['03','developer','Реализуй трекер задач и планировщик с нуля по требованиям, контракту и плану дизайнера. Проверь расчёты и интерфейс.'],
 ['04','developer','Продолжи реализацию после обрыва API. Используй уже сохранённые файлы и заверши приложение.'],
 ['05','tester','Проведи независимую приёмку приложения. Сверь результат с требованиями и сохрани ошибки с шагами воспроизведения.'],
 ['06','developer','Исправь EX-13: нагрузка не должна определяться как прогресс. У Анны прогресс 0%. Раздели показатели в разметке.'],
 ['07','tester','Повтори приёмку после первой правки. Отдельно проверь, какой элемент измеряется в EX-13.'],
 ['08','developer','Повторный EX-13 измеряет обёртку. Исправь разметку и идентификатор так, чтобы проверка находила нужный элемент.'],
 ['09','tester','Повтори проверку после второй правки. Сверь полосу выполненных часов с фактическим прогрессом.'],
 ['10','developer','EX-13 всё ещё получает 100% ширины дорожки. Перенеси семантику progressbar на заливку выполненных часов и проверь соседние функции.'],
 ['11','tester','Проведи повторную полную приёмку после третьей правки. Зафиксируй фактические результаты проверок.'],
 ['12','designer','Сверь готовый интерфейс с дизайн-планом. Проверь размеры кнопок, фокус и порядок перехода по Tab.'],
 ['13','analyst','Подведи итог: сопоставь требования, отчёты и проверки. Отдельно укажи, какие подтверждения готовности ещё отсутствуют.'],
 ['14',null,null]
],
qwen:[
 ['01','analyst','Прочитай требования проекта, проверь формулы нагрузки и прогресса. Сохрани анализ, перечисли неоднозначности и передай результат дизайнеру.'],
 ['02','designer','Подготовь план интерфейса по требованиям и результату аналитика. Раздели нагрузку и прогресс, опиши состояния формы и адаптацию.'],
 ['03','developer','Реализуй трекер задач и планировщик с нуля по требованиям, контракту и плану дизайнера. Проверь расчёты и интерфейс.'],
 ['04','tester','Проведи независимую приёмку. Проверь форму, сохранение, распределение и перенос карточек. Сохрани результат.'],
 ['05','developer','Исправь подтверждённые ошибки первой приёмки. Сохрани изменения и отчёт о проверках.'],
 ['06','tester','Проверь сохранённую версию после первой правки. Отдельно проверь ошибки формы, список ответственных и нулевую доступность.'],
 ['07','developer','Исправь отображение ошибки формы, заполнение списка сотрудников и распределение при нулевой доступности.'],
 ['08','tester','Повтори приёмку. Отдельно воспроизведи QA-08b: перенос карточки в другую колонку.'],
 ['09','developer','Разбери оставшийся сбой переноса. Проверь события drag-and-drop и сохранённые данные; укажи, что подтвердилось.'],
 ['10','tester','Независимо проверь перенос после изменений. Зафиксируй результат QA-08b и остальных сценариев.'],
 ['11','developer','Доработай перенос и полосы выполненных часов. Проверь расчёты и сохрани ограничения, если они остались.'],
 ['12','tester','Проведи итоговую приёмку текущего кода. Укажи отдельно PASS и FAIL по обязательным сценариям.'],
 ['13','analyst','Сопоставь требования с итоговой приёмкой. Укажи, можно ли считать работу завершённой и что осталось неподтверждённым.'],
 ['14',null,null],['15',null,null]
]};
export const uiCycle=[
  {
    "id": "claude-ui-qa",
    "role": "tester",
    "title": "UI: найдено наложение кнопок",
    "prompt": "Проверь интерфейс целиком на ширине 1280 px. Зафиксируй наложение подписей и передай дефект дизайнеру."
  },
  {
    "id": "claude-ui-design",
    "role": "designer",
    "title": "UI: решение дизайнера",
    "prompt": "Уточни раскладку панели управления после добавления боковой колонки. Сохрани читаемые подписи на всех ширинах."
  },
  {
    "id": "claude-ui-fix",
    "role": "developer",
    "title": "UI: исправление раскладки",
    "prompt": "Исправь панель по решению дизайнера. Сохрани две колонки вместо четырёх; не меняй расчёты и поведение задач."
  },
  {
    "id": "claude-ui-pass",
    "role": "tester",
    "title": "UI: повторная проверка",
    "prompt": "Повтори проверку на пяти ширинах. Подтверди, что подписи помещаются, горизонтального скролла нет, прогресс Марии 43%, Ильи 25%."
  }
];
export const roleLabels={analyst:'Analyst',designer:'Designer',developer:'Developer',tester:'Tester'};
export function flowFor(profile){
 const recorded=routes[profile].map(([suffix,role,prompt])=>({id:profile+'-'+suffix,role,prompt,type:role?'prompt':'view'}));
 return profile==='claude'?[...recorded,...uiCycle.map(p=>({...p,type:'prompt',prepared:true}))]:recorded;
}
export function nextPrompt(profile,current){
 const stream=Object.values(workshopStreams).find(s=>s.profile===profile&&s.steps.some(p=>p.id===current));
 if(stream){const i=stream.steps.findIndex(p=>p.id===current);return stream.steps.slice(i+1).find(p=>p.role!=='operator')||null;}
 const all=flowFor(profile),index=current===profile+'-00'?-1:all.findIndex(p=>p.id===current);
 if(index<0&&current!==profile+'-00')return null;
 return all.slice(index+1).find(p=>p.type==='prompt')||null;
}
export function promptText(step){return step.prompt;}
// Keep checkpoint routing outside the visible task text. Several branches may
// share a task; the current branch and role still decide which one can advance.
export function recordedPromptSteps(profile,text){
 const normalize=value=>String(value||'').replace(/\r\n/g,'\n').trim();
 const prompt=normalize(text);
 if(!prompt)return [];
 return [...flowFor(profile),...Object.values(workshopStreams).filter(s=>s.profile===profile).flatMap(s=>s.steps)]
  .filter(step=>step.prompt&&normalize(step.prompt)===prompt).map(step=>step.id);
}
