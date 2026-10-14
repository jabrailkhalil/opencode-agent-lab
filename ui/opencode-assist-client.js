(()=>{
 const bindings={prompt:[],local:[]};
 window.__AGENT_LAB__={register(kind,value){bindings[kind].push(value);return()=>{const i=bindings[kind].indexOf(value);if(i>=0)bindings[kind].splice(i,1);};}};
 const labels={analyst:'Analyst',designer:'Designer',developer:'Developer',tester:'Tester'};
 let state,refreshing,preparing=false,bar,message='',lastVersion='',ownedDraft='',redirecting=false;
 const norm=s=>String(s||'').replaceAll('\\','/').replace(/\/$/,'').toLowerCase();
 const editor=()=>document.querySelector('[contenteditable="true"][role="textbox"]')||document.querySelector('[contenteditable="true"]');
 const binding=kind=>bindings[kind].findLast(b=>{try{return norm(b.directory())===norm(state?.workspace)&&(!b.session()||location.pathname.endsWith('/'+b.session()));}catch{return false;}});
 const aligned=()=>!!state?.sessionId&&location.pathname.endsWith('/'+state.sessionId);
 const canPrepare=()=>state?.recording&&aligned()&&state.next&&!state.busy&&!state.resetting&&!state.resetError&&binding('prompt')?.ready()&&binding('local')&&editor();
 const currentText=()=>binding('prompt')?.get().filter(p=>p.type==='text').map(p=>p.content).join('')||'';
 const hasAttachments=()=>binding('prompt')?.get().some(p=>p.type!=='text')||false;
 const parentOrigin='http://127.0.0.1:4201';
 const snapshot=()=>({profile:state?.profile,label:state?.label,model:state?.model,run:state?.run,spec:state?.spec,current:state?.current,version:state?.version,epoch:state?.epoch,sessionId:state?.sessionId,aligned:aligned(),intent:state?.intent,total:state?.total,recording:!!state?.recording,busy:!!state?.busy,resetting:!!state?.resetting,error:state?.resetError,next:state?.next?{id:state.next.id,number:state.next.number,role:state.next.role,title:state.next.title}:null,ready:!!canPrepare(),matches:!!(canPrepare()&&state.intent?.status==='prepared'&&state.intent.version===state.version&&!hasAttachments()&&currentText()===state.next.prompt&&binding('local')?.agent.current()?.name===state.next.role&&binding('local')?.model.current()?.provider.id==='demo-recording'&&binding('local')?.model.current()?.id===state.profile+'-recording')});
 const tellParent=(id,error)=>{if(window.parent!==window)window.parent.postMessage({source:'vtb-assist',id,error,state:snapshot()},parentOrigin);};
 function assertExpected(expected){if(!expected)return;const s=snapshot();if(s.version!==expected.version||s.epoch!==expected.epoch||s.sessionId!==expected.sessionId||s.next?.id!==expected.id)throw Error('Этап или чат изменился. Подготовьте промпт заново.');}
 async function refresh(){
  if(refreshing)return refreshing;
  refreshing=(async()=>{try{
   const response=await fetch('/__demo/next',{cache:'no-store'}),next=await response.json();if(!response.ok)throw Error(next.error||'Нет связи');
   if(next.next){const suffix='\n\n[Шаг: '+next.next.id+']';if(next.next.prompt.endsWith(suffix))next.next.prompt=next.next.prompt.slice(0,-suffix.length);}
   const changed=lastVersion&&lastVersion!==next.version;lastVersion=next.version;state=next;
   if(changed){if(ownedDraft&&!hasAttachments()&&currentText()===ownedDraft)binding('prompt')?.set('');ownedDraft='';message='';}
   if(state.recording&&state.sessionId&&!aligned()&&!state.resetting&&!state.resetError&&!redirecting){redirecting=true;location.replace('/__demo/open');return;}
   draw();
  }catch(error){state=null;message='Нет связи с пультом. '+error.message;draw();}})();
  try{await refreshing;}finally{refreshing=null;}
 }
 async function prepare(replace=false,expected){
  if(preparing)throw Error('Подстановка уже выполняется.');preparing=true;
  try{
   await refresh();assertExpected(expected);if(!canPrepare())throw Error(state?.busy?'Дождитесь ответа.':'Откройте текущую рабочую сессию записи.');
   const draft=currentText();if((hasAttachments()||draft.trim()&&draft!==state.next.prompt)&&!replace)throw Error('В поле есть свой текст. Сохраните его или нажмите «Заменить черновик».');
   const local=binding('local');local.agent.set(state.next.role);local.model.set({providerID:'demo-recording',modelID:state.profile+'-recording'});
   const r=await fetch('/__demo/prepare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:state.sessionId,version:state.version,checkpoint:state.next.id})}),intent=await r.json();if(!r.ok)throw Error(intent.error||'Подстановка не подтверждена');
   state.intent=intent;binding('prompt').set(state.next.prompt);ownedDraft=state.next.prompt;editor()?.focus();message='Подготовлен один промпт этого чата. Отправка — только кнопкой ↑.';draw();return snapshot();
  }catch(error){message=error.message;draw();throw error;}finally{preparing=false;}
 }
 window.addEventListener('message',async event=>{
  if(window.parent===window||event.source!==window.parent||event.origin!==parentOrigin||event.data?.source!=='vtb-dual')return;
  const {id,action,expected}=event.data;
  try{
   if(action==='prepare')await prepare(false,expected);
   else if(action==='check'||action==='send'){
    await refresh();assertExpected(expected);const s=snapshot();
    if(action==='send'){
     if(!s.ready||!s.matches||s.intent?.id!==expected?.intentId)throw Error('Черновик не подготовлен для этой отправки. Вставьте промпт заново.');
     const submit=editor()?.closest('form')?.querySelector('[data-action="prompt-submit"]');if(!submit||submit.disabled||submit.getAttribute('data-icon')!=='arrow-up')throw Error('Кнопка отправки ещё не готова.');
     state.busy=true;state.intent={...state.intent,status:'submitted'};ownedDraft='';submit.click();message='Отправлено только в этот чат.';draw();
    }
   }else return;
   tellParent(id);
  }catch(error){tellParent(id,error.message);}
 });
 function draw(){
  if(!bar)return;document.body.classList.toggle('demo-recording',!!state?.recording);const next=state?.next;
  bar.querySelector('[data-assist-title]').textContent=state?(state.resetError||(!state.recording?'Живой API · автоподстановка выключена':state.resetting?'Новый прогон: идёт сброс':!aligned()?'Открываем привязанный чат':!next?'Ветка завершена':`${state.label} · ${next.number} / ${state.total} · ${labels[next.role]}`)):'Помощник демонстрации';
  bar.querySelector('[data-assist-step]').textContent=next?.title||'';
  const button=bar.querySelector('[data-assist-fill]');button.disabled=!canPrepare();button.textContent=snapshot().matches?'Промпт подготовлен':'Вставить следующий промпт';
  bar.querySelector('[data-assist-replace]').hidden=!(canPrepare()&&(hasAttachments()||currentText().trim()&&currentText()!==next.prompt));
  bar.querySelector('[data-assist-message]').textContent=message||(state?.busy?'Агент отвечает…':next?'Сначала нажмите «Вставить следующий промпт», затем ↑.':'Начните новый прогон в общем окне.');
  const p=state?.profile||(location.port==='4217'?'qwen':'claude');window.name='opencode-'+p;
  bar.querySelector('[data-assist-console]').href=parentOrigin+'/?profile='+p+'#'+(state?.current||'intro');bar.querySelector('[data-assist-console]').target='vtb-console-'+p;tellParent();
 }
 document.addEventListener('DOMContentLoaded',()=>{
  bar=document.createElement('section');bar.id='vtb-demo-assist';bar.setAttribute('aria-label','Следующий шаг демонстрации');if(window.parent!==window)document.body.classList.add('demo-embedded');
  bar.innerHTML='<div class="assist-info"><strong data-assist-title></strong><span data-assist-step></span><small data-assist-message role="status"></small></div><button type="button" data-assist-fill>Вставить следующий промпт</button><button type="button" data-assist-replace hidden>Заменить черновик</button><a data-assist-console>Результат в пульте ↗</a><a href="http://127.0.0.1:4201/parallel" target="vtb-parallel">Общий старт ↗</a>';
  document.body.prepend(bar);bar.querySelector('[data-assist-fill]').onclick=()=>prepare().catch(()=>{});bar.querySelector('[data-assist-replace]').onclick=()=>prepare(true).catch(()=>{});refresh();setInterval(refresh,1000);
 });
})();
