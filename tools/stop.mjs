import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),file=path.join(root,'.runtime/services.json');
if(!fs.existsSync(file)){console.log('No saved services.');process.exit(0);}
const state=JSON.parse(fs.readFileSync(file,'utf8')),stopped=[];
for(const service of [...state.services].reverse()){
 if(process.platform==='win32'){
  const result=spawnSync('powershell.exe',['-NoProfile','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${Number(service.pid)}'; if($p){[pscustomobject]@{ExecutablePath=$p.ExecutablePath;CreatedAt=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress}`],{encoding:'utf8',windowsHide:true});
  let actual;try{actual=JSON.parse(result.stdout)}catch{continue;}
  if(path.resolve(actual.ExecutablePath||'').toLowerCase()!==path.resolve(service.executable||'').toLowerCase()||Math.abs(Date.parse(actual.CreatedAt)-service.startedAt)>15000){console.error('Skipped changed PID: '+service.name);continue;}
 }
 try{process.kill(service.pid);stopped.push(service.name);}catch(error){if(error.code!=='ESRCH')console.error(service.name+': '+error.message);}
}
fs.rmSync(file);
console.log('Stopped: '+stopped.join(', '));
