import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
export function openCodeExecutable(root){
 const dir=path.join(root,'node_modules/opencode-ai'),metadata=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
 const bin=typeof metadata.bin==='string'?metadata.bin:metadata.bin.opencode;
 const executable=path.resolve(dir,bin);
 if(!executable.startsWith(dir+path.sep)||!fs.existsSync(executable))throw Error('OpenCode не установлен. Выполните npm ci.');
 return executable;
}
export function inspectProcess(pid){
 if(!Number.isSafeInteger(Number(pid))||Number(pid)<=0)return null;
 if(process.platform==='win32'){
  const r=spawnSync('powershell.exe',['-NoProfile','-Command',`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${Number(pid)}'; if($p){[pscustomobject]@{ExecutablePath=$p.ExecutablePath;CreatedAt=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress}`],{encoding:'utf8',windowsHide:true});
  try{const p=JSON.parse(r.stdout);return {executable:p.ExecutablePath,createdAt:Date.parse(p.CreatedAt)};}catch{return null;}
 }
 const opts={encoding:'utf8',env:{...process.env,LC_ALL:'C'}};
 const created=spawnSync('ps',['-p',String(pid),'-o','lstart='],opts),command=spawnSync('ps',['-ww','-p',String(pid),'-o','command='],opts);
 if(created.status!==0||command.status!==0)return null;
 return {command:command.stdout.trim(),createdAt:Date.parse(created.stdout.trim())};
}
export function ownsProcess(service,actual){
 if(!actual||!Number.isFinite(actual.createdAt)||Math.abs(actual.createdAt-service.startedAt)>15000)return false;
 return actual.executable?path.resolve(actual.executable).toLowerCase()===path.resolve(service.executable).toLowerCase():actual.command===service.executable||actual.command.startsWith(service.executable+' ');
}
