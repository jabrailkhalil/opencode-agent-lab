import {markdown,escapeHtml as e} from './checkpoint-markdown.js';
import {extraPage} from './workshop-extras.js';
import {reviewHTML,metricsHTML,conclusionHTML} from './comparison-sections.js';
import {comparisonSection} from './material-routes.js';
import {legacyCard} from './legacy-qwen.js';
export const duration = ms => {if(!Number.isFinite(ms))return 'Нет замера';const s=Math.round(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const num=n=>Number.isFinite(n)?n.toLocaleString('ru-RU'):'Нет замера';
const usd=n=>Number.isFinite(n)?'$'+n.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}):'Нет замера';
const names={'qwen-spec':'Qwen 3.8 Flash + OpenSpec','sonnet-spec':'Sonnet + OpenSpec','sonnet-direct':'Sonnet · прямые задания','qwen-direct':'Qwen 3.8 Flash · прямые задания'};
const snapshot={'sonnet-spec':'sdd-19','sonnet-direct':'direct-15','qwen-direct':'flash-13'};
const details={
 'sonnet-spec':{fix:'Кнопки выходили за боковую панель. После CSS-правки граница кнопок — 223,33 px внутри панели 240 px.',limit:'Полный UI-набор не выполнялся; в FINAL остались замечания по фокусу, узким экранам и форме.'},
 'sonnet-direct':{fix:'Даты недели слипались. Первая CSS-правка не помогла; смена направления flex исправила расположение.',limit:'Полный UI-набор не выполнялся; в FINAL остались замечания по фокусу, доступности и скрытым полям.'},
 'qwen-direct':{fix:'Сброс примера оставлял пустую неделю. Исправлены возврат недели, пустой поиск и потеря нагрузки при пустом вводе.',limit:'Полный UI-набор не выполнялся; пустое поле доступности откатывается без пояснения пользователю.'}
};
const evidence=(id,file,label)=>`<button data-evidence="${id}/${e(file)}">${e(label)}</button>`;
const pult=(id,tab='files')=>`/?profile=${id.startsWith('flash')?'qwen':'claude'}#${id}~${tab}`;
const finalStage=r=>r.stages.filter(s=>s.application).at(-1)?.id||r.stages.at(-1).id;
function card(r,index){const id=finalStage(r),m=r.metrics,a=r.methodAudit;return '<article class="result-card"><div class="card-top"><span class="tag '+(r.spec?'spec':'')+'">'+((index?String(index).padStart(2,'0')+' · ':'')+(r.spec?'Со спецификацией':'Прямые задания'))+'</span><h2>'+e(names[r.id]||r.label)+'</h2><div class="model-id">'+e(r.model)+'</div></div><a class="product-preview" href="/preview/'+id+'/" target="comparison-product-'+id+'"><img src="/recorded/'+id+'/screenshots/application-cover.png" alt="'+e(r.label)+'" loading="lazy"><span>Открыть приложение ↗</span></a><div class="card-bottom"><div class="facts"><span><strong>'+usd(m.uncachedUsd)+'</strong><small>Расчёт стоимости API</small></span><span><strong>'+duration(m.elapsedMs)+'</strong><small>полный прогон</small></span><span><strong>'+m.domainTests.passed+'/9</strong><small>исходные тесты</small></span></div>'+(a?'<div class="audit-score"><strong>'+a.passed+'/'+a.total+'</strong> общих проверок логики и хранилища</div>':'')+'<div class="actions"><a class="open-product" href="/preview/'+id+'/" target="comparison-product-'+id+'">Открыть приложение ↗</a>'+evidence(id,r.id==='qwen-spec'?'reports/QA-RESULTS.md':'reports/FINAL.md',r.id==='qwen-spec'?'Итоговая проверка':'Итоговый отчёт')+(r.id==='qwen-spec'?evidence(id,'reports/BROWSER-RECHECK.txt','Проверка в браузере'):'')+'</div><details class="card-details"><summary>Что проверено</summary><p>'+num(m.requests)+' запросов API, включая исправления и повторы. '+e(r.visual?.summary||'Визуальная проверка отдельно от доменных тестов.')+'</p>'+(a?'<p>'+e(a.checks.filter(c=>!c.pass).map(c=>c.title).join('; ')||'Общие дополнительные проверки пройдены.')+'</p>':'')+'</details>'+(r.refinement?'<p class="refinement-note">Общий UI-план · дополнительная итерация. <a href="/preview/'+r.refinement.source+'/" target="original-'+r.id+'">Исходный API-результат ↗</a></p>':'')+'</div></article>';}
export function compare(data,mode){
 const all=mode==='compare-all',ids=all?['sonnet-spec','sonnet-direct','qwen-spec','qwen-direct','legacy']:mode==='compare-method'?['sonnet-spec','sonnet-direct']:mode==='compare-models'?['sonnet-direct','qwen-direct']:['qwen-spec','qwen-direct'];
 const cards=ids.map((id,i)=>id==='legacy'?(data.legacyQwen?legacyCard(data.legacyQwen,i+1):''):card(data.runs.find(r=>r.id===id),all?i+1:null)).join('');
 return '<p class="eyebrow">Task Tracker · готовые результаты</p><h1>'+(all?'Пять результатов разработки':mode==='compare-qwen'?'Qwen: с OpenSpec и без':mode==='compare-method'?'Sonnet: с OpenSpec и без':'Sonnet и Qwen: прямые задания')+'</h1><p class="lead">'+(all?'Все пять приложений доступны ниже. Нажми «Открыть приложение», чтобы проверить работу. Измерения и разбор подхода — в разделе «Выводы».':'Открой готовые приложения, затем сопоставь проверки, время и стоимость.')+'</p><nav class="compare-switch">'+[['compare-all','Все 5 результатов'],['compare-qwen','Два Qwen'],['compare-method','Два Sonnet'],['compare-models','Sonnet / Qwen']].map(([id,t])=>'<a class="'+(mode===id?'active':'')+'" href="#'+id+'">'+t+'</a>').join('')+'<a href="#conclusion">Что дал OpenSpec →</a></nav><div class="result-grid '+(all?'five':'two')+'">'+cards+'</div>'+'<div class="actions"><a href="#spec-driven">Как работает spec-driven →</a><a href="#conclusion">Токены и расчёт цены →</a><a href="#conclusion">Все выводы →</a></div><p class="metrics-note">Все цены — оценка повторения записанного объёма запросов по объёму запросов, включая исправления и повторы. В карточках указана полная длительность прогона; время работы ролей отдельно показано в выводах и метриках. Qwen3 Coder — отдельный прогон с другим объёмом работы; его 19 браузерных проверок не равны 18 общим проверкам новых Qwen.</p>';
}
export function specDrivenHTML(data){
 const specFile='openspec/changes/build-tracker/specs/tracker/spec.md';
 return `<article class="spec-driven-content">
 <p class="eyebrow">Подход и его применение в нашем прогоне</p>
 <h1>Spec-driven: от требований к коду</h1>
 <section aria-labelledby="spec-definition-title">
 <h2 id="spec-definition-title">А. Что такое спецификация</h2>
 <div class="spec-intro-grid">
 <div class="spec-definition">
 <p><strong>Спецификация</strong> — явное описание того, что должна делать система: её функций, поведения интерфейса, правил работы с данными, ограничений и критериев приёмки.</p>
 <p><strong>Spec-driven development (SDD)</strong> — подход, в котором спецификация направляет разработку. Из неё получают план и задачи, по ней реализуют код и проверяют результат. Уточнения возвращают в требования.</p>
 <p><strong>Зачем:</strong> согласовать ожидания, передавать агентам единый контекст и сделать готовность проверяемой.</p>
 </div>
 <figure class="spec-illustration">
 <a href="/spec-driven-overview.jpeg" target="spec-driven-overview" aria-label="Открыть схему OpenSpec крупнее"><img src="/spec-driven-overview.jpeg" width="1536" height="1024" alt="Цикл OpenSpec: идея, спецификация, код, проверка и уточнение требований по обратной связи"></a>
 <figcaption>Цикл работы на примере OpenSpec. Нажми на схему, чтобы открыть крупнее.</figcaption>
 </figure>
 </div>
 <p class="source">Определение и подход: <a href="https://github.com/github/spec-kit/blob/main/spec-driven.md" target="_blank" rel="noopener noreferrer">GitHub Spec Kit · SDD</a>, <a href="https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md#specs" target="_blank" rel="noopener noreferrer">OpenSpec · требования и сценарии</a>.</p>
 </section>
 <section aria-labelledby="spec-contents"><h2 id="spec-contents">Б. Что обычно входит в спецификацию</h2>
 <p>Список вопросов, которые нужно закрыть для своей задачи. Раскрой пункт — внутри пояснение, пример из нашего трекера и исходные Markdown-документы.</p>
 <div class="spec-checklist">
 <details><summary><span class="spec-item-number">01</span><span>Цель и границы задачи<small>Для кого создаём систему и что входит в работу</small></span></summary>
 <div class="spec-item-body"><p>Какую задачу решает продукт, кто им пользуется, какой объём согласован и какие возможности остаются за его пределами.</p>
 <blockquote>У нас: локальный трекер задач и недельный планировщик нагрузки четырёх сотрудников. Бэкенд и авторизация в объём не входят.</blockquote>
 <div class="actions">${evidence('qspec-01','docs/BRIEF.md','Открыть BRIEF.md')}${evidence('qspec-01','openspec/changes/build-tracker/proposal.md','Открыть proposal.md')}</div></div></details>
 <details><summary><span class="spec-item-number">02</span><span>Функциональные требования<small>Что пользователь может сделать и как реагирует система</small></span></summary>
 <div class="spec-item-body"><p>Действия пользователя, ожидаемое поведение и переходы между состояниями: создание, изменение, удаление, поиск и другие функции продукта.</p>
 <blockquote>У нас: CRUD задач, три статуса, перенос карточек, переключение недель и предпросмотр распределения. Назначения меняются только после явного применения плана.</blockquote>
 <div class="actions">${evidence('qspec-01',specFile,'Открыть требования к функциям')}</div></div></details>
 <details><summary><span class="spec-item-number">03</span><span>Требования к интерфейсу<small>Экраны, взаимодействия, доступность и адаптивность</small></span></summary>
 <div class="spec-item-body"><p>Что видно пользователю, какие состояния нужны на экране, как работают формы и навигация, как пользоваться приложением с клавиатуры и на разных размерах экрана.</p>
 <blockquote>У нас: доска и представление по сотрудникам используют одни данные. На ширине 390, 768, 1100 и 1280 px нет горизонтального переполнения; нагрузка и прогресс видны, формы подписаны.</blockquote>
 <p>Отдельный контракт <code>INTERFACES.md</code> задаёт элементы и <code>data-testid</code> для повторяемых браузерных проверок.</p>
 <div class="actions">${evidence('qspec-11',specFile,'Открыть требования к UI')}${evidence('qspec-01','docs/INTERFACES.md','Открыть INTERFACES.md')}</div></div></details>
 <details><summary><span class="spec-item-number">04</span><span>Данные и бизнес-правила<small>Поля, формулы, связи и сохранение состояния</small></span></summary>
 <div class="spec-item-body"><p>Какие данные принимает и хранит система, какие правила остаются верными при изменениях и как вычисляются показатели.</p>
 <blockquote>У нас: нагрузка — незавершённые часы недели / доступные часы. Прогресс — выполненные часы / все назначенные часы недели. Поиск и фильтр карточек не меняют расчёт метрик.</blockquote>
 <p>Пример: у Марии выполнено 6 из 14 часов → прогресс 43%. Изменения сохраняются в <code>localStorage</code> и восстанавливаются после перезагрузки.</p>
 <div class="actions">${evidence('qspec-11',specFile,'Открыть правила данных и расчётов')}${evidence('qspec-01','docs/INTERFACES.md','Открыть контракт данных')}</div></div></details>
 <details><summary><span class="spec-item-number">05</span><span>Ограничения и ошибочные состояния<small>Допустимые значения и требования к качеству</small></span></summary>
 <div class="spec-item-body"><p>Условия работы, совместимость, требования к надёжности и другим свойствам системы, границы входных данных и реакция на ошибки. Конкретные ограничения выбирают под задачу.</p>
 <blockquote>У нас: только локальные ресурсы; оценка задачи — 0,5–168 часов с шагом 0,5. При ошибке форма остаётся открытой и сохраняет ввод. Нулевая доступность не даёт NaN/Infinity; повреждённое хранилище не вызывает падение.</blockquote>
 <div class="actions">${evidence('qspec-01','docs/BRIEF.md','Открыть исходные ограничения')}${evidence('qspec-11',specFile,'Открыть ошибки и граничные случаи')}</div></div></details>
 <details><summary><span class="spec-item-number">06</span><span>Критерии приёмки и сценарии<small>Как наблюдаемо проверить выполнение требования</small></span></summary>
 <div class="spec-item-body"><p>Условия, действие и конкретный ожидаемый результат. Для существенных правил описывают обычный путь и граничные случаи; по ним можно строить тесты и ручные проверки.</p>
 <blockquote><strong>WHEN</strong> пользователь создал задачу и перезагрузил страницу.<br><strong>THEN</strong> задача на месте.</blockquote>
 <p>В нашем <code>spec.md</code> требования помечены <code>MUST/SHALL</code>, а сценарии — <code>WHEN/THEN</code>.</p>
 <div class="actions">${evidence('qspec-01',specFile,'Открыть сценарии до реализации')}${evidence('qspec-11',specFile,'Открыть уточнённые сценарии')}</div></div></details>
 </div></section>
 <section aria-labelledby="spec-qwen"><h2 id="spec-qwen">В. Как это реализовано у нас</h2>
 <p>В прогоне <strong>Qwen 3.8 Flash + OpenSpec</strong> одна модель выполняла роли аналитика, дизайнера, разработчика и тестировщика. OpenSpec использовали для организации документов и оформления требований, OpenCode — как среду работы ролей.</p>
 <ol class="spec-practice">
 <li><strong>Постановка → спецификация.</strong> Аналитик прочитал <code>BRIEF.md</code>, <code>INTERFACES.md</code> и исходные данные, зафиксировал правила и сценарии до написания кода. Это <code>qspec-01</code>; после замечаний валидатора документы уточнили в <code>qspec-02</code>.</li>
 <li><strong>Спецификация → дизайн и код.</strong> Дизайнер подготовил план интерфейса и <code>design.md</code> в <code>qspec-03</code>. Разработчик в <code>qspec-04</code> получил требования, контракт, дизайн и список задач, реализовал приложение и запустил тесты.</li>
 <li><strong>Код → проверка по требованиям.</strong> Тестировщик сопоставлял приложение со сценариями, фиксировал замечания для исправления. Проверки логики и наблюдения в браузере записывались отдельно.</li>
 <li><strong>Обратная связь → уточнение документов.</strong> При исправлениях обновляли связанные требования и задачи. В <code>qspec-11</code> уточнили сценарии и <code>tasks.md</code>, сохранив непроверенные пункты открытыми.</li>
 </ol>
 <details class="spec-run-docs"><summary>Документы OpenSpec в нашем прогоне — открыть и показать</summary>
 <p>Материалы изменения лежат в <code>openspec/changes/build-tracker/</code>.</p>
 <div class="spec-document-list">
 <div><span><code>proposal.md</code><small>Зачем нужен трекер и что входит в изменение</small></span>${evidence('qspec-01','openspec/changes/build-tracker/proposal.md','Открыть предложение')}</div>
 <div><span><code>specs/tracker/spec.md</code><small>Требования и сценарии поведения</small></span><div class="actions">${evidence('qspec-01',specFile,'До кода')}${evidence('qspec-11',specFile,'После уточнений')}</div></div>
 <div><span><code>design.md</code><small>Технические решения и устройство интерфейса</small></span>${evidence('qspec-03','openspec/changes/build-tracker/design.md','Открыть дизайн')}</div>
 <div><span><code>tasks.md</code><small>Список работ и статус проверок</small></span>${evidence('qspec-11','openspec/changes/build-tracker/tasks.md','Открыть задачи')}</div>
 </div></details>
 <p class="spec-validation"><strong>Как проверяли:</strong> валидатор OpenSpec проверял структуру требований и сценариев. Тесты и браузерные действия проверяли поведение приложения.</p>
 </section>
 </article>`;
}
async function start(){window.name='vtb-comparison';const content=document.querySelector('#comparison-content'),dialog=document.querySelector('#evidence-dialog');let data;try{const response=await fetch('/api/workshop');if(!response.ok)throw new Error(response.status);data=await response.json();data.legacyQwen=await fetch('/api/legacy-qwen').then(r=>r.ok?r.json():null).catch(()=>null);}catch(err){content.textContent='Не удалось загрузить метрики. Проверь, что локальный пульт работает: '+err.message;return;}
 const sections=[['spec-driven','Spec-driven'],['review','Роли и ошибки'],['conclusion','Выводы'],['compare-all','Результаты']];
 function render(){
  if(dialog.open)dialog.close();
  const requested=location.hash.slice(1)||'spec-driven',mode=requested==='metrics'?'conclusion':comparisonSection(requested)||'spec-driven';if(mode!==requested)history.replaceState(null,'','#'+mode);
  document.body.classList.toggle('conclusion-page',mode==='conclusion');
  document.body.classList.toggle('spec-driven-page',mode==='spec-driven');
  const section=mode.startsWith('compare')?'compare-all':mode;
  document.querySelector('#comparison-route').innerHTML=sections.map(([id,label,group])=>(group?'<div class="group">'+e(group)+'</div>':'')+'<a href="#'+id+'" '+(section===id?'class="active" aria-current="page"':'')+'>'+e(label)+'</a>').join('');
  const title=sections.find(([id])=>id===section)?.[1]||'Сравнение';
  if(mode.startsWith('compare'))content.innerHTML=compare(data,mode);
  else if(mode==='spec-driven')content.innerHTML=specDrivenHTML(data);
  else {const body=mode==='review'?reviewHTML(data):mode==='metrics'?metricsHTML(data):mode==='conclusion'?conclusionHTML(data):extraPage(mode,data);content.innerHTML='<p class="eyebrow">Общие материалы демонстрации</p><h1>'+e(title)+'</h1>'+body;}
  const index=sections.findIndex(([id])=>id===section);
  content.insertAdjacentHTML('beforeend','<nav class="section-pager" aria-label="Следующий общий раздел">'+(index>0?'<a href="#'+sections[index-1][0]+'">← '+e(sections[index-1][1])+'</a>':'<span></span>')+(index<sections.length-1?'<a href="#'+sections[index+1][0]+'">'+e(sections[index+1][1])+' →</a>':'')+'</nav>');
  document.querySelectorAll('header a').forEach(a=>{if(a.href.includes('profile=claude'))a.textContent='Qwen + OpenSpec';if(a.href.includes('profile=qwen'))a.textContent='Qwen без спеки';});document.title=title;window.scrollTo(0,0);
 }
 document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-evidence]');if(!b)return;const [id,...file]=b.dataset.evidence.split('/');document.querySelector('#evidence-title').textContent=id+' · '+file.join('/');const body=document.querySelector('#evidence-body');body.textContent='Загрузка…';dialog.showModal();try{const response=await fetch('/recorded/'+id+'/code/'+file.map(encodeURIComponent).join('/'));if(!response.ok)throw new Error(response.status);const text=await response.text();body.innerHTML=file.at(-1).endsWith('.md')?markdown(text):'<pre>'+e(text)+'</pre>';}catch(err){body.textContent='Не удалось открыть файл: '+err.message;}});
 document.querySelector('#close-evidence').addEventListener('click',()=>dialog.close());window.addEventListener('hashchange',render);render();
}
if(document.body.dataset.page==='comparison')start();
