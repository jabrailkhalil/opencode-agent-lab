import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const checks=[];
const add=(name,ok,detail)=>checks.push({name,ok,detail});
const [major,minor]=process.versions.node.split('.').map(Number);
add('Node.js',major>22||(major===22&&minor>=14),process.version);
add('Tested operating system',process.platform==='win32',process.platform+' / '+process.arch);
const pkg=path.join(root,'node_modules/opencode-ai/package.json');
let executable;
if(fs.existsSync(pkg)){
 const metadata=JSON.parse(fs.readFileSync(pkg,'utf8'));
 const binary=typeof metadata.bin==='string'?metadata.bin:metadata.bin.opencode;
 executable=path.resolve(path.dirname(pkg),binary);
 const version=spawnSync(executable,['--version'],{encoding:'utf8',windowsHide:true,timeout:10000});
 add('Pinned OpenCode',version.status===0&&version.stdout.trim()==='1.18.34',version.status===0?version.stdout.trim():'Run INSTALL-WINDOWS.cmd');
}else add('Pinned OpenCode',false,'Run INSTALL-WINDOWS.cmd');
add('Replay input files',['data/workshop.json','data/checkpoints.json','docs/pdf/OpenCode-Step-by-Step-2026-10-07.pdf'].every(p=>fs.existsSync(path.join(root,p))),'recordings and PDF');
const used=[];
for(const port of [4096,4097,4191,4192,4201,4216,4217]){
 const open=await new Promise(resolve=>{const socket=net.connect(port,'127.0.0.1');const done=v=>{socket.destroy();resolve(v)};socket.setTimeout(500,()=>done(false));socket.once('connect',()=>done(true));socket.once('error',()=>done(false));});
 if(open)used.push(port);
}
let own=false;
if(used.includes(4201))try{const health=await fetch('http://127.0.0.1:4201/health',{signal:AbortSignal.timeout(1500)}).then(r=>r.json());own=health.app==='opencode-agent-lab'&&path.resolve(health.root)===root;}catch{}
add('Local ports',!used.length||own,used.length?(own?'This copy is already running: ':'Occupied by another process: ')+used.join(', '):'All seven ports are free');
const report={ready:checks.every(c=>c.ok),platform:process.platform,architecture:process.arch,checks,paidApiCalls:0};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));else for(const c of checks)console.log((c.ok?'OK   ':'FAIL ')+c.name+': '+c.detail);
if(!report.ready)process.exitCode=1;
