import type { IntelligenceStore,ContactRow,ReportRow,TopicRow } from '../../intelligence.js';
import type { FieldRepositories } from './field.js';
import { choices,interactionUuid,replyText,requireTier,textModal } from '../interactions.js';
import { DiscordIntelligence } from '../intelligenceDiscord.js';
export type IntelligenceRepositories=FieldRepositories&IntelligenceStore;
export async function handleIntelligence(i:any,store:IntelligenceRepositories):Promise<void>{
 const component=!!i.customId,parts=component?i.customId.split(':'):[],owner=parts[1];
 if(component&&owner!==i.user.id)throw new Error('This panel belongs to another user');
 const family=component?parts[2]:i.commandName,action=component?parts[3]:i.options.getSubcommand();
 await requireTier(i,store,family==='contact'||!['reports','deliver','link-report','report-links','report-options'].includes(action)?'LEVEL_3':'BASELINE');
 const guild=i.guildId,actor=i.user.id,base=`intel:${actor}:${family}`,discord=new DiscordIntelligence(i.guild,store);
 const selected=i.values?.[0]??parts[4],page=parts.includes('page')?Number(parts.at(-1)):0;
 const modal=(name:string,id?:string)=>textModal(`${base}:${name}:${id??'new'}`,name.startsWith('topic')?'Report topic':'Contact details',name.startsWith('topic')?[{id:'name',label:'Name',max:100},{id:'keywords',label:'Comma-separated keywords',max:1000},{id:'priority',label:'Priority (lowest first)',value:'0',max:8}]:[{id:'name',label:'Name',max:100},{id:'description',label:'Details',paragraph:true,max:2000,optional:true}]);
 if(!component&&['topic-add','create','create-group'].includes(action)){await i.showModal(modal(action));return;}
 if(component&&action==='edit-form'){const [id,revision]=selected.split('~');const row=family==='contact'?await store.intelligence<ContactRow>(guild,'contact-get',actor,id):(await store.intelligence<TopicRow[]>(guild,'topics',actor)).find(t=>t.id===id);if(!row||row.revision!==Number(revision))throw new Error('Record changed; reopen the editor');const form=modal(family==='contact'?'save-contact':'topic-save',selected);form.components[0].components[0].value=row.name;if('description'in row&&row.description)form.components[1].components[0].value=row.description;if('keywords'in row){form.components[1].components[0].value=row.keywords.join(', ');form.components[2].components[0].value=String(row.priority);}await i.showModal(form);return;}
 await i.deferReply({ephemeral:true});
 const linkOptions=async(kind:'group'|'report',context:string,p=0)=>{const rows=await store.intelligence<ContactRow[]>(guild,'contacts',actor,undefined,{page:p,active:true,...(kind==='group'?{kind:'CONTACT'}:{})});const menu=choices(`${base}:${kind==='group'?'group-save':'report-links'}:${context}`,rows.map(c=>({id:c.id,name:c.name})),p,rows.length===25);menu.content='Select a Contact to toggle its link. Reopen this panel after each change.';if(menu.components?.[1])for(const button of menu.components[1].components)button.custom_id=button.custom_id.replace(kind==='group'?':group-save:':':report-links:',kind==='group'?':group-options:':':report-options:');await i.editReply(menu);};
 if(component&&['group-options','report-options'].includes(action)){await linkOptions(action==='group-options'?'group':'report',parts[4],page);return;}
 if(component&&['member-add','member-remove','group-save','report-links'].includes(action)){
  const [id,revision]=parts[4].split('~');
  if(action==='report-links'){const r=await store.intelligence<ReportRow>(guild,'report-get',actor,id);if(r.reporter_id!==actor)await requireTier(i,store,'LEVEL_3');const links=new Set([...r.linked_contact_ids,...r.linked_group_ids]);links.has(i.values[0])?links.delete(i.values[0]):links.add(i.values[0]);await store.intelligence(guild,'report-links',actor,id,{ids:[...links]});if(r.delivery_status!=='CAPTURED')await discord.pipeline.process(guild,id);}
  else if(action==='group-save'){const c=await store.intelligence<ContactRow>(guild,'contact-get',actor,id),links=new Set(c.contacts??[]);links.has(i.values[0])?links.delete(i.values[0]):links.add(i.values[0]);await store.intelligence(guild,'contact-group',actor,id,{revision:Number(revision),contacts:[...links]});}
  else {await i.guild.members.fetch(i.values[0]);await store.intelligence(guild,action==='member-add'?'contact-link':'contact-unlink',actor,id,{revision:Number(revision),member:i.values[0]});}
  await i.editReply(replyText('Links saved.'));return;
 }
 if(i.isModalSubmit()){
  const name=i.fields.getTextInputValue('name').trim(),[id,revision]=(selected??'new').split('~');
  if(action.startsWith('topic')){const keywords=i.fields.getTextInputValue('keywords').split(',').map((s:string)=>s.trim()).filter(Boolean),priority=Number(i.fields.getTextInputValue('priority'));if(!Number.isSafeInteger(priority)||Math.abs(priority)>100000)throw new Error('Priority must be an integer from -100000 to 100000');await store.intelligence(guild,'topic-save',actor,id==='new'?undefined:id,{name,keywords,priority,revision:Number(revision)});await discord.refresh();}
  else {const description=i.fields.getTextInputValue('description');const contact=await store.intelligence<ContactRow>(guild,action==='save-contact'?'contact-edit':'contact-create',actor,id==='new'?interactionUuid(i.id):id,{name,description,kind:action==='create-group'?'GROUP':'CONTACT',revision:Number(revision)});if(contact.kind==='CONTACT')await discord.contact(contact);}
  await i.editReply(replyText('Saved.'));return;
 }
 if(!component){
  if(action==='recover-delivery'){const key=i.options.getString('key',true),messageId=i.options.getString('message',true),receipt=await store.intelligence<any>(guild,'delivery-get',actor,undefined,{key});if(!receipt||receipt.state!=='SENDING')throw new Error('No uncertain delivery with this key');const channel=await discord.fetch(receipt.channel_id);if(!channel||channel.type===15)throw new Error('Forum recovery uses /contact repair; this command recovers report messages');const message=await channel.messages.fetch(messageId);if(message.author.id!==i.guild.client.user.id||!message.embeds.some((e:any)=>e.footer?.text===`codex-delivery:${key}`))throw new Error('Message is not the original bot delivery');await store.intelligence(guild,'delivery-complete',actor,undefined,{key,message:messageId});await i.editReply(replyText('Original message receipt recovered. Retry backfill.'));return;}
  if(['setup','repair','refresh','repair-reporters','catchall-clear'].includes(action)){if(action==='catchall-clear'){// Clear the override by binding a managed default, retaining historical channels.
    const channel=await discord.resource('EXTRA:intel-default-catchall','reports-general');await store.put({guildId:guild,key:'REPORT_CATCHALL',discordId:channel,kind:'CHANNEL'});
   }await discord.refresh();if(family==='contact'&&action==='repair'){for(const c of await store.intelligence<ContactRow[]>(guild,'contacts',actor,undefined,{page:i.options.getInteger('page')??0})){if(c.active&&c.kind==='CONTACT')await discord.contact(c);else if(!c.active&&c.forum_thread_id){const thread=await discord.fetch(c.forum_thread_id);if(thread?.isThread()&&!thread.archived)await thread.setArchived(true);}}}await i.editReply(replyText('Intelligence resources are ready. Existing IDs and administrator names are preserved.'));return;}
  if(action==='catchall-set'){const channel=i.options.getChannel('channel',true);if(channel.guildId!==guild||channel.type!==0)throw new Error('Select a text channel in this server');await store.put({guildId:guild,key:'REPORT_CATCHALL',discordId:channel.id,kind:'CHANNEL'});await i.editReply(replyText('Catch-all destination saved.'));return;}
  if(action==='backfill'){const result=await discord.pipeline.batch(guild,i.options.getInteger('page')??0);await i.editReply(replyText(`Processed ${result.processed}. ${result.failures.join('\n')||'No failures.'}`));return;}
 }
 if(family==='contact'){
  if(component&&!parts.includes('page')){
   if(action==='edit'){await i.editReply({content:'Open the editor.',components:[{type:1,components:[{type:2,style:1,label:'Edit',custom_id:`${base}:edit-form:${selected}`}]}]});return;}
   const [id,revision]=selected.split('~');const c=await store.intelligence<ContactRow>(guild,'contact-get',actor,id);if(c.revision!==Number(revision))throw new Error('Contact changed; reopen this panel');
   if(action==='archive'){await store.intelligence(guild,'contact-archive',actor,id,{revision:c.revision});if(c.forum_thread_id){const thread=await discord.fetch(c.forum_thread_id);if(thread?.isThread())await thread.setArchived(true);}}
   else if(action==='link-member'||action==='unlink-member'){await i.editReply({content:'Select a server member.',components:[{type:1,components:[{type:5,custom_id:`${base}:${action==='link-member'?'member-add':'member-remove'}:${selected}`,max_values:1}]}]});return;}
   else if(action==='group-members'){if(c.kind!=='GROUP')throw new Error('Select a Contact group');await linkOptions('group',selected);return;}
   else if(action==='list'){await i.editReply(replyText(`${c.name}\n${c.description}\n${c.active?'Active':'Archived'} · ${c.kind}\nLinked members: ${(c.members??[]).join(', ')||'none'}\nGroup contacts: ${(c.contacts??[]).join(', ')||'none'}`));return;}
   await i.editReply(replyText('Contact updated.'));return;
  }
  const rows=await store.intelligence<ContactRow[]>(guild,'contacts',actor,undefined,{page});await i.editReply(choices(`${base}:${action}`,rows.map(c=>({id:`${c.id}~${c.revision}`,name:`${c.name}${c.active?'':' (archived)'}`})),page,rows.length===25));return;
 }
 if(action==='topic-list'){const topics=await store.intelligence<TopicRow[]>(guild,'topics',actor);await i.editReply({content:'Configured topics, in classification order.',files:[{attachment:Buffer.from(topics.map(t=>`${t.priority}: ${t.name}: ${t.keywords.join(', ')}`).join('\n')||'No topics'),name:'topics.txt'}]});return;}
 if(action==='topic-edit'){const topics=await store.intelligence<TopicRow[]>(guild,'topics',actor);if(component&&!parts.includes('page')){await i.editReply({content:'Open topic editor.',components:[{type:1,components:[{type:2,style:1,label:'Edit',custom_id:`${base}:edit-form:${selected}`}]}]});return;}await i.editReply(choices(`${base}:topic-edit`,topics.slice(page*25,page*25+25).map(t=>({id:`${t.id}~${t.revision}`,name:t.name})),page,topics.length>(page+1)*25));return;}
 if(action==='set-hq'){if(component&&!parts.includes('page')){await store.trailmark(guild,'hq',actor,selected);await i.editReply(replyText('Headquarters Trailmark updated.'));return;}const ts=await store.trailmark<any[]>(guild,'list',actor,undefined,{page});await i.editReply(choices(`${base}:set-hq`,ts.filter(t=>t.active).map(t=>({id:t.id,name:t.name})),page,ts.length===25));return;}
 if(component&&!parts.includes('page')){
  const report=await store.intelligence<ReportRow>(guild,'report-get',actor,selected);
  if(action==='deliver'){const sessions=await store.trailmark<any[]>(guild,'sessions',actor);let atHQ=false;for(const s of sessions.filter(s=>s.state==='ACTIVE'&&Date.parse(s.expires_at)>Date.now())){const t=await store.trailmark(guild,'get',actor,s.trailmark_id);if(t.active&&t.is_headquarters)atHQ=true;}if(!atHQ)throw new Error('Request access to the Headquarters Trailmark before delivering reports');await store.intelligence(guild,'report-hq',actor,selected);await discord.pipeline.process(guild,selected);await i.editReply(replyText('Report delivered to Headquarters and processed locally.'));return;}
  if(action==='link-report'){if(report.reporter_id!==actor)await requireTier(i,store,'LEVEL_3');await linkOptions('report',selected);return;}
  await i.editReply({content:`${report.delivery_status} · ${report.id}`,files:[{attachment:Buffer.from(report.body),name:'report.txt'}],allowedMentions:{parse:[]}});return;
 }
 const reports=await store.intelligence<ReportRow[]>(guild,'reports',actor,undefined,{page});await i.editReply(choices(`${base}:${action}`,reports.map(r=>({id:r.id,name:`${r.delivery_status}: ${r.body.slice(0,65)}`})),page,reports.length===25));
}
