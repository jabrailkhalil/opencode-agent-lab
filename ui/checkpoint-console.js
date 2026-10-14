import {resultFor,modelComparison,tourFor,roleSetup,runPricing} from './checkpoint-results.js';
import {markdown,escapeHtml as esc} from './checkpoint-markdown.js';
import {flowFor,nextPrompt,roleLabels} from './demo-flow.js';

const $=selector=>document.querySelector(selector);
new ResizeObserver(entries=>document.documentElement.style.setProperty('--header-height',entries[0].target.getBoundingClientRect().height+'px')).observe($('header'));
new ResizeObserver(entries=>document.documentElement.style.setProperty('--stage-height',entries[0].target.getBoundingClientRect().height+'px')).observe($('.stage'));
new ResizeObserver(entries=>document.documentElement.style.setProperty('--tour-height',entries[0].target.getBoundingClientRect().height+'px')).observe($('#material-tour'));
const params=new URLSearchParams(location.search);
let profile=params.get('profile')==='qwen'?'qwen':'claude',mode=params.get('mode')==='errors'?'errors':'base',tab='result',data=null,working=false,polling=false,loadSerial=0,documentSerial=0,currentFile=null;
let tourIndex=0,tourKey='',tourSerial=0,tourLoading=false;
let finalMetrics=location.hash==='#metrics';
let page=finalMetrics?'metrics':location.hash==='#setup'?'setup':/^#(claude|qwen|error|ui-review)-/.test(location.hash)?'stage':'overview';
let selectedId=page==='stage'?location.hash.slice(1):null;
const active=()=>data?.points[data.index];
const count=n=>n==null?'—':new Intl.NumberFormat('ru-RU').format(n);
const duration=ms=>ms==null?'—':Math.floor(ms/60000)+' мин '+Math.round(ms%60000/1000)+' с';
const artifact=(point,folder,file)=>'/recorded/'+point.id+'/'+folder+'/'+file.split('/').map(encodeURIComponent).join('/');
const picture=point=>point?.screenshots.find(file=>/^application(?:-full)?\.png$/.test(file))||point?.screenshots.find(file=>file.startsWith('application'));
const remember=()=>history.replaceState(null,'','?profile='+profile+'&mode='+mode+'#'+(page==='stage'?active()?.id||'overview':page));
function status(message,error=false){$('#status').textContent=message;$('#status').classList.toggle('error',error);}
function buttons(){
 document.querySelectorAll('#steps button,#next,#previous,#reset,#restore-selected,#setup-reset,[data-profile],#mode,#native-mode').forEach(el=>el.disabled=working);
 $('#previous').disabled=working||!data||page==='overview';
 $('#previous').textContent='←';
 $('#next').disabled=working||!data||page==='metrics';
 $('#next').textContent=page==='overview'?'Как это устроено →':page==='setup'?'К требованиям →':data?.index===data?.points.length-1?'Метрики →':'Далее →';
 $('#next').title='Следующий экран. Файлы проекта и очередь OpenCode не меняются.';
}
function fileButton(file){return '<button class="file-button" data-open-file="'+esc(file.path)+'"><span>'+esc(file.label)+'</span><small>'+esc(file.path)+'</small></button>';}
function bindFileButtons(root){root.querySelectorAll('[data-open-file]').forEach(button=>button.onclick=()=>openFile(button.dataset.openFile));}
function render(){
 const point=active(),result=resultFor(point);
 $('#model').textContent='Команда: '+data.model;
 $('#native-mode').value=data.openCodeMode;$('#mode').value=mode;
 $('#opencode').href=data.opencodeUrl;$('#external-product').href='/preview/'+point?.id+'/';
 document.querySelectorAll('[data-profile]').forEach(button=>button.classList.toggle('selected',button.dataset.profile===profile));
 const prompts=flowFor(profile).filter(s=>s.type==='prompt');
 $('#steps').innerHTML='<button id="overview-step" class="'+(page==='overview'?'selected':'')+'"><span>◈</span><div><b>Что получилось</b><small>Два результата рядом</small></div></button><button id="setup-step" class="'+(page==='setup'?'selected':'')+'"><span>⚙</span><div><b>Настройка '+(profile==='claude'?'Claude':'Qwen')+'</b><small>Модель · роли · права</small></div></button><div class="nav-section">'+(profile==='claude'?'Claude':'Qwen')+' / '+(mode==='base'?'Путь разработки':'Учебные сцены')+'</div>'+data.points.map((point,index)=>{const n=prompts.findIndex(s=>s.id===point.id);return '<button data-id="'+point.id+'" class="'+(page==='stage'&&data.index===index?'selected ':'')+(point.id===data.current?.checkpoint?'running':'')+'"><span>'+(n<0?'·':String(n+1).padStart(2,'0'))+'</span><div><b>'+esc(point.title)+'</b><small>'+esc(point.roleName)+(n>=0?' · запрос '+(n+1):' · просмотр')+'</small></div></button>';}).join('')+'<div class="nav-section">Сравнение</div><button id="final-metrics-step" class="'+(finalMetrics?'selected':'')+'"><span>↗</span><div><b>Метрики и стоимость</b><small>Токены · время · качество</small></div></button>';
 $('#steps').querySelectorAll('[data-id]').forEach(button=>button.onclick=()=>inspect(button.dataset.id));
 $('#overview-step').onclick=()=>openPage('overview');$('#setup-step').onclick=()=>openPage('setup');
 $('#final-metrics-step').onclick=openFinalMetrics;
 const promptIndex=prompts.findIndex(s=>s.id===point?.id);
 $('#number').textContent=point?point.id+' · '+(promptIndex>=0?'запрос '+(promptIndex+1)+' из '+prompts.length:'экран просмотра'):'Выбери первый этап';
 $('#title').textContent=point?.title||'Маршрут готов';
 $('#role').textContent=point?point.roleName+' · '+(point.kind==='prepared-error'?'учебная сцена':'сохранённый этап')+(point.recordedModel?' · '+point.recordedModel:''):'';
 $('#stage-summary').hidden=false;$('#quick-files').hidden=false;$('.tabs').hidden=false;
 $('#stage-summary').innerHTML='<p>'+esc(result.summary)+'</p>'+(result.note?'<p class="stage-note">'+esc(result.note)+'</p>':'');
 $('#quick-files').innerHTML=result.files.map(fileButton).join('')+(point?.application?'<button id="quick-product" class="file-button product-button"><span>Открыть приложение</span><small>Версия '+esc(point.id)+'</small></button>':'');
 bindFileButtons($('#quick-files'));if($('#quick-product'))$('#quick-product').onclick=()=>showTab('product');
 $('#result').innerHTML=markdown(point?.output||'В исходной папке подготовлены требования и тесты. Приложение ещё не создано.','answer-heading');
 const finding=point?.finding;
 $('#finding').innerHTML=finding?'<b>'+esc(finding.title)+'</b><p>'+esc(finding.fact)+'</p><p><strong>Что сделали:</strong> '+esc(finding.action)+'</p><p><strong>Проверка:</strong> '+esc(finding.verification)+'</p>':'';
 const usage=point?.usage;
 $('#metrics').innerHTML=point?'<span>'+(point.timeBasis==='stage'?'Время этапа':'От начала записанного прогона')+': <b>'+duration(point.elapsedMs)+'</b></span>'+(usage?.inputTokens!=null?'<span>Вход: <b>'+count(usage.inputTokens)+'</b></span><span>Выход: <b>'+count(usage.outputTokens)+'</b></span><span>Выход / время этапа: <b>'+(usage.outputTokensPerSecond==null?'—':usage.outputTokensPerSecond.toFixed(1))+' ток/с</b></span>':'')+'<span>Вызовов модели при переходе: <b>0</b></span>':'';
 $('#files').innerHTML=point?['reports','docs','dist','tests'].map(folder=>{
  const list=point.files.filter(file=>file.startsWith(folder+'/')&&!file.startsWith('dist/vendor/'));
  return list.length?'<section class="file-group"><h2>'+esc(folder)+'</h2><div class="file-grid">'+list.map(path=>fileButton({path,label:path.split('/').pop()})).join('')+'</div></section>':'';
 }).join(''):'Выбери этап слева.';
 bindFileButtons($('#files'));renderScreens();renderComparison();renderRoles();
 $('#overview-panel').hidden=page!=='overview';$('#stage-content').hidden=page==='overview';
 $('#restore-selected').disabled=working;
 showTab(tab);buttons();remember();void refreshOpenCodeLink(profile);
 if(page==='overview'){renderOverview();return;}
 if(page==='setup'){renderSetup();return;}
 if(finalMetrics){renderFinalMetrics();return;}
 const nextTourKey=profile+':'+mode+':'+point?.id;
 if(nextTourKey!==tourKey){tourKey=nextTourKey;tourIndex=0;void showMaterial(0);}else renderTour();
}
function openFinalMetrics(){
 if(working||!data)return;
 page='metrics';finalMetrics=true;tourSerial++;documentSerial++;tourLoading=false;clearFocus();render();
 window.scrollTo({top:0});
}
function renderFinalMetrics(){
 $('#number').textContent='Итог · два сохранённых прогона';
 $('#title').textContent='Метрики и стоимость';
 $('#role').textContent='Claude Sonnet 5.5 и Qwen3 Coder · все учтённые запросы, включая повторные этапы';
 $('#material-tour').hidden=true;$('#stage-summary').hidden=true;$('#quick-files').hidden=true;$('.tabs').hidden=true;
 showTab('comparison');
 status('Расчёт без скидки за кэш · тарифы сохранённых прогонов · просмотр не меняет проект');
}
async function refreshOpenCodeLink(requestedProfile){
 try{const response=await fetch('/api/opencode-link?profile='+requestedProfile),link=await response.json();if(response.ok&&profile===requestedProfile)$('#opencode').href=link.href;}catch{}
}
function showTab(selected){
 tab=selected==='document'&&!currentFile?'result':selected;
 document.querySelectorAll('[data-tab]').forEach(button=>button.classList.toggle('selected',button.dataset.tab===tab));
 for(const name of ['result','product','files','screens','comparison','document','roles'])$('#'+name+'-panel').hidden=name!==tab;
 if(tab==='product'){
  const point=active();
  if(point?.application){const src='/preview/'+point.id+'/';if($('#product').getAttribute('src')!==src){$('#product').removeAttribute('srcdoc');$('#product').src=src;}}
  else{$('#product').removeAttribute('src');$('#product').srcdoc='<html lang="ru"><body style="font:20px Segoe UI;padding:40px;color:#66778d"><h2>Готового приложения на этом этапе ещё нет</h2><p>Результат роли и доступные файлы находятся во вкладках пульта.</p></body></html>';}
 }
}
function clearDocument(){currentFile=null;documentSerial++;$('#document-tab').hidden=true;$('#document-content').innerHTML='';if(tab==='document')tab='result';}
async function openFile(path,options={}){
 const point=active();if(!point||!point.files.includes(path))return;
 const request=++documentSerial,source=artifact(point,'code',path),known=resultFor(point).files.find(file=>file.path===path);
 currentFile=path;$('#document-tab').hidden=false;$('#document-tab').textContent=path.split('/').pop();$('#document-title').textContent=point.id+' / '+path;$('#document-source').href=source;
 $('#document-content').textContent='Открываем файл…';$('#document-sections').innerHTML='';showTab('document');
 try{
  if(/\.(png|jpe?g|webp|svg)$/i.test(path))$('#document-content').innerHTML='<a target="_blank" rel="noopener" href="'+source+'"><img class="document-image" src="'+source+'" alt="'+esc(path)+'"></a>';
  else{
   const response=await fetch(source);if(!response.ok)throw new Error('Файл недоступен');let text=await response.text();
   if(request!==documentSerial||active()?.id!==point.id)return;
   if(path.endsWith('.md'))$('#document-content').innerHTML=markdown(text);
   else{if(path.endsWith('.json')){try{text=JSON.stringify(JSON.parse(text),null,2);}catch{}}$('#document-content').innerHTML='<pre class="source-code"><code>'+esc(text)+'</code></pre>';}
   const headings=[...$('#document-content').querySelectorAll('[data-document-heading]')];
   const selected=known?.sections?.length?known.sections.map(section=>headings.find(heading=>heading.textContent.toLowerCase().includes(section.toLowerCase()))).filter(Boolean):headings.filter(heading=>heading.tagName==='H2').slice(0,6);
   $('#document-sections').innerHTML=[...new Set(selected)].map(heading=>'<button data-section="'+heading.id+'">'+esc(heading.textContent)+'</button>').join('');
   $('#document-sections').querySelectorAll('button').forEach(button=>button.onclick=()=>document.getElementById(button.dataset.section).scrollIntoView({block:'start',behavior:'smooth'}));
  }
  if(options.scroll!==false)$('#document-panel').scrollIntoView({block:'start',behavior:'smooth'});
  return true;
 }catch(error){if(request===documentSerial)$('#document-content').textContent=error.message;return false;}
}

