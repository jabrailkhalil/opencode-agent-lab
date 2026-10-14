import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.');
const spec=path.join(root,'openspec/changes/build-tracker/specs/tracker/spec.md');
if(!fs.existsSync(spec)){console.error('spec.md is missing');process.exit(1);}
const text=fs.readFileSync(spec,'utf8'),requirements=[...text.matchAll(/^### Requirement:.*$/gm)];
const errors=[];
if(!/^## (?:ADDED|MODIFIED|REMOVED|RENAMED) Requirements$/m.test(text))errors.push('нет раздела изменений Requirements');
if(!requirements.length)errors.push('нет требований');
for(let i=0;i<requirements.length;i++){
 const block=text.slice(requirements[i].index,requirements[i+1]?.index??text.length);
 if(!/\b(?:MUST|SHALL)\b/.test(block))errors.push('требование '+(i+1)+' не содержит MUST/SHALL');
 if(!/^#### Scenario:/m.test(block))errors.push('требование '+(i+1)+' не содержит Scenario');
 if(!/^- \*\*WHEN\*\*/m.test(block)||!/^- \*\*THEN\*\*/m.test(block))errors.push('сценарий '+(i+1)+' не содержит WHEN/THEN');
}
if(errors.length){console.error('FAIL\n- '+errors.join('\n- '));process.exit(1);}
console.log('PASS: '+requirements.length+' требований; структура Requirements и Scenario/WHEN/THEN подтверждена.');

