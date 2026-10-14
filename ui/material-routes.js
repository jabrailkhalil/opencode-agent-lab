// Shared materials live in Comparison; checkpoints stay in their model's pult.
const shared={requests:'compare-all','comparison-method':'compare-method','direct-result':'compare-method','qwen-result':'compare-models','compare-all':'compare-all','compare-method':'compare-method','compare-models':'compare-models','spec-driven':'spec-driven',review:'review',metrics:'metrics',release:'release',interactive:'conclusion',conclusion:'conclusion','error-1':'error-1','error-2':'error-2','error-3':'error-3','error-4':'error-4'};
export const comparisonSection=screen=>String(screen||'').split('~')[0]==='compare-qwen'?'compare-qwen':shared[String(screen||'').split('~')[0]]||null;
export const profileFor=screen=>String(screen).startsWith('flash-')?'qwen':'claude';
export const materialTarget=screen=>comparisonSection(screen)?'vtb-comparison':'vtb-console-'+profileFor(screen);
export function materialUrl(screen,tab,file,base=''){
 const section=comparisonSection(screen);
 return section?base+'/comparison#'+section:base+'/?profile='+profileFor(screen)+'#'+screen+(tab?'~'+tab:'')+(file?'~'+encodeURIComponent(file):'');
}
