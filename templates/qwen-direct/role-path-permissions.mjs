import path from 'node:path';
export function bindRolePaths(config,workspace){
 const prefix=path.resolve(workspace).replaceAll('\\','/');
 // Non-Git Windows projects report worktree="/". OpenCode's edit tool then
 // asks for a drive-root-relative path (Users/...); keep it workspace-scoped.
 const rootRelativePrefix=prefix.replace(/^[A-Za-z]:\//,'').replace(/^\//,'');
 for(const role of Object.values(config.agent||{})){
  const edit=role.permission?.edit;if(!edit||typeof edit!=='object')continue;
  const relative=new Map();
  for(const [pattern,action] of Object.entries(edit)){
   if(path.win32.isAbsolute(pattern)||path.posix.isAbsolute(pattern))continue;
   const normalized=pattern.replaceAll('\\','/');
   if(/^Users\//i.test(normalized))continue;
   relative.set(normalized,action);
  }
  const bound={};
  for(const [pattern,action] of relative){
   bound[pattern]=action;
   if(pattern==='*')continue;
   bound[pattern.replaceAll('/','\\')]=action;
   bound[prefix+'/'+pattern]=action;
   bound[(prefix+'/'+pattern).replaceAll('/','\\')]=action;
   bound[rootRelativePrefix+'/'+pattern]=action;
   bound[(rootRelativePrefix+'/'+pattern).replaceAll('/','\\')]=action;
  }
  role.permission.edit=bound;
 }
 return config;
}
