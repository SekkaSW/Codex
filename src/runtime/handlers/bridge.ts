import type {BridgeStore,BridgeRow} from '../../bridge.js';
import {BridgeCoordinator} from '../../bridge.js';
import {choices,replyText,requireTier,textModal} from '../interactions.js';
import type {IntelligenceRepositories} from './intelligence.js';
import {DiscordIntelligence} from '../intelligenceDiscord.js';
import {DiscordProvisioner} from '../discordProvisioner.js';
import type {ServerConfig} from '../../domain.js';
export type BridgeRepositories=IntelligenceRepositories&BridgeStore&{load(guild:string):Promise<ServerConfig|undefined>;audit(guild:string,actor:string,subject:string,event:string,detail:Record<string,unknown>):Promise<void>};
export async function handleBridge(i:any,store:BridgeRepositories):Promise<void>{
 const component=!!i.customId,p=component?i.customId.split(':'):[],actor=i.user.id,guild=i.guildId;
 if(component&&p[1]!==actor)throw new Error('This bridge panel belongs to another user');await requireTier(i,store,'LEVEL_3');
 const action=component?p[2]:i.options.getSubcommand(),base=`bridge:${actor}`,selected=i.values?.[0]??p[3],page=p.includes('page')?Number(p.at(-1)):0;
 if(component&&action==='form'){await i.showModal(textModal(`${base}:save:${selected}`,'Bridge topic group',[{id:'group',label:'Group name',max:60},{id:'topics',label:'Mappings: local topic => remote topic per line',max:3500,paragraph:true,optional:true}]));return;}
 if(component&&action==='remove-form'){await i.showModal(textModal(`${base}:remove:${selected}`,'Remove topic group',[{id:'group',label:'Group name',max:60}]));return;}
 await i.deferReply({ephemeral:true});
 const discord=new DiscordIntelligence(i.guild,store);
 if(!component&&action==='archive-category'){const category=i.options.getChannel('category',true);if(category.guildId!==guild||category.type!==4)throw new Error('Select a category in this server');const provisioner=new DiscordProvisioner(i.guild,await store.permissionRoles(guild));for(const channel of [category,...category.children.cache.values()]){if(!('permissionOverwrites'in channel))continue;const key=`EXTRA:legacy-archive-${channel.id}` as const;await provisioner.restorePermissions({guildId:guild,key,discordId:channel.id,kind:channel.type===4?'CATEGORY':'CHANNEL'},{key,name:channel.name,kind:channel.type===4?'CATEGORY':'CHANNEL',minimumTier:'LEVEL_3'});await store.put({guildId:guild,key,discordId:channel.id,kind:channel.type===4?'CATEGORY':'CHANNEL'});}await store.audit(guild,actor,category.id,'BRIDGE_CATEGORY_ARCHIVED',{});await i.editReply(replyText('Selected legacy category and its children are retained with staff-only access.'));return;}
 if(!component&&action==='setup'){
  const remote=i.options.getString('remote',true),protocol=i.options.getString('protocol',true),name=i.options.getString('name',true),channel=i.options.getChannel('intake'),sender=i.options.getUser('sender');
  if(!/^\d{5,25}$/.test(remote)||remote===guild)throw new Error('Use the remote Discord server ID');
  if(protocol==='codex-v1')await i.guild.client.guilds.fetch(remote);else if(!channel||channel.guildId!==guild||channel.type!==0||!sender?.bot)throw new Error('Legacy intake needs a local text channel and trusted bot sender');
  const b=await store.bridge<BridgeRow>(guild,'setup',actor,undefined,{remote,name,protocol,channel:channel?.id,sender:sender?.id});
  const headquarters=channel?.id??await discord.resource(`EXTRA:bridge-hq-${b.id}`,`bridge-${name}`,false,true);
  await store.put({guildId:guild,key:`EXTRA:bridge-hq-${b.id}`,discordId:headquarters,kind:'CHANNEL'});
  await new DiscordProvisioner(i.guild,await store.permissionRoles(guild)).restorePermissions({guildId:guild,key:`EXTRA:bridge-hq-${b.id}`,discordId:headquarters,kind:'CHANNEL'},{key:`EXTRA:bridge-hq-${b.id}`,name,kind:'CHANNEL',minimumTier:'LEVEL_3'});
  await i.editReply(replyText(protocol==='codex-v1'?`Bridge saved. The remote administrator must opt in reciprocally. HQ: <#${headquarters}>.`:`Legacy intake saved for the configured bot sender in <#${headquarters}>. Supported JSON envelopes only.`));return;
 }
 if(!component&&action==='sync'){const config=await store.load(guild);if(!config)throw new Error('Configure this server first');const result=await new BridgeCoordinator(store).drain(guild,config.confidentialityMarker);await i.editReply(replyText(`Delivered ${result.delivered}; retryable failures ${result.failed}. Use status for delivery counts.`));return;}
 if(component&&!p.includes('page')){
  const [id,revision]=selected.split('~'),b=await store.bridge<BridgeRow>(guild,'get',actor,id);if(b.revision!==Number(revision))throw new Error('Bridge changed; reopen its panel');
  if(action==='save'||action==='remove'){
   const group=i.fields.getTextInputValue('group').trim(),topics:Record<string,string>={};
   if(action==='save')for(const line of i.fields.getTextInputValue('topics').split('\n').filter((x:string)=>x.trim())){const values=line.split('=>').map((v:string)=>v.trim());if(values.length!==2||!values[0]||!values[1])throw new Error('Use one local topic => remote topic mapping per line');if(Object.hasOwn(topics,values[0]))throw new Error('Duplicate local topic');topics[values[0]]=values[1];}
   await store.bridge(guild,action==='save'?'group-set':'group-remove',actor,id,{group,topics,revision:b.revision});await i.editReply(replyText('Bridge topic groups saved.'));return;
  }
  if(action==='headquarters-remove'){await store.bridge(guild,'disable',actor,id,{revision:b.revision});await i.editReply(replyText('Bridge disabled. Its private HQ/intake and historical reports are retained.'));return;}
  if(['group-add','group-topics','group-remove'].includes(action)){await i.editReply({content:'Edit the bridge’s topic groups. Unmapped reports use the remote classifier/catch-all.',components:[{type:1,components:[{type:2,style:1,label:'Edit group',custom_id:`${base}:${action==='group-remove'?'remove-form':'form'}:${selected}`}]}]});return;}
  await i.editReply({content:`${b.name} · ${b.protocol} · ${b.active?'Active':'Inactive'}\nRemote: ${b.remote_guild_id}\n${JSON.stringify(b.counts??{})}`,files:[{attachment:Buffer.from(JSON.stringify(b.topic_groups,null,2)),name:'topic-groups.json'}],allowedMentions:{parse:[]}});return;
 }
 const rows=await store.bridge<BridgeRow[]>(guild,'list',actor,undefined,{page});await i.editReply(choices(`${base}:${action}`,rows.map(b=>({id:`${b.id}~${b.revision}`,name:`${b.name} ${JSON.stringify(b.counts??{})}`})),page,rows.length===25));
}
