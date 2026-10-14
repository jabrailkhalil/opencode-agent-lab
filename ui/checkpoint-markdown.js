export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function plainInline(value){
 const chunks=String(value).split(/(`[^`]+`)/g);
 return chunks.map(chunk=>{
  if(chunk.startsWith('`')&&chunk.endsWith('`'))return '<code>'+escapeHtml(chunk.slice(1,-1))+'</code>';
  return escapeHtml(chunk).replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 <span class="muted">($2)</span>');
 }).join('');
}
function inline(value){return String(value).split(/(\*\*.+?\*\*)/g).map(chunk=>chunk.startsWith('**')&&chunk.endsWith('**')?'<strong>'+plainInline(chunk.slice(2,-2))+'</strong>':plainInline(chunk)).join('');}
export function markdown(value,prefix='document-heading'){
 const lines=String(value).replace(/\r/g,'').split('\n'),out=[];
 let index=0,heading=0;
 const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>cell.trim());
 const marker=line=>{const match=line?.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);return match?{indent:match[1].replace(/\t/g,'    ').length,ordered:/\d/.test(match[2]),number:parseInt(match[2],10),text:match[3]}:null;};
 function list(){
  const first=marker(lines[index]),tag=first.ordered?'ol':'ul';let html='<'+tag+(first.ordered&&first.number!==1?' start="'+first.number+'"':'')+'>';
  while(index<lines.length){
   const item=marker(lines[index]);if(!item||item.indent!==first.indent||item.ordered!==first.ordered)break;
   html+='<li>'+inline(item.text);index++;
   while(index<lines.length){
    if(!lines[index].trim()){
     let next=index+1;while(next<lines.length&&!lines[next].trim())next++;
     if((marker(lines[next])?.indent??-1)>=first.indent){index=next;continue;}break;
    }
    const nested=marker(lines[index]);
    if(nested){if(nested.indent>first.indent){html+=list();continue;}break;}
    const indentation=lines[index].match(/^\s*/)[0].length;
    if(indentation>first.indent){html+='<br>'+inline(lines[index].trim());index++;continue;}break;
   }
   html+='</li>';
  }
  return html+'</'+tag+'>';
 }
 while(index<lines.length){
  const line=lines[index];
  if(!line.trim()){index++;continue;}
  if(/^\s*```/.test(line)){
   const code=[];index++;while(index<lines.length&&!/^\s*```/.test(lines[index]))code.push(lines[index++]);
   if(index<lines.length)index++;out.push('<pre class="source-code"><code>'+escapeHtml(code.join('\n'))+'</code></pre>');continue;
  }
  const title=line.match(/^(#{1,6})\s+(.+)$/);
  if(title){out.push('<h'+title[1].length+' id="'+prefix+'-'+heading+++'" data-document-heading>'+inline(title[2])+'</h'+title[1].length+'>');index++;continue;}
  if(index+1<lines.length&&line.includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[index+1])){
   const header=cells(line);index+=2;const rows=[];
   while(index<lines.length&&lines[index].includes('|')&&lines[index].trim())rows.push(cells(lines[index++]));
   out.push('<div class="table-scroll"><table><thead><tr>'+header.map(cell=>'<th>'+inline(cell)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+inline(cell)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');continue;
  }
  if(marker(line)){out.push(list());continue;}
  if(/^>\s?/.test(line)){out.push('<blockquote>'+inline(line.replace(/^>\s?/,''))+'</blockquote>');index++;continue;}
  const paragraph=[line];index++;
  while(index<lines.length&&lines[index].trim()&&!/^(#{1,6}\s|\s*```|\s*([-*+]\s+|\d+\.\s+)|>)/.test(lines[index])&&!(index+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[index+1])))paragraph.push(lines[index++]);
  out.push('<p>'+inline(paragraph.join('\n'))+'</p>');
 }
 return out.join('\n');
}
