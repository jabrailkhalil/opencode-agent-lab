(()=>{
 const bindings={prompt:[],local:[]};
 window.__AGENT_LAB__={register(kind,value){bindings[kind].push(value);return()=>{const i=bindings[kind].indexOf(value);if(i>=0)bindings[kind].splice(i,1);};}};
 const labels={analyst:'Analyst',designer:'Designer',developer:'Developer',tester:'Tester'};
 let state,loading=false,preparing=false,lastPrepared='',lastVersion='',bar,message='';
 const norm=s=>String(s||'').replaceAll('\\','/').replace(/\/$/,'').toLowerCase();
 const editor=()=>document.querySelector('[contenteditable="true"][role="textbox"]')||document.querySelector('[contenteditable="true"]');
 const binding=kind=>bindings[kind].findLast(b=>{try{return norm(b.directory())===norm(state?.workspace)&&(!b.session()||location.pathname.endsWith('/'+b.session()));}catch{return false;}});
 const canPrepare=()=>state?.recording&&state.next&&!state.busy&&binding('prompt')?.ready()&&binding('local')&&editor();
 const currentText=()=>binding('prompt')?.get().filter(p=>p.type==='text').map(p=>p.content).join('')||'';
 const hasAttachments=()=>binding('prompt')?.get().some(p=>p.type!=='text')||false;
 const parentOrigin='http://127.0.0.1:4201';
 const snapshot=()=>({profile:state?.profile,label:state?.label,model:state?.model,run:state?.run,spec:state?.spec,current:state?.current,version:state?.version,total:state?.total,recording:!!state?.recording,busy:!!state?.busy,next:state?.next?{id:state.next.id,number:state.next.number,role:state.next.role,title:state.next.title}:null,ready:!!canPrepare(),matches:!!(canPrepare()&&!hasAttachments()&&currentText()===state.next.prompt&&binding('local')?.agent.current()?.name===state.next.role&&binding('local')?.model.current()?.provider.id==='demo-recording'&&binding('local')?.model.current()?.id===state.profile+'-recording')});
 const tellParent=(id,error)=>{if(window.parent!==window)window.parent.postMessage({source:'vtb-assist',id,error,state:snapshot()},parentOrigin);};
 window.addEventListener('message',async event=>{
  if(window.parent===window||event.source!==window.parent||event.origin!==parentOrigin||event.data?.source!=='vtb-dual')return;
  const {id,action,expected}=event.data;
  try{
   if(action==='prepare'){await prepare();if(!snapshot().matches)throw new Error(message||'Не удалось вставить задание.');}
   else if(action==='check'||action==='send'){
    await refresh();const s=snapshot();
    if(action==='send'){
     if(!s.ready||!s.matches||s.next?.id!==expected?.id||s.version!==expected?.version)throw new Error('Этап или черновик изменился. Вставь задание заново.');
     const submit=editor()?.closest('form')?.querySelector('[data-action="prompt-submit"]');
     if(!submit||submit.disabled||submit.getAttribute('data-icon')!=='arrow-up')throw new Error('Кнопка отправки ещё не готова.');
     submit.click();state.busy=true;draw();
    }
   }else return;
   tellParent(id);
  }catch(error){tellParent(id,error.message);}
 });
 function say(text){message=text;draw();}
 async function refresh(){
  if(loading)return;loading=true;
  try{
   const response=await fetch('/__demo/next',{cache:'no-store'}),next=await response.json();
   if(!response.ok)throw new Error(next.error||'Нет связи');
   // An already-running local server may still return the previous draft
   // format. Normalize it here as well, without restarting either chat.
   if(next.next){const suffix='\n\n[Шаг: '+next.next.id+']';if(next.next.prompt.endsWith(suffix))next.next.prompt=next.next.prompt.slice(0,-suffix.length);}
   const changed=lastVersion&&lastVersion!==next.version;lastVersion=next.version;state=next;
   if(changed){message='';lastPrepared='';}
   if(canPrepare()){
    const local=binding('local');
    // Migrate only the exact old auto-filled draft for this stage. Leave
    // custom text, attachments, sent messages and live models untouched.
    if(!hasAttachments()&&local.model.current()?.provider.id==='demo-recording'&&currentText()===state.next.prompt+'\n\n[Шаг: '+state.next.id+']')binding('prompt').set(state.next.prompt);
    // Never take over a manually written draft or a manually selected paid model.
    if(!hasAttachments()&&(!currentText().trim()||currentText()===state.next.prompt)){
     if(local.agent.current()?.name!==state.next.role)local.agent.set(state.next.role);
    }
   }
   draw();
  }catch(error){state=null;say('Нет связи с пультом. '+error.message);}finally{loading=false;}
 }
 async function prepare(replace=false){
  if(preparing)return;preparing=true;
  try{
   await refresh();
   if(!canPrepare()){say(state?.busy?'Дождись завершения ответа.':'Открой рабочую сессию записи.');return;}
   const draft=currentText();
   if((hasAttachments()||draft.trim()&&draft!==state.next.prompt)&&!replace){say('В поле уже есть текст или вложения. Сохрани их или нажми «Заменить черновик».');return;}
   const local=binding('local'),prompt=binding('prompt');
   local.agent.set(state.next.role);
   local.model.set({providerID:'demo-recording',modelID:state.profile+'-recording'});
   prompt.set(state.next.prompt);lastPrepared=state.next.id;
   editor()?.focus();say('Задание вставлено. Отправка — кнопкой ↑ в OpenCode.');
  }catch(error){say(error.message);}finally{preparing=false;}
 }
 function draw(){
  if(!bar)return;
  const next=state?.next;
  const title=bar.querySelector('[data-assist-title]');
  title.textContent=state?(!state.recording?'Живой API · автоподстановка выключена':state.error||(!next?'Ветка завершена':`${state.label} · запись · ${next.number} / ${state.total} · ${labels[next.role]}`)):'Помощник демонстрации';
  bar.querySelector('[data-assist-step]').textContent=next?.title||'';
  const button=bar.querySelector('[data-assist-fill]'),replace=bar.querySelector('[data-assist-replace]');
  const draft=currentText(),matches=canPrepare()&&!hasAttachments()&&draft===next.prompt;
  button.disabled=!canPrepare();button.textContent=matches?'Задание вставлено':'Вставить следующий промпт';
  replace.hidden=!(canPrepare()&&(hasAttachments()||draft.trim()&&draft!==next.prompt));
  bar.querySelector('[data-assist-message]').textContent=message||(state?.busy?'Агент отвечает…':next?'Нажми в пустое поле — задание появится само.':'Результаты доступны в пульте.');
  const profile=state?.profile||(location.port==='4217'?'qwen':'claude');
  window.name='opencode-'+profile;
  bar.querySelector('[data-assist-console]').href='http://127.0.0.1:4201/?profile='+profile+'#'+(state?.current||'intro');
  bar.querySelector('[data-assist-console]').target='vtb-console-'+profile;
  tellParent();
 }
 document.addEventListener('DOMContentLoaded',()=>{
  bar=document.createElement('section');bar.id='vtb-demo-assist';bar.setAttribute('aria-label','Следующий шаг демонстрации');
  if(window.parent!==window)document.body.classList.add('demo-embedded');
  bar.innerHTML='<div class="assist-info"><strong data-assist-title></strong><span data-assist-step></span><small data-assist-message role="status"></small></div><button type="button" data-assist-fill>Вставить следующий промпт</button><button type="button" data-assist-replace hidden>Заменить черновик</button><a data-assist-console target="vtb-console">Результат в пульте ↗</a>';
  document.body.prepend(bar);bar.querySelector('[data-assist-fill]').onclick=()=>prepare();bar.querySelector('[data-assist-replace]').onclick=()=>prepare(true);
  document.addEventListener('focusin',event=>{if(event.target===editor()&&!hasAttachments()&&!currentText().trim()&&!preparing)prepare();});
  // A second click into an already-focused empty editor also prepares the draft.
  document.addEventListener('click',event=>{if(event.target===editor()&&!hasAttachments()&&!currentText().trim()&&!preparing)prepare();});
  refresh();setInterval(refresh,1000);
 });
})();
