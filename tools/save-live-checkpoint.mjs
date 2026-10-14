import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const [profile,label]=process.argv.slice(2);
if(!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(label||''))throw new Error('node tools/save-live-checkpoint.mjs <claude|qwen> <unique-label>');
const setup=JSON.parse(fs.readFileSync(path.join(root,'data/live-preparation.json'),'utf8'));
const plan=setup.profiles.find(p=>p.profile===profile);if(!plan)throw new Error('Unknown profile');
const destination=path.join(plan.workspace,'artifacts/checkpoints',label);
if(fs.existsSync(destination))throw new Error('Чекпоинт уже существует; выберите новое имя.');
fs.mkdirSync(destination,{recursive:true});
for(const directory of ['code','screenshots'])fs.mkdirSync(path.join(destination,directory));
const files=[];
function copy(relative){const source=path.join(plan.workspace,relative);if(!fs.existsSync(source))return;const stat=fs.lstatSync(source);if(stat.isSymbolicLink())return;if(stat.isDirectory()){if(['node_modules','.git'].includes(path.basename(source)))return;for(const name of fs.readdirSync(source))copy(path.join(relative,name));return}const bytes=fs.readFileSync(source);const to=path.join(destination,'code',relative);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,bytes);files.push({path:relative.replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')})}
for(const item of ['docs','dist','tests','reports','openspec','prompts','.opencode','scripts','opencode.json','package.json','STAGE-TASK.md'])copy(item);
const screenshots=[];
function copyScreens(directory,prefix){if(!fs.existsSync(directory))return;for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const source=path.join(directory,entry.name);const relative=path.join(prefix,entry.name);if(entry.isDirectory())copyScreens(source,relative);else if(/\.(png|jpe?g|webp)$/i.test(entry.name)){const bytes=fs.readFileSync(source);const to=path.join(destination,'screenshots',relative);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,bytes);screenshots.push({path:relative.replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')})}}}
copyScreens(path.join(plan.workspace,'artifacts/screenshots'),'tools');copyScreens(path.join(plan.workspace,'reports'),'reports');
fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify({profile,label,savedAt:new Date().toISOString(),model:plan.model,files,screenshots},null,2)+'\n');
console.log(JSON.stringify({checkpoint:destination,files:files.length,screenshots:screenshots.length,apiCalls:0}));
