import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const id=process.argv[2]||'qwen-spec';
if(!['qwen-spec','qwen-direct','sonnet-spec','sonnet-direct'].includes(id))throw new Error('Choose qwen-spec, qwen-direct, sonnet-spec or sonnet-direct');
const destination=path.join(root,'.runtime','api-projects',id+'-'+new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(path.dirname(destination),{recursive:true});fs.cpSync(path.join(root,'templates',id),destination,{recursive:true});
const prep=await import(path.join(destination,'prepare-project.mjs'));
console.log(destination);

