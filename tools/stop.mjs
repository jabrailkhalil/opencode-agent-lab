import fs from 'node:fs';
import path from 'node:path';
import {inspectProcess,ownsProcess} from './runtime-platform.mjs';
const root=path.resolve(import.meta.dirname,'..'),file=path.join(root,'.runtime/services.json');
if(!fs.existsSync(file)){console.log('No saved services.');process.exit(0);}
const state=JSON.parse(fs.readFileSync(file,'utf8')),stopped=[],skipped=[];
for(const service of [...state.services].reverse()){
 const actual=inspectProcess(service.pid);
 if(!actual)continue;
 if(!ownsProcess(service,actual)){console.error('Skipped changed PID: '+service.name);skipped.push(service);continue;}
 try{process.kill(process.platform==='win32'?service.pid:-service.pid,'SIGTERM');stopped.push(service.name);}catch(error){if(error.code!=='ESRCH')console.error(service.name+': '+error.message);}
}
const exists=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
const deadline=Date.now()+5000;
while(Date.now()<deadline&&state.services.some(s=>stopped.includes(s.name)&&exists(s.pid)))await new Promise(r=>setTimeout(r,100));
const remaining=state.services.filter(s=>skipped.includes(s)||stopped.includes(s.name)&&exists(s.pid));
if(remaining.length){fs.writeFileSync(file,JSON.stringify({...state,services:remaining},null,2)+'\n');process.exitCode=1;}else fs.rmSync(file);
console.log('Stopped: '+stopped.join(', '));
