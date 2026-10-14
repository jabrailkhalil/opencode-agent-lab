import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),catalog=JSON.parse(fs.readFileSync(path.join(root,'data/checkpoints.json'),'utf8'));
let checked=0;
for(const point of catalog){
 const base=path.join(root,'checkpoints',point.id),manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
 for(const entry of manifest.files){const b=fs.readFileSync(path.join(base,'code',entry.path));if(b.length!==entry.bytes||crypto.createHash('sha256').update(b).digest('hex')!==entry.sha256)throw new Error(point.id+': '+entry.path);checked++;}
 for(const entry of manifest.screenshots||[]){const b=fs.readFileSync(path.join(base,'screenshots',entry.path));if(b.length!==entry.bytes||crypto.createHash('sha256').update(b).digest('hex')!==entry.sha256)throw new Error(point.id+': screenshot '+entry.path);}
}
const workshop=JSON.parse(fs.readFileSync(path.join(root,'data/workshop.json'),'utf8'));
if(workshop.runs.length!==4||!fs.existsSync(path.join(root,'data/legacy-qwen.json')))throw new Error('Five-result comparison is incomplete');
for(const id of workshop.runs.map(r=>r.id)){
 const config=JSON.parse(fs.readFileSync(path.join(root,'templates',id,'opencode.json'),'utf8'));
 if(!['analyst','designer','developer','tester'].every(role=>config.agent?.[role]))throw new Error(id+': missing roles');
}
const generated=new Set(['data/live-preparation.json','data/checkpoint-console-state.json','data/opencode-recording-events.jsonl']);
const tracked=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git','.runtime','artifacts'].includes(e.name))continue;const p=path.join(dir,e.name);if(generated.has(path.relative(root,p).replaceAll('\\','/')))continue;e.isDirectory()?walk(p):tracked.push(p);}}walk(root);
for(const file of tracked){if(fs.statSync(file).size>100*1024*1024)throw new Error('GitHub file over 100 MiB: '+file);if(/\.(json|m?js|md|txt|html|css|ya?ml|ps1|cmd)$/i.test(file)){const s=fs.readFileSync(file,'utf8');if(/sk-(?:or-v1-|ant-)[A-Za-z0-9_-]{15,}|C:[\\/]+Users[\\/]+Jabrail|D:[\\/]+todual/i.test(s))throw new Error('Private value: '+file);}}
console.log(JSON.stringify({checkpoints:catalog.length,verifiedFiles:checked,runs:5,rolesPerRun:4,privateValues:0}));

