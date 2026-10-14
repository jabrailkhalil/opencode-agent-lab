import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// Only request metadata and billed usage are stored. API credentials stay on the host.
export async function startProxy({credential,art,safe,port=4189,budgetUsd=20,model='anthropic/claude-sonnet-5.5',upstreamBase='https://openrouter.ai'}){
 let sequence=0,costUsd=0,requests=0,budgetStopped=false,unknownCost=false,unconfirmedUsd=0,failureStreak=0;
 let promptTokens=0,completionTokens=0,cachedTokens=0,reservedUsd=0,pricing=null;
 const file=path.join(art,'logs/api-requests.jsonl');
 async function reconcile(record){
  if(!record.generationID)return false;
  for(let attempt=0;attempt<3;attempt++){
   try{
    const response=await fetch(upstreamBase+'/api/v1/generation?id='+encodeURIComponent(record.generationID),{headers:{Authorization:'Bearer '+credential},signal:AbortSignal.timeout(10000)});
    const data=(await response.json()).data;
    if(response.ok&&typeof data?.total_cost==='number'){
     record.usage={cost:data.total_cost,prompt_tokens:data.native_tokens_prompt??data.tokens_prompt??0,completion_tokens:data.native_tokens_completion??data.tokens_completion??0,prompt_tokens_details:{cached_tokens:data.native_tokens_cached??0},completion_tokens_details:{reasoning_tokens:data.native_tokens_reasoning??0}};
     record.reconciled={source:'OpenRouter generation.total_cost',checkedAt:new Date().toISOString(),cancelled:data.cancelled};
     return true;
    }
   }catch{}
   if(attempt<2)await new Promise(r=>setTimeout(r,1000));
  }
  return false;
 }
 function account(record){
  const billed=record.usage?.cost;
  if(typeof billed==='number'&&Number.isFinite(billed)&&billed>=0){costUsd+=billed;promptTokens+=record.usage.prompt_tokens||0;completionTokens+=record.usage.completion_tokens||0;cachedTokens+=record.usage.prompt_tokens_details?.cached_tokens||0;failureStreak=0;}
  else if(!record.status||record.status===200){unknownCost=true;failureStreak++;if(Number.isFinite(record.reservationUsd)&&record.reservationUsd>0){unconfirmedUsd+=record.reservationUsd;record.costUpperBoundUsd=record.reservationUsd;}else budgetStopped=true;if(failureStreak>=3)budgetStopped=true;}
 }
 if(fs.existsSync(file)){
  const records=fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  for(const record of records){sequence=Math.max(sequence,record.sequence||0);if(record.model===model&&!record.rejected){requests++;if(record.usage?.cost==null&&(record.status===200||!record.status))await reconcile(record);account(record);record.cumulativeCostUsd=costUsd;}}
  fs.writeFileSync(file,records.map(record=>safe(JSON.stringify(record))).join('\n')+(records.length?'\n':''));
  if(costUsd+unconfirmedUsd>=budgetUsd)budgetStopped=true;
 }
 const usage=()=>({requests,costUsd,promptTokens,completionTokens,cachedTokens,budgetUsd,budgetStopped,unknownCost,unconfirmedUsd,costUpperBoundUsd:costUsd+unconfirmedUsd,reservedUsd});
 const server=http.createServer(async(req,res)=>{
  const start=Date.now(),record={sequence:++sequence,startedAt:new Date(start).toISOString(),route:req.url};
  let reservation=0,sent=false,chat=false,reserved=false;
  const reject=(status,message)=>{record.status=status;record.rejected=true;record.error=message;res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify({error:{message}}));};
  try{
   const chunks=[];for await(const bytes of req)chunks.push(bytes);
   const raw=Buffer.concat(chunks).toString();let body=raw;
   chat=req.url==='/api/v1/chat/completions'&&req.method==='POST';
   if(!chat){reject(404,'Only the configured chat completion route is available');return;}
   const j=JSON.parse(raw);
   if(j.model!==model){reject(400,'The request model does not match this run');return;}
   if(!pricing){reject(503,'Model pricing has not been verified');return;}
   if(budgetStopped){reject(402,'Run budget exhausted or previous billed usage unavailable');return;}
   for(const name of ['temperature','top_p','top_k','frequency_penalty','presence_penalty'])delete j[name];
   j.max_tokens=Math.min(j.max_tokens??j.max_completion_tokens??16384,16384);
   delete j.max_completion_tokens;
   if(j.stream)j.stream_options={...j.stream_options,include_usage:true};
   j.usage={include:true};
   body=JSON.stringify(j);
   // UTF-8 bytes bound text tokens conservatively. Reserve uncached input and the full output.
   reservation=Buffer.byteLength(body)*Number(pricing.prompt)*2+j.max_tokens*Number(pricing.completion)+Number(pricing.request||0);
   if(!Number.isFinite(reservation)||reservation<=0){reject(503,'No usable model pricing');return;}
   if(costUsd+unconfirmedUsd+reservedUsd+reservation>budgetUsd){budgetStopped=true;reject(402,'The remaining budget cannot cover the reserved next request');return;}
   reservedUsd+=reservation;reserved=true;
   Object.assign(record,{model:j.model,sampling:{preset:'model-default'},stream:j.stream,maxTokens:j.max_tokens,messageCount:j.messages?.length,requestBytes:Buffer.byteLength(body),toolCount:j.tools?.length||0,reservationUsd:reservation});
   const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
   requests++;sent=true;
   const upstream=await fetch(upstreamBase+req.url,{method:req.method,headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json','X-Title':'VTB Claude full rehearsal'},body,signal:controller.signal});
   record.status=upstream.status;record.headersMs=Date.now()-start;
   res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store'});
   let pending='',plain='',firstChunk=false;const decoder=new TextDecoder();
   const parsed=j=>{
    record.generationID??=j.id;record.provider??=j.provider;
    if(j.usage)record.usage=j.usage;
    for(const c of j.choices||[]){const d=c.delta||c.message||{};if(record.firstContentMs===undefined&&(d.content||d.tool_calls?.some(t=>t.function?.name||t.function?.arguments)))record.firstContentMs=Date.now()-start;if(c.finish_reason)record.finishReason=c.finish_reason;}
    if(j.error)record.apiError=j.error;
   };
   const inspect=frame=>{for(const line of frame.split('\n')){if(!line.startsWith('data:'))continue;const value=line.slice(5).trim();if(value==='[DONE]')continue;try{parsed(JSON.parse(value));}catch{}}};
   if(upstream.body){for await(const bytes of upstream.body){if(!firstChunk){record.firstByteMs=Date.now()-start;firstChunk=true;}res.write(bytes);const text=decoder.decode(bytes,{stream:true}).replaceAll('\r\n','\n');if(upstream.headers.get('content-type')?.includes('event-stream')){pending+=text;let at;while((at=pending.indexOf('\n\n'))>=0){inspect(pending.slice(0,at));pending=pending.slice(at+2);}}else plain+=text;}}
   inspect(pending);if(plain){try{parsed(JSON.parse(plain));}catch{}}
   res.end();
  }catch(e){record.error=safe(e.message);if(!res.headersSent)res.writeHead(502,{'Content-Type':'application/json'});if(!res.writableEnded)res.end(JSON.stringify({error:{message:safe(e.message)}}));}
  finally{
   if(sent){
    if(record.usage?.cost==null&&(record.status===200||!record.status))await reconcile(record);
    account(record);
    if(costUsd+unconfirmedUsd>=budgetUsd)budgetStopped=true;
   }
   if(reserved)reservedUsd-=reservation;
   record.durationMs=Date.now()-start;record.cumulativeCostUsd=costUsd;
   fs.appendFileSync(file,safe(JSON.stringify(record))+'\n');
  }
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 server.usage=usage;server.setPricing=value=>{pricing=value;};
 return server;
}
