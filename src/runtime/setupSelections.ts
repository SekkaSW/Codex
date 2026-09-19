import { permissionLabels, permissionTiers, type PermissionTier } from '../domain.js';
import { validateRankGraph, type StoredSetupDraft } from '../setup.js';
import { featureDescriptions } from './setupRefinement.js';
export interface PendingSelection { scope: string; kind: string; review: boolean; roles?: string[]; role?: string; tier?: PermissionTier; targets?: string[]; features?: string[] }
const kinds = ['permissions', 'rank-config', 'progress-next', 'features'];
const featureKeys = ['briefings','patrols','supply','atlas'] as const;
const featureLabels = ['Briefings','Patrol','Supply','Atlas'];
function scope(d: StoredSetupDraft) { const g=d.editor!.refinement!; return [g.step,g.index,g.branch,g.source].join('/'); }
function pending(d: StoredSetupDraft): PendingSelection {
 const g=d.editor!.refinement!, c=d.organization!;
 if(g.pending?.scope===scope(d)) return g.pending;
 const r=c.ranks[g.index], existing=r&&!g.newRanks?.includes(r.id);
 return {scope:scope(d),kind:g.step,review:false,...(g.step==='permissions'?{roles:c.permissions.filter(x=>x.tier===permissionTiers[g.index]).map(x=>x.roleId)}:{}),...(g.step==='rank-config'&&existing?{role:r.roleId,tier:r.tier}:{}),...(g.step==='progress-next'?{targets:c.edges.filter(e=>e.branchId===g.branch&&e.fromRankId===g.source).map(e=>e.toRankId)}:{}),...(g.step==='features'?{features:featureKeys.filter(k=>d.config.modules?.[k])}:{})};
}
export function selectionView(d:StoredSetupDraft):any|undefined {
 const g=d.editor!.refinement!; if(!kinds.includes(g.step))return;
 const p=pending(d),c=d.organization!,id=(a:string)=>`setup:${d.revision}:refine-${a}`;
 const button=(a:string,label:string)=>({type:2,style:2,custom_id:id(a),label}),rows:any[]=[];
 const row=(...components:any[])=>rows.push({type:1,components});
 const roleName=(r:string)=>d.roleNames?.[r]??`<@&${r}>`;
 const select=(action:string,options:any[],multiple=false)=>row({type:3,custom_id:id(action),placeholder:action==='tier'?'Choose permission level':'Choose next ranks',min_values:1,max_values:multiple?options.length:1,options});
 let text='';
 if(p.review){
  if(g.step==='permissions')text=`${permissionLabels[permissionTiers[g.index]!]} permissions\nYou selected: ${p.roles!.map(roleName).join(', ')||'No roles'}\nAre these all the roles you want at this permission level?`;
  if(g.step==='rank-config')text=`Confirm rank: ${c.ranks[g.index]!.name}\nDiscord role: ${roleName(p.role!)}\nPermission level: ${permissionLabels[p.tier!]}\nUse these settings for ${c.ranks[g.index]!.name}?`;
  if(g.step==='progress-next')text=`Confirm progression — ${c.branches.find(b=>b.id===g.branch)?.name}\n${c.ranks.find(r=>r.id===g.source)?.name} can advance to:\n${p.targets!.map(id=>'- '+c.ranks.find(r=>r.id===id)?.name).join('\n')||'No further ranks'}\nIs this correct?`;
  if(g.step==='features')text=`Confirm optional features\nEnabled: ${featureKeys.filter(k=>p.features!.includes(k)).map(k=>featureLabels[featureKeys.indexOf(k)]).join(', ')||'None'}\nNot enabled: ${featureKeys.filter(k=>!p.features!.includes(k)).map(k=>featureLabels[featureKeys.indexOf(k)]).join(', ')||'None'}\nAre these the features you want?`;
  row(button('accept','Confirm & Next'),button('change','Change Selection'));
 }else if(g.step==='permissions'){
  text=`${permissionLabels[permissionTiers[g.index]!]} permissions\nWhich Discord role(s) belong at this permission level?`;
  row({type:6,custom_id:id('role'),placeholder:'Choose permission roles',min_values:1,max_values:25,default_values:p.roles!.map(id=>({id,type:'role'}))});row(button('none','No Roles'));
 }else if(g.step==='rank-config'){
  const r=c.ranks[g.index]!; text=`Rank ${g.index+1} of ${c.ranks.length}: ${r.name}\nChoose its Discord role and permission level.\nDiscord role: ${p.role?roleName(p.role):'Unanswered'}\nPermission level: ${p.tier?permissionLabels[p.tier]:'Unanswered'}`;
  row({type:6,custom_id:id('role'),placeholder:'Choose Discord role',min_values:1,max_values:1,...(p.role?{default_values:[{id:p.role,type:'role'}]}:{})});
  select('tier',permissionTiers.map(value=>({value,label:permissionLabels[value],default:p.tier===value})));
  if(p.role&&p.tier)row(button('review-answer','Review These Settings'));
 }else if(g.step==='progress-next'){
  const all=c.ranks.filter(r=>r.id!==g.source),page=all.slice(g.page*25,g.page*25+25);
  text=`${c.branches.find(b=>b.id===g.branch)?.name} progression: ${c.ranks.find(r=>r.id===g.source)?.name}\nWhat rank(s) can this rank advance to?`;
  if(page.length)select('answer',page.map(r=>({value:r.id,label:r.name.slice(0,100),default:p.targets?.includes(r.id)})),true);
  row(button('end','This Is the Final Rank'));
  if(all.length>25)row(...(g.page?[button('previous','Previous')]:[]),...(all.length>(g.page+1)*25?[button('next','Next')]:[]));
 }else{
  text='Which optional features would you like to enable?\n\n'+Object.values(featureDescriptions).join('\n\n');
  row({type:3,custom_id:id('features'),placeholder:'Optional Features',min_values:0,max_values:4,options:featureKeys.map((value,n)=>({value,label:featureLabels[n],default:p.features?.includes(value)}))});row(button('none','No Optional Features'));
 }
 row(button('back','Back'),button('sections','Edit Section'),{...button('cancel','Cancel'),custom_id:`setup:${d.revision}:cancel`,style:4});
 return {content:`${g.notice?g.notice+'\n\n':''}${text}`.slice(0,1900),components:rows,allowedMentions:{parse:[]}};
}
export async function answerSelection(d:StoredSetupDraft,action:string,i:any):Promise<boolean>{
 const g=d.editor!.refinement!;if(!kinds.includes(g.step)||['back','sections','review','previous','next'].includes(action))return false;
 const p=pending(d),c=d.organization!,values:string[]=i.values??[];
 const validate=async()=>{
  if(g.step==='permissions'){
   const roles=await i.guild.roles.fetch();
   if(p.roles!.some(id=>id===d.guildId||!roles.has(id)))throw new Error('Choose existing roles other than @everyone.');
   if(c.permissions.some(x=>x.tier!==permissionTiers[g.index]&&p.roles!.includes(x.roleId)))throw new Error('A selected role already belongs to another permission level. Change that level first.');
   d.roleNames??={};for(const id of p.roles!)d.roleNames[id]=roles.get(id).name;
  }
  if(g.step==='rank-config'){
   if(p.tier&&!permissionTiers.includes(p.tier))throw new Error('Choose a listed permission level.');
   if(p.role){const role=await i.guild.roles.fetch(p.role);if(!role||role.id===d.guildId||!role.editable||role.managed)throw new Error('Choose an assignable role below the bot role.');d.roleNames??={};d.roleNames[p.role]=role.name;}
  }
  if(g.step==='progress-next'){
   if(p.targets!.some(id=>id===g.source||!c.ranks.some(r=>r.id===id)))throw new Error('Choose other ranks in this group.');
   try{validateRankGraph(c.ranks.map(r=>r.id),[...c.edges.filter(e=>e.branchId!==g.branch||e.fromRankId!==g.source),...p.targets!.map(toRankId=>({guildId:d.guildId,branchId:g.branch!,fromRankId:g.source!,toRankId}))]);}catch{throw new Error('Choose a progression that does not loop back to an earlier rank.');}
  }
  if(g.step==='features'&&p.features!.some(k=>!featureKeys.includes(k as any)))throw new Error('Choose listed optional features.');
 };
 if(action==='change'&&p.review){p.review=false;g.pending=p;return true;}
 if(action==='accept'&&p.review){
  await validate();
  const {history,pending:ignored,newRanks,...point}=g;history.push(structuredClone(point));g.history=history.slice(-100);delete g.pending;delete g.notice;
  if(g.step==='permissions'){const tier=permissionTiers[g.index]!;c.permissions=[...c.permissions.filter(x=>x.tier!==tier),...p.roles!.map(roleId=>({guildId:d.guildId,roleId,tier}))];if(g.index<4)g.index++;else{g.step='rank-list';g.index=0;}}
  else if(g.step==='rank-config'){const r=c.ranks[g.index]!;r.roleId=p.role!;r.tier=p.tier!;g.newRanks=(g.newRanks ?? []).filter(id=>id!==r.id);if(g.index+1<c.ranks.length)g.index++;else g.step='branches';}
  else if(g.step==='progress-next'){
   c.edges=[...c.edges.filter(e=>e.branchId!==g.branch||e.fromRankId!==g.source),...p.targets!.map(toRankId=>({guildId:d.guildId,branchId:g.branch!,fromRankId:g.source!,toRankId}))];
   g.visited=[...new Set([...g.visited,g.source!])];g.queue=[...new Set([...p.targets!,...g.queue])].filter(id=>!g.visited.includes(id));
   const next=g.queue.shift();if(next)g.source=next;else g.step=c.branches.find(b=>b.id===g.branch)?.name==='General progression'?'duty-list':'branch-more';
  }else{for(const key of featureKeys)d.config.modules![key]=p.features!.includes(key);g.step='command-channel';}
  g.page=0;return true;
 }
 if(p.review)throw new Error('Confirm this answer or choose Change Selection.');
 if(g.step==='permissions'&&(action==='role'||action==='none'))p.roles=action==='none'?[]:[...new Set(values)];
 else if(g.step==='rank-config'&&action==='role')p.role=values[0]!;
 else if(g.step==='rank-config'&&action==='tier')p.tier=values[0] as PermissionTier;
 else if(g.step==='rank-config'&&action==='review-answer'&&p.role&&p.tier){}
 else if(g.step==='progress-next'&&(action==='answer'||action==='end'))p.targets=action==='end'?[]:[...new Set(values)];
 else if(g.step==='features'&&(action==='features'||action==='none'))p.features=action==='none'?[]:[...new Set(values)];
 else throw new Error('Answer the current question using its selection controls.');
 await validate();p.review=g.step!=='rank-config'||!!(p.role&&p.tier);g.pending=p;delete g.notice;return true;
}
