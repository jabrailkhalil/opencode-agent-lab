const profiles=['claude','qwen'],names={claude:'Левый чат',qwen:'Правый чат'},origins={claude:'http://127.0.0.1:4216',qwen:'http://127.0.0.1:4217'};
const frames=Object.fromEntries(profiles.map(p=>[p,document.querySelector('[data-chat="'+p+'"]')]));
const states={},pending=new Map(),prepared=new Map();let action=false,firstReady=false;
window.name='vtb-parallel';
const status=(text,error=false)=>{const el=document.querySelector('#status');el.textContent=text;el.title=text;el.classList.toggle('error',error);};
const fresh=p=>states[p]&&Date.now()-states[p].received<5000;
const expected=s=>({id:s.next.id,version:s.version,epoch:s.epoch,sessionId:s.sessionId,intentId:s.intent?.id});
const same=(a,s)=>a&&s&&a.id===s.next?.id&&a.version===s.version&&a.epoch===s.epoch&&a.sessionId===s.sessionId&&a.intentId===s.intent?.id;
const selected=()=>document.querySelector('#send-target').value==='both'?profiles:[document.querySelector('#send-target').value];
function available(){
 const wanted=selected();
 if(wanted.some(p=>!fresh(p)||!states[p].recording||states[p].resetting||states[p].error||states[p].busy||!states[p].aligned||(states[p].next&&!states[p].ready)))return [];
 return wanted.filter(p=>states[p].next&&states[p].ready);
}
const side=p=>p==='claude'?'слева':'справа';
function draw(){
 for(const p of profiles){
  const s=states[p];if(s?.label){names[p]=s.label;frames[p].title='OpenCode '+s.label;}
  if(prepared.has(p)&&(!fresh(p)||!same(prepared.get(p),s)||!s.matches))prepared.delete(p);
  const label=document.querySelector('[data-profile="'+p+'"] [data-step]');
  label.textContent=!fresh(p)?'— / —':(s.next?s.next.number-1:s.total)+' / '+s.total;
  label.title=!fresh(p)?'Подключение':s.label+' · '+s.current+' · '+(s.busy?'агент отвечает':s.next?'далее '+s.next.role+': '+s.next.title:'завершено');
  label.setAttribute('aria-label',label.title);
 }
 const availableNow=available(),preparedNow=[...prepared.keys()];
 document.querySelector('#prepare-both').disabled=action||!availableNow.length;
 document.querySelector('#prepare-both').textContent=availableNow.length===1?'Вставить '+side(availableNow[0]):selected().length===1?'Вставить '+side(selected()[0]):'Вставить оба промпта';
 document.querySelector('#send-both').disabled=action||!preparedNow.length;
 document.querySelector('#send-both').textContent=preparedNow.length===2?'Отправить оба ↑':preparedNow.length===1?'Отправить '+side(preparedNow[0])+' ↑':'Отправить ↑';
 document.querySelector('#send-both').title=preparedNow.length?'Отправится '+preparedNow.length+' промпт(а): '+preparedNow.map(p=>names[p]).join(' и '):'Сначала явно подготовьте промпты в этом окне';
 document.querySelector('#send-target').disabled=action;
 document.querySelector('#restart-both').disabled=action||profiles.some(p=>states[p]?.busy);
 document.querySelector('#reconnect-chats').disabled=action;
 const pair=document.querySelector('#pair-label');if(states.claude?.label&&states.qwen?.label){pair.textContent=states.claude.model===states.qwen.model?'Qwen · со спекой / без':'Sonnet / Qwen';pair.title=names.claude+' · '+names.qwen;document.title='OpenCode · '+pair.textContent;}
 if(!action&&profiles.every(p=>fresh(p)&&!states[p].next))status('Оба прогона завершены. Для записи заново — «Начать оба с нуля».');
 if(!firstReady&&profiles.every(p=>fresh(p)&&states[p].aligned)){firstReady=true;status('Чаты готовы. Перед записью нажмите «Начать оба с нуля». Подстановка и отправка — отдельные действия.');}
}
function command(profile,action,expect){return new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{pending.delete(id);reject(Error('Нет ответа от '+names[profile]+'. Нажмите ↻.'));},15000);pending.set(id,{profile,resolve,reject,timer});frames[profile].contentWindow.postMessage({source:'vtb-dual',id,action,expected:expect},origins[profile]);});}
window.addEventListener('message',ev=>{
 const p=profiles.find(p=>ev.origin===origins[p]&&ev.source===frames[p].contentWindow);if(!p||ev.data?.source!=='vtb-assist')return;
 if(ev.data.state)states[p]={...ev.data.state,received:Date.now()};
 const request=pending.get(ev.data.id);if(request&&request.profile===p){clearTimeout(request.timer);pending.delete(ev.data.id);ev.data.error?request.reject(Error(names[p]+': '+ev.data.error)):request.resolve(ev.data.state);}
 draw();
});
document.querySelector('#prepare-both').onclick=async()=>{
 if(action)return;const targets=available();if(!targets.length)return;
 action=true;prepared.clear();draw();
 try{
  const results=await Promise.allSettled(targets.map(async p=>{const s=await command(p,'prepare',expected(states[p]));if(!s.matches)throw Error('Промпт не подтверждён');return {profile:p,state:s};}));
  for(const result of results)if(result.status==='fulfilled')prepared.set(result.value.profile,expected(result.value.state));
  const errors=results.filter(r=>r.status==='rejected').map(r=>r.reason.message);
  status(errors.length?errors.join(' · '):prepared.size===2?'Подготовлено 2 промпта. Отправка — только «Отправить оба».':'Подготовлен 1 промпт '+side(targets[0])+'.',errors.length>0);
 }finally{action=false;draw();}
};
document.querySelector('#send-both').onclick=async()=>{
 if(action||!prepared.size)return;const batch=[...prepared.entries()];action=true;draw();
 try{
  const checked=await Promise.all(batch.map(async([p,e])=>({p,e,s:await command(p,'check',e)})));
  if(checked.some(x=>!same(x.e,x.s)||!x.s.matches||x.s.busy||!x.s.ready))throw Error('Подготовленный этап изменился. Вставьте промпты заново.');
  prepared.clear();
  const results=await Promise.allSettled(checked.map(x=>command(x.p,'send',x.e)));
  const errors=results.filter(r=>r.status==='rejected').map(r=>r.reason.message);
  status(errors.length?errors.join(' · '):batch.length===2?'Отправлено ровно 2 промпта — по одному в каждый чат.':'Отправлен ровно 1 промпт '+side(batch[0][0])+'.',errors.length>0);
 }catch(error){prepared.clear();status(error.message,true);}finally{action=false;draw();}
};
function reconnect(){
 prepared.clear();for(const p of profiles){delete states[p];frames[p].src=origins[p]+'/__demo/open?reconnect='+Date.now();}
}
document.querySelector('#restart-both').onclick=async()=>{
 if(action)return;action=true;prepared.clear();draw();status('Создаём новый прогон: сбрасываем обе ветки и открываем два пустых чата…');
 try{
  const r=await fetch('/api/replay/reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID()})}),result=await r.json();if(!r.ok)throw Error(result.error||'Сброс не завершён');
  reconnect();status('Обе ветки с нуля. Ничего не отправлено. Дождитесь 0 / …, затем нажмите «Вставить оба промпта».');
 }catch(error){status(error.message,true);}finally{action=false;draw();}
};
document.querySelector('#send-target').onchange=()=>{prepared.clear();status('Выбрана отправка: '+(selected().length===2?'оба чата':side(selected()[0]))+'. Сначала вставьте промпт.');draw();};
document.querySelector('#reconnect-chats').onclick=()=>{if(action||profiles.some(p=>states[p]?.busy))return;reconnect();status('Переподключаем текущие чаты. Прогресс сохранён; отправка не выполняется.');draw();};
reconnect();setInterval(draw,1000);