const normalized=value=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase().replaceAll('ё','е');
function renderTour(){
 const cards=tourFor(active()),card=cards[tourIndex];$('#material-tour').hidden=!card;if(!card)return;
 $('#tour-number').textContent='Внутри этапа · '+(tourIndex+1)+' / '+cards.length;
 $('#tour-title').textContent=card.title;
 $('#tour-say').textContent=card.say;
 $('#tour-previous').disabled=tourLoading||tourIndex===0;
 $('#tour-next').disabled=tourLoading||tourIndex===cards.length-1;
 $('#tour-finish').textContent=tourIndex===cards.length-1?'Последний материал этапа.':'Стрелки листают только материалы этого этапа.';
}
function clearFocus(){
 document.querySelectorAll('.tour-focus').forEach(node=>node.classList.remove('tour-focus'));
 document.querySelectorAll('mark.tour-code-focus').forEach(node=>{const parent=node.parentNode;node.replaceWith(document.createTextNode(node.textContent));parent.normalize();});
 try{$('#product').contentDocument?.querySelectorAll('[data-demo-focus]').forEach(node=>node.removeAttribute('data-demo-focus'));}catch{}
}
function scrollMaterialTarget(target){
 if(!target)return;
 document.documentElement.style.setProperty('--tour-height',$('#material-tour').getBoundingClientRect().height+'px');
 document.documentElement.style.setProperty('--stage-height',$('.stage').getBoundingClientRect().height+'px');
 target.scrollIntoView({block:'start'});
}
function highlightText(root,needles){
 if(!root)return [];
 const found=[];
 for(const needle of needles||[]){
  const term=normalized(needle);
  const candidates=[...root.querySelectorAll('p,li,td,th,h1,h2,h3,h4,blockquote')].filter(node=>normalized(node.textContent).includes(term));
  const node=candidates.sort((a,b)=>a.textContent.length-b.textContent.length)[0];
  if(node){
   const target=node.closest('tr')||node;target.classList.add('tour-focus');found.push(target);
   if(/^H[1-6]$/.test(node.tagName)){
    let following=node.nextElementSibling;
    for(let count=0;following&&count<2&&!/^H[1-6]$/.test(following.tagName);count++,following=following.nextElementSibling){following.classList.add('tour-focus');found.push(following);}
   }
   continue;
  }
  const code=root.querySelector('pre code');
  if(code?.firstChild?.nodeType===Node.TEXT_NODE){
   const content=code.textContent,position=content.toLowerCase().indexOf(String(needle).toLowerCase());
   if(position>=0){const start=content.lastIndexOf('\n',position)+1,end=content.indexOf('\n',position);const range=document.createRange();range.setStart(code.firstChild,start);range.setEnd(code.firstChild,end<0?content.length:end);const mark=document.createElement('mark');mark.className='tour-code-focus';range.surroundContents(mark);found.push(mark);break;}
  }
 }
 return [...new Set(found)];
}
function focusProduct(card,request){
 if(request!==tourSerial)return;
 try{
  const frame=$('#product'),doc=frame.contentDocument;if(!doc||!doc.querySelector('[data-testid="app"]'))return;
  let style=doc.getElementById('demo-material-focus-style');
  if(!style){style=doc.createElement('style');style.id='demo-material-focus-style';style.textContent='[data-demo-focus]{outline:2px solid #879ccf!important;outline-offset:3px!important;scroll-margin:24px!important;}';doc.head.append(style);}
  doc.querySelectorAll('[data-demo-focus]').forEach(node=>node.removeAttribute('data-demo-focus'));
  const nodes=(card.selectors||[]).map(selector=>doc.querySelector(selector)).filter(Boolean);
  nodes.forEach(node=>node.setAttribute('data-demo-focus','true'));
  if(nodes[0]){const pos=nodes[0].getBoundingClientRect();if(pos.top<0||pos.bottom>frame.clientHeight)nodes[0].scrollIntoView({block:'center'});}
  $('#tour-focus-text').textContent=nodes.length?'Выделено в приложении: '+nodes.map(node=>(node.textContent||node.getAttribute('aria-label')||node.value||'').trim()).filter(Boolean).join(' · ').slice(0,240):'Открыта версия приложения текущего этапа.';
 }catch{$('#tour-focus-text').textContent='Открыта версия приложения текущего этапа.';}
}
async function showMaterial(index){
 const request=++tourSerial,point=active(),cards=tourFor(point),card=cards[index];if(!card){tourLoading=false;$('#material-tour').hidden=true;return;}
 tourIndex=index;tourLoading=true;clearFocus();renderTour();
 $('#tour-focus-text').textContent='Открываем материал…';
 try{
  let found=[],root;
  if(card.kind==='file'){
   const opened=await openFile(card.path,{scroll:false});if(request!==tourSerial)return;
   if(!opened){$('#tour-focus-text').textContent='Не удалось открыть файл. Другие материалы доступны обычными кнопками.';return;}
   root=$('#document-content');found=highlightText(root,card.focus);
  }else if(card.kind==='product'){
   showTab('product');$('#tour-focus-text').textContent='Акцент в приложении: '+card.title;
   const frame=$('#product');frame.onload=()=>{if(request===tourSerial&&tab==='product')focusProduct(card,request);};focusProduct(card,request);
   return;
  }else if(card.kind==='screens'){
   showTab('screens');const file=picture(point);root=$('#screens');
   const link=[...root.querySelectorAll('a')].find(node=>node.getAttribute('href')===artifact(point,'screenshots',file||''));
   const frame=link?.closest('figure');if(frame){frame.classList.add('tour-focus');found=[frame];}
  }else if(card.kind==='roles'){
   showTab('roles');root=$('#roles-content');found=highlightText(root,card.focus);
  }else if(card.kind==='comparison'){
   showTab('comparison');root=$('#comparison');found=highlightText(root,card.focus);
  }else{
   showTab('result');root=$('#stage-summary');root.classList.add('tour-focus');found=[root];
  }
  if(request!==tourSerial)return;
  $('#tour-focus-text').textContent=found.length?'Акцент: '+found.map(node=>node.textContent.trim()).join(' ').replace(/\s+/g,' ').slice(0,360):'Открыт материал: '+(card.path||card.title);
  // Keep the material controls in place; the selected document is already visible below.
 }catch(error){if(request===tourSerial)$('#tour-focus-text').textContent='Материал доступен во вкладках ниже: '+error.message;}
 finally{if(request===tourSerial){tourLoading=false;renderTour();}}
}
$('#tour-previous').onclick=()=>{if(!tourLoading)void showMaterial(tourIndex-1);};
$('#tour-next').onclick=()=>{if(!tourLoading)void showMaterial(tourIndex+1);};
$('#tour-speaker').ontoggle=()=>scrollMaterialTarget(document.querySelector('.tour-focus')||(tab==='product'?$('#product-panel'):null));
function renderRoles(){
 const model=profile==='claude'?'openrouter/anthropic/claude-sonnet-5.5':'openrouter/qwen/qwen3-coder';
 $('#roles-content').innerHTML='<h2>Четыре роли — одна модель в каждой команде</h2><p>Роли загружены из <code>opencode.json</code> этого проекта. У каждой — отдельная инструкция, разрешённые действия и лимит шагов. В команде Claude все роли используют Claude, в команде Qwen — Qwen.</p><p>Роль выбирается в OpenCode под полем сообщения. Передача идёт через файлы: требования → анализ → план интерфейса → код → проверка. Следующего участника выбирает ведущий; самостоятельный вызов других агентов отключён.</p><div class="table-scroll"><table><thead><tr><th>Роль в OpenCode</th><th>Задача</th><th>Результат</th><th>Лимит шагов</th></tr></thead><tbody>'+roleSetup.map(role=>'<tr><td><b>'+esc(role.label)+'</b><br>'+esc(role.name)+'</td><td>'+esc(role.task)+'</td><td>'+role.outputs.map(esc).join('<br>')+'</td><td>'+role.steps+'</td></tr>').join('')+'</tbody></table></div><h3>Настройка выбранной команды</h3><p><b>Модель для живого API:</b> <code>'+esc(model)+'</code><br><b>Температура:</b> '+(profile==='qwen'?'1 — явно задана для всех четырёх ролей. В пресете модели: top_p = 0,95; top_k = 40.':'не задана в конфигурации; применяется поведение модели и провайдера.')+'<br><b>Тип ролей:</b> <code>primary</code> — доступны для ручного выбора в чате.</p><p>Температура задаёт случайность выбора продолжения, если модель поддерживает этот параметр. Лимит шагов ограничивает длину агентного цикла одного запроса; это не число токенов.</p><p class="role-mode-note"><b>Сейчас:</b> '+(data.openCodeMode==='recording'?'сохранённый прогон. Вместо внешнего API подключён локальный источник ответов. Шаги идут строго по очереди. Неверная роль не меняет этап; новая генерация не запускается.':'живой API. Выбранная модель получает новый запрос и выполняет действия в рабочей папке.')+'</p><h3>Инструкции и разрешения ролей</h3>'+roleSetup.map(role=>'<details class="role-details"><summary>'+esc(role.label)+' · '+esc(role.name)+'</summary><p><b>Файл инструкции:</b> <code>prompts/'+role.id+'.txt</code></p><p><b>Суть инструкции:</b> '+esc(role.instruction)+'</p><p><b>Разрешённые действия:</b> '+esc(role.permissions)+'</p><p><b>Предмет проверки:</b> '+esc(role.finding)+'</p><p><b>Фрагмент настройки модели и инструкции:</b></p><pre class="source-code"><code>'+esc(JSON.stringify({[role.id]:{mode:'primary',model,...(profile==='qwen'?{temperature:1}:{}),steps:role.steps,prompt:'{file:./prompts/'+role.id+'.txt}'}},null,2))+'</code></pre></details>').join('')+'<h3>Единый формат находки</h3><p>Что найдено → вход и шаги → ожидание и факт → доказательство → причина или гипотеза → владелец исправления → повторная проверка PASS / FAIL / NOT RUN.</p><p>Конфигурация живого API сохранена в <code>opencode.live-api.json</code>. В режиме записи активный <code>opencode.json</code> использует локальные модели с пометкой «запись». Инструкции ролей находятся в <code>prompts/</code>.</p>';
}
function renderScreens(){
 const point=active();if(!point){$('#screens').textContent='Выбери этап слева.';return;}
 const currentPicture=picture(point),previous=['claude-ui-fix','claude-ui-pass'].includes(point.id)?data.points.find(p=>p.id==='claude-ui-qa'):data.points.slice(0,data.index).reverse().find(candidate=>candidate.application&&picture(candidate));
 const frame=(candidate,file,label)=>'<figure><figcaption>'+esc(label)+' · '+esc(candidate.id)+'</figcaption><a target="_blank" rel="noopener" href="'+artifact(candidate,'screenshots',file)+'"><img loading="lazy" src="'+artifact(candidate,'screenshots',file)+'" alt="'+esc(label)+'"></a></figure>';
 const pair=currentPicture&&previous?'<h2>До и после</h2><p class="panel-caption">'+(point.id.startsWith('claude-ui-')?'Исходный дефект и исправленная раскладка на 1280 px.':'Скриншоты соседних сохранённых версий.')+' Клик открывает оригинал.</p><div class="screen-pair">'+frame(previous,picture(previous),'До')+frame(point,currentPicture,'После')+'</div>':'';
 const screenshots=point.screenshots.filter(file=>!pair||file!==currentPicture).map(file=>frame(point,file,file.startsWith('application')?'Интерфейс приложения':'Сохранённый экран прогона')).join('');
 const reportImages=point.files.filter(file=>/\.(png|jpe?g|webp)$/i.test(file)&&file.startsWith('reports/')).map(file=>'<details class="screen-detail"><summary>'+esc(file)+'</summary><a target="_blank" rel="noopener" href="'+artifact(point,'code',file)+'"><img loading="lazy" src="'+artifact(point,'code',file)+'" alt="'+esc(file)+'"></a></details>').join('');
 $('#screens').innerHTML=pair+(screenshots?'<h2>Другие скриншоты этапа</h2><div class="screen-grid">'+screenshots+'</div>':pair?'':'<p>На этом этапе отдельного скриншота приложения нет.</p>')+(reportImages?'<details class="screen-detail"><summary>Скриншоты в отчётах</summary>'+reportImages+'</details>':'');
}
function renderComparison(){
 const models=runPricing.models,claude=models.claude,qwen=models.qwen;
 const usd=value=>'$'+new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
 const rate=value=>'$'+new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:3}).format(value);
 const range=(model,key)=>{const values=model.tariffs.map(row=>row[key]),low=Math.min(...values),high=Math.max(...values);return low===high?rate(low):rate(low)+'–'+rate(high);};
 const priceRows=[
  ['Входные токены',count(claude.inputTokens),count(qwen.inputTokens)],
  ['Выходные токены',count(claude.outputTokens),count(qwen.outputTokens)],
  ['Цена 1 млн входных токенов',range(claude,'inputRate'),range(qwen,'inputRate')],
  ['Цена 1 млн выходных токенов',range(claude,'outputRate'),range(qwen,'outputRate')],
  ['Стоимость входа',usd(claude.inputCost),usd(qwen.inputCost)],
  ['Стоимость выхода',usd(claude.outputCost),usd(qwen.outputCost)],
  ['Всего без скидки за кэш',usd(claude.totalCost),usd(qwen.totalCost)],
  ['Запросы, вошедшие в стоимость',count(claude.requests),count(qwen.requests)]
 ];
 const table=(head,rows)=>'<div class="table-scroll"><table><thead><tr>'+head.map(cell=>'<th>'+esc(cell)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+esc(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 const tariffs=Object.entries(models).flatMap(([name,model])=>model.tariffs.map(row=>[name==='claude'?'Claude':'Qwen',row.provider,count(row.requests),rate(row.inputRate),rate(row.outputRate),count(row.inputTokens),count(row.outputTokens),usd(row.totalCost)]));
 $('#comparison').innerHTML='<div class="cost-heroes"><article><span>Claude Sonnet 5.5</span><strong>'+usd(claude.totalCost)+'</strong><small>'+count(claude.requests)+' запроса · полный прогон</small></article><article><span>Qwen3 Coder</span><strong>'+usd(qwen.totalCost)+'</strong><small>'+count(qwen.requests)+' запроса · полный прогон</small></article></div><p class="panel-caption">Пересчёт без скидки за кэш по сохранённым запросам, включая повторные вызовы и исправления. '+esc(runPricing.basis)+'</p><h2>Токены и их стоимость</h2>'+table(['Показатель','Claude','Qwen'],priceRows)+'<p class="cost-formula"><b>Claude:</b> 6,392108 млн × $2 + 0,173956 млн × $10 = <b>$14,523776</b>.<br><b>Qwen:</b> сумма стоимости каждого запроса по его провайдеру = <b>$17,304976175</b>. Единого тарифа в этом прогоне не было.</p><details class="checkpoint-explanation"><summary>Тарифы и объём токенов по провайдерам</summary><p>Цены в USD за 1 млн токенов. Для Qwen тарифы сверены с сохранёнными начислениями; у Alibaba подтверждены две пары ставок. Вход DeepInfra пересчитан по обычной цене $0,30 за миллион без скидки за кэш.</p>'+table(['Модель','Провайдер','Запросы','Вход / 1 млн','Выход / 1 млн','Входных токенов','Выходных токенов','Сумма без кэша'],tariffs)+'<p class="panel-caption">Источник: '+esc(runPricing.source)+'. В итог входят 727 запросов с данными о стоимости. Новый сегодняшний показ сохранённых ответов в эту сумму не добавляет запросы к моделям.</p></details><h2>Время, скорость и качество</h2>'+table(['Показатель','Claude','Qwen'],modelComparison)+'<p class="panel-caption">Стоимость — расчёт без кэша, включая повторные вызовы. Скорость — выходные токены / полное время с инструментами и ожиданием, не чистая скорость генерации. Дополнительный Qwen 19/19 получен после уточнения жеста проверки человеком. Итоговые суммы относятся к сохранённым прогонам, а не к новому запуску.</p><details class="checkpoint-explanation"><summary>Что сохраняется в чекпоинте</summary><p>Версия кода, документы, отчёты, сохранённые ответы и скриншоты. Перед восстановлением сохраняется текущая версия рабочей папки. После восстановления файлы проверяются по SHA-256. Переключение само по себе не вызывает модель.</p><p>Пульт показывает сохранённые результаты. Новую доработку выполняют в OpenCode через живой API.</p></details>';
}
function syncStatus(){
 const step=nextPrompt(profile,data.current?.checkpoint||profile+'-00');
 status('OpenCode: '+(data.current?.checkpoint||'чистый старт')+(step?' · следующий '+(roleLabels[step.role]||step.role)+' → '+step.id:' · последовательность завершена')+(page==='stage'&&active()?.id!==data.current?.checkpoint?' · просмотр другой версии':''));
}
function openPage(name){
 if(working||!data)return;
 page=name;finalMetrics=name==='metrics';tourSerial++;documentSerial++;tourLoading=false;clearFocus();render();syncStatus();window.scrollTo({top:0});
}
function inspect(id){
 if(working||!id)return;
 const index=data.points.findIndex(p=>p.id===id);if(index<0)return;
 selectedId=id;data.index=index;page='stage';finalMetrics=false;clearDocument();tab='result';tourSerial++;tourKey='';render();syncStatus();window.scrollTo({top:0});
}
function renderOverview(){
 $('#number').textContent='Один продукт / две команды';$('#title').textContent='Что получилось';$('#role').textContent='Сначала результат, затем путь от требований до проверки';
 const names={claude:'Claude Sonnet 5.5',qwen:'Qwen3 Coder'};
 $('#overview-panel').innerHTML='<div class="hero-kicker">Трекер задач + планировщик команды</div><p class="hero-description">Готовый трекер, нагрузка и прогресс команды. Сравним две реализации, затем пройдём путь разработки.</p><div class="result-cards">'+['claude','qwen'].map(p=>'<article class="result-card"><div class="result-card-top"><h3>'+names[p]+'</h3><span>4 роли</span></div><div class="mini-metrics"><div><strong>'+(p==='claude'?'34:38':'65:35')+'</strong><span>время исходного прогона</span></div><div><strong>$'+runPricing.models[p].totalCost.toFixed(2).replace('.',',')+'</strong><span>пересчёт без кэша</span></div></div><p>'+(p==='claude'?'Исходная приёмка: 19/19. После репетиции добавлена проверка и коррекция вёрстки.':'Исходная приёмка: 18/19. Отдельный прогон точным жестом: 19/19 на том же коде.')+'</p><button data-final-preview="'+p+'">Посмотреть результат ↗</button></article>').join('')+'</div><div class="overview-toolbar"><div><h2 id="overview-app-title"></h2><p id="overview-app-note"></p></div><button id="overview-open-app">Открыть на весь экран ↗</button></div><iframe id="overview-product" title="Готовый продукт"></iframe><p class="evidence-note">Сохранённые версии открываются независимо от текущего шага в OpenCode. Дополнительная сцена UI не включена в замеры исходных прогонов.</p>';
 const preview=p=>{const id=p==='claude'?'claude-ui-pass':'qwen-15';$('#overview-app-title').textContent=names[p]+' / итоговый интерфейс';$('#overview-app-note').textContent=p==='claude'?'Версия с дополнительным исправлением панели управления':'Финальная сохранённая версия';$('#overview-product').src='/preview/'+id+'/';$('#overview-open-app').onclick=()=>window.open('/preview/'+id+'/','_blank','noopener');document.querySelectorAll('[data-final-preview]').forEach(b=>b.classList.toggle('selected',b.dataset.finalPreview===p));};
 document.querySelectorAll('[data-final-preview]').forEach(b=>b.onclick=()=>preview(b.dataset.finalPreview));preview(profile);
}
function renderSetup(){
 const name=profile==='claude'?'Claude':'Qwen';
 $('#number').textContent='Подготовка / '+name;$('#title').textContent='Модель и четыре роли';$('#role').textContent=name+' · отдельный проект и независимая очередь шагов';
 $('#material-tour').hidden=true;$('#stage-summary').hidden=true;$('#quick-files').hidden=true;$('.tabs').hidden=true;showTab('roles');
 $('#roles-content').insertAdjacentHTML('afterbegin','<div class="setup-start"><button id="setup-reset" class="primary">Подготовить чистый старт '+name+'</button><p>Восстанавливает требования и тесты в проекте '+name+'. Переписка OpenCode сохраняется. Следующий запрос — Analyst.</p></div>');
 $('#setup-reset').onclick=()=>{mode='base';void jump(profile+'-00');};
}
$('#restore-selected').onclick=()=>jump(active()?.id);
$('#follow-current').onclick=async()=>{if(!data.current?.checkpoint)return;mode=/^(error-|ui-review-)/.test(data.current.checkpoint)?'errors':'base';selectedId=data.current.checkpoint;page='stage';finalMetrics=false;tourKey='';await load();syncStatus();};

async function load(){
 const serial=++loadSerial,requestedProfile=profile,requestedMode=mode;
 const response=await fetch('/api/state?profile='+requestedProfile+'&mode='+requestedMode),value=await response.json();
 if(!response.ok)throw new Error(value.error);
 if(serial!==loadSerial||requestedProfile!==profile||requestedMode!==mode)return;
 const changed=data?.profile!==value.profile||data?.current?.version!==value.current?.version;
 if(changed)clearDocument();data=value;
 const selected=data.points.findIndex(p=>p.id===selectedId);data.index=selected>=0?selected:Math.max(0,data.index);
 render();
}
async function jump(id){
 if(working||!id)return;working=true;buttons();status('Загружаем '+id+'…');
 try{const response=await fetch('/api/apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile,checkpoint:id})}),applied=await response.json();if(!response.ok)throw new Error(applied.error);selectedId=id;page='stage';finalMetrics=false;tab='result';await load();syncStatus();}
 catch(error){status(error.message,true);}finally{working=false;buttons();}
}
async function sync(){
 if(working||polling||document.hidden||!data)return;polling=true;
 try{
  const response=await fetch('/api/cursor');if(!response.ok)return;const cursor=await response.json();
  const updated=cursor.current[profile];
  if(updated?.version!==data.current?.version||cursor.modes[profile]!==data.openCodeMode){
   if(updated?.version!==data.current?.version){selectedId=updated?.checkpoint;page='stage';finalMetrics=false;mode=/^(error-|ui-review-)/.test(updated?.checkpoint||'')?'errors':'base';tab='result';tourKey='';}
   await load();syncStatus();
  }
 }catch{status('Пульт временно недоступен. Автоматически повторяем подключение.',true);}
 finally{polling=false;}
}
$('#next').onclick=()=>page==='overview'?openPage('setup'):page==='setup'?inspect(profile+'-00'):data?.index===data?.points.length-1?openFinalMetrics():inspect(data?.points[Math.max(0,data.index+1)]?.id);
$('#previous').onclick=()=>page==='setup'?openPage('overview'):page==='metrics'?inspect(data.points.at(-1)?.id):data.index===0?openPage('setup'):inspect(data.points[data.index-1]?.id);
$('#reset').onclick=()=>{mode='base';tab='result';jump(profile+'-00');};
$('#close-document').onclick=()=>showTab('result');
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>showTab(button.dataset.tab));
document.querySelectorAll('[data-profile]').forEach(button=>button.onclick=async()=>{if(working)return;profile=button.dataset.profile;selectedId=null;tab='result';clearDocument();try{await load();syncStatus();}catch(error){status(error.message,true);}});
$('#mode').onchange=async()=>{mode=$('#mode').value;selectedId=null;page='stage';finalMetrics=false;tab='result';clearDocument();try{await load();syncStatus();}catch(error){status(error.message,true);}};
$('#native-mode').onchange=async()=>{
 working=true;buttons();status('Переключаем режим OpenCode…');
 try{const response=await fetch('/api/opencode-mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:$('#native-mode').value})}),result=await response.json();if(!response.ok)throw new Error(result.error);await load();status('Режим OpenCode: '+(result.mode==='recording'?'запись':'живой API')+'. Обнови вкладки 4096 и 4097 и выбери модель.');}
 catch(error){status(error.message,true);await load();}finally{working=false;buttons();}
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sync();});
try{await load();syncStatus();}catch(error){status(error.message,true);}
setInterval(()=>void sync(),1500);
