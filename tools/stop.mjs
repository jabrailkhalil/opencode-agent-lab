import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectProcess,ownsProcess} from './runtime-platform.mjs';
const root=path.resolve(import.meta.dirname,'..'),file=path.join(root,'.runtime/services.json');
if(!fs.existsSync(file)){console.log('No saved services.');process.exit(0);}
const state=JSON.parse(fs.readFileSync(file,'utf8')),stopped=[];
for(const service of [...state.services].reverse()){
 const actual=inspectProcess(service.pid);
 if(!actual)continue;
 if(!ownsProcess(service,actual)){console.error('Skipped changed PID: '+service.name);continue;}
 try{process.kill(process.platform==='win32'?service.pid:-service.pid,'SIGTERM');stopped.push(service.name);}catch(error){if(error.code!=='ESRCH')console.error(service.name+': '+error.message);}
}
fs.rmSync(file);
console.log('Stopped: '+stopped.join(', '));
