const profiles=['claude','qwen'],names={claude:'Sonnet',qwen:'Qwen'},origins={claude:'http://127.0.0.1:4216',qwen:'http://127.0.0.1:4217'};
const frames=Object.fromEntries(profiles.map(p=>[p,document.querySelector('[data-chat="'+p+'"]')]));
const states={},pending=new Map();let action=false;
window.name='vtb-parallel';
const status=(text,error=false)=>{const el=document.querySelector('#status');el.textContent=text;el.title=text;el.classList.toggle('error',error);};
const fresh=p=>states[p]&&Date.now()-states[p].received<5000;
// A finished or busy branch must not block the other independent workspace.
const availableProfiles=()=>profiles.filter(p=>fresh(p)&&states[p].recording&&states[p].next&&states[p].ready&&!states[p].busy);
function draw(){
 for(const p of profiles)if(states[p]?.label){names[p]=states[p].label;frames[p].title='OpenCode '+names[p];}
 const pair=document.querySelector('#pair-label');if(pair&&states.claude?.model&&states.qwen?.model){pair.textContent=states.claude.model===states.qwen.model?'Qwen 3.8 Flash · со спекой / без':'Sonnet / Qwen';pair.title=names.claude+' · '+names.qwen;document.title='OpenCode · '+pair.textContent;}
 const available=availableProfiles();
 const prepare=document.querySelector('#prepare-both'),send=document.querySelector('#send-both');
 const recoverable=profiles.some(p=>!fresh(p)||(states[p].recording&&states[p].next&&!states[p].busy&&!states[p].ready));
 prepare.disabled=action||(!available.length&&!recoverable);
 prepare.textContent=available.length===1?'Вставить промпт '+(available[0]==='claude'?'слева':'справа'):'Вставить оба промпта';
 send.disabled=action||!available.length||!available.every(p=>states[p].matches);
 send.title=available.length?'Отправить: '+available.map(p=>names[p]).join(' и '):'Нет готовых заданий';
 if(available.length&&document.querySelector('#status').textContent==='Подключаем чаты…')status('');
 for(const p of profiles){const s=states[p],label=document.querySelector('[data-profile="'+p+'"] [data-step]');label.textContent=!fresh(p)?'— / —':(s.next?.number??s.total)+' / '+s.total;label.title=!fresh(p)?names[p]+' · подключение':names[p]+' · '+(!s.recording?'Живой API':s.busy?'Агент отвечает':s.next?s.next.title:'Прогон завершён');label.setAttribute('aria-label',names[p]+' · итерация '+label.textContent);}
 if(!action&&profiles.every(p=>fresh(p)&&states[p].recording&&!states[p].next))status('Оба прогона завершены');
}
function command(profile,action,expected){return new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Нет ответа от '+names[profile]+'. Обнови страницу.'));},12000);pending.set(id,{profile,resolve,reject,timer});frames[profile].contentWindow.postMessage({source:'vtb-dual',id,action,expected},origins[profile]);});}
window.addEventListener('message',ev=>{
 const p=profiles.find(p=>ev.origin===origins[p]&&ev.source===frames[p].contentWindow);if(!p||ev.data?.source!=='vtb-assist')return;
 if(ev.data.state)states[p]={...ev.data.state,received:Date.now()};
 const request=pending.get(ev.data.id);if(request&&request.profile===p){clearTimeout(request.timer);pending.delete(ev.data.id);ev.data.error?request.reject(new Error(names[p]+': '+ev.data.error)):request.resolve(ev.data.state);}
 draw();
});
document.querySelector('#prepare-both').onclick=async()=>{
 if(action)return;
 let targets=availableProfiles();
 if(!targets.length){
  action=true;status('Переподключаем чаты к текущему прогону…');
  const retry=profiles.filter(p=>!fresh(p)||(states[p].recording&&states[p].next&&!states[p].busy&&!states[p].ready));
  for(const p of retry){delete states[p];frames[p].src=origins[p]+'/__demo/open?reconnect='+Date.now();}
  const deadline=Date.now()+8000;
  while(Date.now()<deadline&&!availableProfiles().length)await new Promise(resolve=>setTimeout(resolve,200));
  action=false;targets=availableProfiles();
  if(!targets.length){status('Чаты загружаются. Нажми «Вставить оба промпта» ещё раз.',true);draw();return;}
 }
 action=true;draw();
 try{const results=await Promise.allSettled(targets.map(p=>command(p,'prepare'))),errors=results.filter(r=>r.status==='rejected').map(r=>r.reason.message);status(errors.length?errors.join(' · '):targets.length===2?'Оба промпта вставлены':'Промпт '+names[targets[0]]+' вставлен',errors.length>0);}finally{action=false;draw();}
};
document.querySelector('#send-both').onclick=async()=>{
 const targets=availableProfiles();if(action||!targets.length)return;action=true;draw();
 try{
  // Recheck every selected draft before any submission; never submit a paid model.
  const checked=await Promise.all(targets.map(async p=>({profile:p,state:await command(p,'check')})));
  const active=checked.filter(({state:s})=>!(s.recording&&!s.next));
  if(!active.length){status('Выбранные прогоны уже завершены');return;}
  if(active.some(({state:s})=>!s.recording||!s.ready||!s.matches||s.busy))throw new Error('Этап или черновик изменился. Вставь следующий промпт заново.');
  const sent=await Promise.allSettled(active.map(({profile:p,state:s})=>command(p,'send',{id:s.next.id,version:s.version})));
  const errors=sent.filter(r=>r.status==='rejected').map(r=>r.reason.message),count=sent.filter(r=>r.status==='fulfilled').length;
  status(errors.length?errors.join(' · ')+(count?' Другой чат продолжает работу.':' Задания не отправлены.'):active.length===2?'Отправлено в оба чата':'Отправлено в '+names[active[0].profile],errors.length>0);
 }catch(error){status(error.message,true);}finally{action=false;draw();}
};
const query=new URLSearchParams(location.search);
for(const p of profiles){const id=query.get(p);frames[p].src=id&&/^ses_[a-zA-Z0-9]+$/.test(id)?origins[p]+'/server/'+btoa(origins[p]).replace(/=/g,'')+'/session/'+id:origins[p]+'/__demo/open';}
document.querySelector('#reconnect-chats').onclick=()=>{
 if(action)return;
 for(const p of profiles){if(states[p]?.busy)continue;delete states[p];frames[p].src=origins[p]+'/__demo/open?reconnect='+Date.now();}
 status('Переподключаем чаты. Текущие этапы сохранены.');draw();
};
setInterval(draw,1000);
