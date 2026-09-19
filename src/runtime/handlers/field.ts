import { requireFeature } from '../features.js';
import { AdvancementService, TrailmarkLifecycle, type AccessSession, type AdvancementCase, type FieldStore, type FieldTrailmark } from '../../field.js';
import type { MemberRepositories } from './members.js';
import type { Registry } from '../../resources.js';
import { choices, interactionUuid, replyText, requireTier, textModal } from '../interactions.js';
import { DiscordTrailmarkAccess } from '../trailmarkAccess.js';
import { desiredMemberRoles } from '../../administration.js';
import { permissionTiers } from '../../domain.js';
export type FieldRepositories=FieldStore&MemberRepositories&Registry;

export async function handleField(i:any,store:FieldRepositories):Promise<void>{
 const parts:string[]=i.customId?.split(':')??[];const component=parts.length>0;
 if(component&&parts[1]!==i.user.id)throw new Error('Open your own command panel to use this action');
 const system=component?parts[2]!:i.commandName==='advancement'?'adv':'trail';
 if(system==='trail')await requireFeature(store,i.guildId,'trailmark');
 const action=component?parts[3]!:i.options.getSubcommand();
 const context=component?parts[4]??'':i.options.getUser('member')?.id??'';
 const page=parts[5]==='page'?Number(parts[6]):0;
 const selected=component&&i.values?i.values[0]:undefined;
 const prefix=`field:${i.user.id}:${system}:${action}:${context}`;
 if(system==='trail'&&['create','report-form','edit-form','atlas-form','minutes-form'].includes(action)&&!i.isModalSubmit()){
  await requireTier(i,store,action==='report-form'?'BASELINE':'LEVEL_3');
  const trailmark=action==='edit-form'?await store.trailmark(i.guildId,'get',i.user.id,context.split('/')[0]):undefined;
  const fields=action==='atlas-form'?[{id:'atlas_id',label:'Atlas location identifier',max:200},...['x','y','z'].map(axis=>({id:axis,label:`Optional ${axis.toUpperCase()} coordinate`,max:30,optional:true}))]:action==='minutes-form'?[{id:'minutes',label:'Access duration in minutes (1–10080)',max:5}]:action==='report-form'?[{id:'body',label:'Report',max:4000,paragraph:true}]:[{id:'name',label:'Trailmark name',...(trailmark?{value:trailmark.name}:{})},{id:'description',label:'Description',max:2000,paragraph:true,...(trailmark?.description?{value:trailmark.description}:{})}];
  await i.showModal(textModal(`field:${i.user.id}:trail:${action}:${context}`,'Trailmark',fields));return;
 }
 if(component&&!i.isModalSubmit())await i.deferUpdate();else await i.deferReply({ephemeral:true});
 if(system==='adv'){
  const service=new AdvancementService(store);
  if(action==='setup'){
   await requireTier(i,store,'ADMIN');await store.advancement(i.guildId,'setup',i.user.id,undefined,{voter_tier:i.options.getString('voter-tier',true),minimum_yes:i.options.getInteger('minimum-yes',true)});await i.editReply(replyText('Advancement ballot rules saved. Existing cases retain their snapshotted rules.'));return;
  }
  await requireTier(i,store,['open','close','approve','deny'].includes(action)?'LEVEL_3':'BASELINE');
  if(action==='eligible'||action==='open'){
   if(!context)throw new Error('Select a candidate');const options=await service.eligible(i.guildId,context);
   if(action==='eligible'){await i.editReply(replyText(`Eligible next ranks: ${options.map(x=>x.name).join(', ')||'none'}`));return;}
   if(!selected){await i.editReply(choices(prefix,options.slice(page*25,page*25+25),page,(page+1)*25<options.length));return;}
   if(!options.some(x=>x.id===selected))throw new Error('That advancement edge is no longer valid');
   const record=await store.advancement(i.guildId,'open',i.user.id,undefined,{candidate_id:context,to_rank_id:selected});await i.editReply(replyText(`Opened advancement case ${record.id}. Eligible members can use /advancement ballots.`));return;
  }
  if(action==='yes'||action==='no'){
   const record=await store.advancement(i.guildId,'get',i.user.id,context);
   await requireTier(i,store,record.snapshot.settings.voter_tier,record.snapshot.organization.permissions);
   await store.advancement(i.guildId,'vote',i.user.id,record.id,{approve:action==='yes'});await i.editReply(replyText('Ballot saved. Each eligible voter may vote once.'));return;
  }
  if(!selected){const cases=await store.advancement<AdvancementCase[]>(i.guildId,'list',i.user.id,undefined,{page});await i.editReply(choices(prefix,cases.map(c=>({id:`${c.id}/${c.revision}`,name:`${c.status}: ${c.candidate_id} → ${c.snapshot.organization.ranks.find(r=>r.id===c.to_rank_id)?.name??c.to_rank_id}`})),page,cases.length===25));return;}
  const [caseId,revision]=selected.split('/');const record=await store.advancement(i.guildId,'get',i.user.id,caseId);
  if(record.revision!==Number(revision))throw new Error('This case changed. Refresh the command panel');
  if(action==='ballots'){
   await requireTier(i,store,record.snapshot.settings.voter_tier,record.snapshot.organization.permissions);
   await i.editReply({content:`Case ${record.id}: ${record.status}. Yes ${record.yes}, no ${record.no}.`,components:record.status==='OPEN'?[{type:1,components:['yes','no'].map(v=>({type:2,style:v==='yes'?3:4,label:v==='yes'?'Approve':'Oppose',custom_id:`field:${i.user.id}:adv:${v}:${record.id}`}))}]:[]});return;
  }
  if(action==='approve'){
   const member=await i.guild.members.fetch({user:record.candidate_id,force:true}),roles=await i.guild.roles.fetch();
   const before=await store.member(i.guildId,record.candidate_id),config=await store.organization(i.guildId);
   if(!before)throw new Error('Candidate record is missing');for(const id of desiredMemberRoles({...before,rankId:record.to_rank_id},config))if(!roles.has(id))throw new Error('A configured role is missing; repair configuration before approval');
   await service.approve(i.guildId,record.id,i.user.id,{roles:new Set<string>(member.roles.cache.keys()),async add(id){await member.roles.add(id,'Advancement approval');},async remove(id){if(roles.has(id))await member.roles.remove(id,'Advancement approval');}});
  }else if(action==='close'||action==='deny')await store.advancement(i.guildId,action,i.user.id,record.id,{revision:record.revision,reason:'Reviewer decision'});
  else if(action!=='status')throw new Error('Unknown advancement operation');
  const current=await store.advancement(i.guildId,'get',i.user.id,record.id);await i.editReply(replyText(`Case ${current.id}: ${current.status}. Yes ${current.yes}, no ${current.no}. Candidate ${current.candidate_id}.`));return;
 }
 const adapter=new DiscordTrailmarkAccess(i.guild,store),lifecycle=new TrailmarkLifecycle(store,adapter);
 if(action!=='leave')await requireTier(i,store,['create','edit','edit-form','deactivate','set-atlas','clear-atlas','hq','sessions','repair','configure','atlas-form','rules-form','minutes-form','tier'].includes(action)?'LEVEL_3':'BASELINE');
 if(['atlas-form','rules-form','minutes-form','tier'].includes(action)){
  const [id,revision]=context.split('/');const t=await store.trailmark(i.guildId,'get',i.user.id,id);
  if(t.revision!==Number(revision))throw new Error('Trailmark changed; reopen configuration');
  if(action==='rules-form'){await i.editReply({content:`Access: ${t.access_tier}; duration ${t.session_minutes} minutes.`,components:[{type:1,components:[{type:3,custom_id:`field:${i.user.id}:trail:tier:${context}`,placeholder:'Minimum access tier',options:permissionTiers.map(tier=>({label:tier,value:tier}))}]},{type:1,components:[{type:2,style:1,label:'Change duration',custom_id:`field:${i.user.id}:trail:minutes-form:${context}`}]}]});return;}
  if(action==='atlas-form'){const values=['x','y','z'].map(axis=>i.fields.getTextInputValue(axis).trim());const coordinates=values.some(Boolean)?{x:Number(values[0]),y:Number(values[1]),z:Number(values[2])}:null;if(coordinates&&(!values.every(Boolean)||!Object.values(coordinates).every(Number.isFinite)))throw new Error('Provide all three finite coordinates or leave all blank');await store.trailmark(i.guildId,'atlas',i.user.id,id,{revision:t.revision,atlas_id:i.fields.getTextInputValue('atlas_id').trim(),coordinates});}
  else {const minutes=action==='minutes-form'?Number(i.fields.getTextInputValue('minutes')):t.session_minutes;if(!Number.isInteger(minutes)||minutes<1||minutes>10080)throw new Error('Duration must be an integer from 1 to 10080 minutes');if(action==='tier'&&!permissionTiers.includes(selected))throw new Error('Unknown permission tier');await store.trailmark(i.guildId,'edit',i.user.id,id,{revision:t.revision,name:t.name,description:t.description,access_tier:action==='tier'?selected:t.access_tier,session_minutes:minutes});}
  await i.editReply(replyText('Trailmark configuration saved.'));return;
 }
 if(action==='create'){
  const trailmark=await store.trailmark(i.guildId,'create',i.user.id,interactionUuid(i.id),{name:i.fields.getTextInputValue('name').trim(),description:i.fields.getTextInputValue('description').trim()});
  const ready=await adapter.ensure(trailmark);await i.editReply(replyText(`Created ${ready.name}: <#${ready.channel_id}>.`));return;
 }
 if(action==='leave'){await lifecycle.leave(i.guildId,i.user.id);await i.editReply(replyText('Trailmark access revoked.'));return;}
 if(action==='sessions'){const sessions=await store.trailmark<AccessSession[]>(i.guildId,'sessions',i.user.id,undefined,{all:true,page:i.options?.getInteger?.('page')??0});await i.editReply({content:`${sessions.length} active/pending sessions on this page; use the next page if this contains 100.`,files:[{attachment:Buffer.from(JSON.stringify(sessions,null,2)),name:'sessions.json'}]});return;}
 if(action==='report-form'||action==='edit-form'){
  const [id,revision]=context.split('/');const trailmark=await store.trailmark(i.guildId,'get',i.user.id,id);
  if(action==='edit-form'){await store.trailmark(i.guildId,'edit',i.user.id,id,{revision:Number(revision),name:i.fields.getTextInputValue('name').trim(),description:i.fields.getTextInputValue('description').trim()});await i.editReply(replyText('Trailmark details updated; its Discord name and position were preserved.'));return;}
  if(!(await adapter.eligible(trailmark,i.user.id)))throw new Error('You are not eligible for this Trailmark');
  const sessions=await store.trailmark<AccessSession[]>(i.guildId,'sessions',i.user.id);
  if(!sessions.some(s=>s.trailmark_id===id&&s.state==='ACTIVE'&&Date.parse(s.expires_at)>Date.now()))throw new Error('Request access to this Trailmark before reporting');
  const result=await store.trailmark<{id:string;status:string}>(i.guildId,'report',i.user.id,id,{id:interactionUuid(i.id),body:i.fields.getTextInputValue('body'),interaction_id:i.id});await i.editReply(replyText(`Report ${result.id} saved: ${result.status==='AT_HQ'?'at Headquarters':'pending Headquarters delivery'}.`));return;
 }
 if(!selected){const marks=await store.trailmark<FieldTrailmark[]>(i.guildId,'list',i.user.id,undefined,{page});const valid=marks.filter(t=>t.active||['edit','repair'].includes(action));await i.editReply(choices(prefix,valid.map(t=>({id:`${t.id}/${t.revision}`,name:`${t.name}${t.is_headquarters?' (HQ)':''}${t.active?'':' (inactive)'}`})),page,marks.length===25));return;}
 const [id,revision]=selected.split('/');const t=await store.trailmark(i.guildId,'get',i.user.id,id);
 if(t.revision!==Number(revision))throw new Error('Trailmark changed; refresh this panel');
 if(action==='panel'){await lifecycle.access(i.guildId,id,i.user.id);await i.editReply(replyText(`Access granted to <#${(await store.trailmark(i.guildId,'get',i.user.id,id)).channel_id}> for ${t.session_minutes} minutes.`));return;}
 if(action==='edit'||action==='report'){
  // A button opens the modal in a new interaction, after this selection is acknowledged.
  const next=action==='edit'?'edit-form':'report-form';await i.editReply({content:t.name,components:[{type:1,components:[{type:2,style:1,label:action==='edit'?'Edit details':'Write report',custom_id:`field:${i.user.id}:trail:${next}:${id}/${t.revision}`}]}]});return;
 }
 if(action==='repair')await adapter.ensure(t);
 else if(action==='deactivate'){await store.trailmark(i.guildId,'deactivate',i.user.id,id,{revision:t.revision});const result=await lifecycle.reconcile(i.guildId,i.user.id);if(result.failures.length)throw new Error('Deactivated; session revocation needs retry');}
 else if(action==='hq')await store.trailmark(i.guildId,'hq',i.user.id,id,{revision:t.revision});
 else if(action==='clear-atlas')await store.trailmark(i.guildId,'atlas',i.user.id,id,{revision:t.revision});
 else if(action==='set-atlas'||action==='configure'){
  await i.editReply({content:'Use the configuration form to update this Trailmark.',components:[{type:1,components:[{type:2,style:1,label:action==='set-atlas'?'Set Atlas linkage':'Set access rules',custom_id:`field:${i.user.id}:trail:${action==='set-atlas'?'atlas-form':'rules-form'}:${id}/${t.revision}`}]}]});return;
 }
 else if(action==='list'){await i.editReply(replyText(`${t.name}\n${t.description}\nResource: <#${t.channel_id}>\nAccess: ${t.access_tier}; ${t.session_minutes} minutes\nHeadquarters: ${t.is_headquarters}\nAtlas: ${t.atlas_id??'none'}`));return;}
 else throw new Error('Unknown Trailmark operation');
 await i.editReply(replyText('Trailmark change saved and audited.'));
}
