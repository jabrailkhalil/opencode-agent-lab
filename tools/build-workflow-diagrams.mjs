import fs from 'node:fs';
import path from 'node:path';
import {handoffFor,roleNames} from '../ui/agent-workflows.js';
const root=path.resolve(import.meta.dirname,'..');
const workshop=JSON.parse(fs.readFileSync(path.join(root,'data/workshop.json'),'utf8'));
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const roleOrder=['analyst','designer','developer','tester'];
const colors={analyst:'#4c63b6',designer:'#947249',developer:'#2c8171',tester:'#8c5e9d',operator:'#738198'};
function wrap(text,max){const lines=[''];for(const word of String(text).split(' ')){const n=lines.length-1;if(lines[n]&&lines[n].length+word.length+1>max)lines.push(word);else lines[n]+=(lines[n]?' ':'')+word;}return lines;}
const txt=(x,y,text,size=16,fill='#273249',weight=400)=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${xml(text)}</text>`;
const lines=(x,y,text,max,size=15,fill='#273249',weight=400)=>wrap(text,max).map((l,i)=>txt(x,y+i*(size+5),l,size,fill,weight)).join('');
const rect=(x,y,w,h,fill='#ffffff',stroke='#dfe5ef')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="${stroke}"/>`;
const start=(title,height)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1260" height="${height}" viewBox="0 0 1260 ${height}" role="img" aria-labelledby="title desc"><title id="title">${xml(title)}</title><desc id="desc">Ведущий выбирает роль для каждого задания. Стрелки показывают порядок обращений, подписи справа — входные данные и сохранённый результат.</desc><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1 L7 4 L1 7" fill="none" stroke="#9ba9bf" stroke-width="1.5"/></marker></defs><rect width="1260" height="${height}" rx="18" fill="#f7f9fc"/><g font-family="Segoe UI,Arial,sans-serif">`;
const end='</g></svg>\n';
function timeline(run){
 const rows=run.stages.filter(s=>s.role!=='operator'),hasPrepared=run.stages.at(-1).role==='operator';
 const top=158,rowH=132,height=top+rows.length*rowH+(hasPrepared?130:80);
 let out=start(run.label+' · порядок заданий',height)+txt(32,46,run.label,28,'#273249',700)+txt(32,78,'Порядок отправки заданий и передачи файлов · источник: сохранённые этапы прогона',16,'#748299');
 out+=txt(32,115,'№',14,'#748299');roleOrder.forEach((role,i)=>out+=txt(87+i*158,115,roleNames[role],16,colors[role],650));
 out+=txt(738,115,'Вход → действие → результат',16,'#65748a',650);
 for(let i=0;i<4;i++)out+=`<path d="M${151+i*158} 130 V${top+rows.length*rowH-12}" stroke="#e1e7f0" stroke-dasharray="4 6"/>`;
 rows.forEach((s,i)=>{
  const y=top+i*rowH,j=roleOrder.indexOf(s.role),cx=151+j*158,f=handoffFor(s,run);
  if(i){const prev=151+roleOrder.indexOf(rows[i-1].role)*158,py=y-rowH+88;out+=`<path d="M${prev} ${py} V${y-19} H${cx} V${y-3}" fill="none" stroke="#9ba9bf" stroke-width="1.8" marker-end="url(#arrow)"/>`;}
  const titleLines=wrap(s.title,18);if(titleLines.length>2)titleLines.splice(1,titleLines.length-1,titleLines[1].slice(0,16)+'…');
  out+=txt(32,y+30,String(i+1).padStart(2,'0'),19,'#748299',600)+rect(cx-70,y,140,88,'#ffffff',colors[s.role])+txt(cx-57,y+24,roleNames[s.role],15,colors[s.role],650)+titleLines.map((l,k)=>txt(cx-57,y+47+k*17,l,12)).join('')+txt(cx-57,y+77,s.id,11,'#748299');
  out+=`<path d="M${cx+70} ${y+38} H712" stroke="#b9c4d6" stroke-dasharray="4 5" marker-end="url(#arrow)"/>`;
  out+=rect(730,y-3,498,112)+txt(746,y+18,'ВХОД',10,'#7c8ba2',650)+lines(800,y+18,f.input,52,12)+txt(746,y+55,'ЗАДАЧА',10,'#7c8ba2',650)+lines(800,y+55,f.action,52,12)+txt(746,y+91,'ВЫХОД',10,'#7c8ba2',650)+txt(800,y+91,f.output,11,'#425b84');
 });
 const bottom=top+rows.length*rowH;
 if(hasPrepared)out+=rect(32,bottom,1196,98,'#eef2f6')+txt(52,bottom+28,'Отдельно после исходного прогона: подготовленная UI-итерация',18,'#52647b',650)+txt(52,bottom+55,'Общий визуальный контракт → обновление оформления → '+run.stages.at(-1).id,16)+txt(52,bottom+80,'Этот этап не является дополнительным API-вызовом модели; исходная версия сохранена.',15,'#748299');
 out+=txt(32,height-25,run.spec?(run.id==='qwen-spec'?'qspec-11: отдельное задание аналитику — новые WHEN/THEN и обновление tasks.md.':'Sonnet завершает FINAL.md; отдельного заключительного обновления spec.md в этой записи нет.'):'Прямые задания: бриф и тесты сохранены, уточнения идут через промпты и отчёты.',16,'#748299');
 return out+end;
}
function method(specMode){
 let out=start(specMode?'Spec-driven: требования, задания и обратная связь':'Прямые задания: входы, роли и уточнения',840)+txt(32,46,specMode?'Spec-driven · требования управляют реализацией':'Без OpenSpec · уточнения через задания и отчёты',28,'#273249',700)+txt(32,78,'OpenCode — среда ролей. Ведущий выбирает, кому и когда отправить следующее задание.',17,'#748299');
 const box=(x,y,w,h,title,body,color='#4c63b6')=>rect(x,y,w,h)+txt(x+18,y+31,title,21,color,650)+lines(x+18,y+63,body,Math.floor((w-36)/8),16,'#65748a');
 out+=box(32,110,350,138,'1. Входные договорённости','Бриф, интерфейсы, seed-данные, референс UI и исходные тесты.');
 out+=box(430,110,798,138,'2. Аналитик получает первое задание',specMode?'Анализ → proposal.md → spec.md (MUST, WHEN/THEN) → первоначальные design.md и tasks.md.':'Анализирует бриф, фиксирует формулы и неоднозначности в ANALYSIS.md.');
 out+=`<path d="M385 178 H425" stroke="#9ba9bf" stroke-width="2" marker-end="url(#arrow)"/>`;
 out+=`<path d="M829 250 V284" stroke="#9ba9bf" stroke-width="2" marker-end="url(#arrow)"/>`;
 out+=box(32,290,1196,142,specMode?'Общий источник правил: OpenSpec и проверка структуры':'Общий контекст: бриф, анализ и отчёты',specMode?'Ведущий запускает строгую валидацию документа. Замечания передаёт аналитику отдельным заданием; после исправления повторяет проверку. Это не проверка работоспособности приложения.':'Нет отдельной валидации артефактов OpenSpec. Ведущий передаёт каждой роли нужные документы и новые наблюдения в очередном задании.');
 const roles=[['Дизайнер','Читает правила и анализ. Создаёт DESIGN-PLAN.md'+(specMode?' и уточняет design.md.':'.')],['Разработчик','Получает план, контракт'+(specMode?' и tasks.md.':' и бриф.')+' Пишет dist/; запускает тесты.'],['Тестировщик','Читает код'+(specMode?' и сценарии spec.md.':', бриф и тесты.')+' Проверяет; записывает QA-RESULTS.md.']];
 roles.forEach(([title,body],i)=>{const x=32+i*406;out+=box(x,478,384,154,title,body,colors[roleOrder[i+1]]);out+=`<path d="M${x+192} 434 V472" stroke="#9ba9bf" stroke-width="2" marker-end="url(#arrow)"/>`;});
 out+=box(32,680,1196,110,'Новые наблюдения → адресное задание нужной роли',specMode?'QA/браузер → дизайнер при проблеме раскладки → разработчик → повторная проверка → аналитик фиксирует новые сценарии и незакрытые задачи.':'QA/браузер → дизайнер при проблеме раскладки → разработчик → повторная проверка → аналитик сводит итог и ограничения.');
 out+=`<path d="M1215 730 H1240 V360 H1231" fill="none" stroke="#9ba9bf" stroke-width="2" marker-end="url(#arrow)"/>`;
 out+=txt(32,819,'Точная очередность обращений различается у Sonnet и Qwen и показана в отдельной схеме каждой ветки.',16,'#748299');return out+end;
}
const generated=new Map(workshop.runs.map(r=>['agent-flow-'+r.id+'.svg',timeline(r)]));
generated.set('agent-flow-spec.svg',method(true));generated.set('agent-flow-direct.svg',method(false));
for(const [name,svg] of generated){const p=path.join(root,'ui',name);if(process.argv.includes('--check')){if(!fs.existsSync(p)||fs.readFileSync(p,'utf8')!==svg)throw new Error('Outdated workflow diagram: '+name);}else fs.writeFileSync(p,svg);}
if(!process.argv.includes('--check')){fs.mkdirSync(path.join(root,'artifacts/workflow-guide'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts/workflow-guide/model.json'),JSON.stringify(workshop.runs.map(run=>({...run,stages:run.stages.filter(s=>s.role!=='operator').map((s,i)=>({number:i+1,id:s.id,role:s.role,title:s.title,...handoffFor(s,run)}))})),null,2));}
console.log(JSON.stringify({workflowDiagrams:generated.size,exactRoutes:workshop.runs.length}));
