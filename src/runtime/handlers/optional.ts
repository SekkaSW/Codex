import { requireFeature } from '../features.js';
import type {WorkflowRepositories} from './workflows.js';import {workflowDestination} from './workflows.js';
import {choices,interactionUuid,replyText,requireTier,textModal,recordView} from '../interactions.js';import {DurableDelivery} from '../../intelligence.js';import {DurableSummary} from '../../workflows.js';import {DiscordDurablePublisher} from '../intelligenceDiscord.js';
export interface OptionalRepositories extends WorkflowRepositories {optional<T=any>(guild:string,system:string,action:string,actor:string,id?:string,data?:Record<string,unknown>):Promise<T>}
export async function handleOptional(i:any,store:OptionalRepositories):Promise<void>{
 const component=!!i.customId,p=component?i.customId.split(':'):[],actor=i.user.id,guild=i.guildId;
 if(component&&p[1]!==actor)throw new Error('This optional-system panel belongs to another user');
 const system=component?p[2]:i.commandName,action=component?p[3]:i.options.getSubcommand(),context=p[4],selected=i.values?.[0]??context,base=`optional:${actor}:${system}`,page=p.includes('page')?Number(p.at(-1)):0;
 await requireFeature(store,guild,system);
 const config=await store.load(guild),module=system==='briefing'?'briefings':system==='patrol'?'patrols':system;if(system!=='reference'&&!config?.modules[module as keyof typeof config.modules])throw new Error('This optional module is disabled');
 await requireTier(i,store,['create','create-save','setup','setup-save','edit','edit-save','send','send-save','redistribute','redistribute-save','close','reopen','cancel','resolve'].includes(action)?'LEVEL_3':system==='briefing'?'LEVEL_1':'BASELINE');
 const call=(action:string,id?:string,data:Record<string,unknown>={})=>store.optional(guild,system,action,actor,id,data);
 if(!component&&system==='supply'&&action==='create'){await i.showModal(textModal(`${base}:create-save:new`,'Supply campaign',[{id:'title',label:'Title and resource/unit',max:200}]));return;}
 if(!component&&system==='reference'&&action==='edit'){await i.showModal(textModal(`${base}:edit-save:new`,'Save reference entry',[{id:'key',label:'Stable lookup key',max:100},{id:'title',label:'Title',max:200},{id:'body',label:'Reference content',max:4000,paragraph:true}]));return;}
 if(!component&&system==='briefing'&&['setup','send'].includes(action)){await i.showModal(textModal(`${base}:${action}-save:new`,action==='setup'?'Briefing settings':'Send briefing',action==='setup'?[{id:'heading',label:'Default heading',max:100}]:[{id:'title',label:'Title',max:200},{id:'body',label:'Briefing',max:3500,paragraph:true}]));return;}
 if(component&&system==='supply'&&action==='log-form'){await i.showModal(textModal(`${base}:log-save:${context}`,'Log contribution',[{id:'quantity',label:'Quantity',max:20}]));return;}
 await i.deferReply({ephemeral:true});const publisher=new DiscordDurablePublisher(i.guild),summary=new DurableSummary(store,publisher),delivery=new DurableDelivery(store,publisher);
 const publish=async(record:any)=>{if(system==='supply')await summary.refresh(guild,`supply:${record.id}`,await workflowDestination(i,store,'ASSIGNMENTS'),`${record.title}\n${record.status}\nAvailable: ${record.stock}`);if(system==='briefing')await delivery.deliver(guild,`briefing:${record.id}`,await workflowDestination(i,store,'DISPATCH_DESK'),`${record.title}\n${record.body}`);};
 if(i.isModalSubmit()){
  let record;const id=interactionUuid(i.id);
  if(action==='create-save')record=await call('create',id,{title:i.fields.getTextInputValue('title')});
  else if(action==='edit-save')record=await call('save',undefined,{key:i.fields.getTextInputValue('key'),title:i.fields.getTextInputValue('title'),body:i.fields.getTextInputValue('body')});
  else if(action==='setup-save'){await workflowDestination(i,store,'DISPATCH_DESK');await call('setup',undefined,{heading:i.fields.getTextInputValue('heading')});await i.editReply(replyText('Briefing settings saved.'));return;}
  else if(action==='send-save'){const settings=await call('settings');if(!settings.heading)throw new Error('Run /briefing setup first');record=await call('send',id,{title:`${settings.heading}: ${i.fields.getTextInputValue('title')}`.slice(0,200),body:i.fields.getTextInputValue('body')});}
  else if(action==='log-save')record=await call('log',context,{quantity:Number(i.fields.getTextInputValue('quantity')),operation:id});else throw new Error('Unknown optional workflow form');
  try{await publish(record);}catch{throw new Error(`Saved ${record.id}; use refresh/history to retry Discord delivery`);}await i.editReply(replyText(`Saved ${record.id}.`));return;
 }
 if(system==='briefing'&&action==='settings'){await i.editReply(recordView('briefing',await call('settings')));return;}
 if(system==='patrol'&&!component&&action==='suggest'){const record=await call('suggest',interactionUuid(i.id)),t=await store.trailmark(guild,'get',actor,record.trailmark_id);await i.editReply(replyText(`Suggested patrol: ${t.name}\n${record.reason}\nRequest authorized access through /trailmark panel.`));return;}
 if(component&&!p.includes('page')){
  if(system==='supply'&&action==='log'){await i.editReply({content:'Log a contribution.',components:[{type:1,components:[{type:2,style:1,label:'Enter quantity',custom_id:`${base}:log-form:${selected}`}]}]});return;}
  const data:Record<string,unknown>={operation:interactionUuid(i.id)};
  if(system==='supply'&&action==='redistribute'){const [recipient,quantity]=context.split('~');await i.guild.members.fetch(recipient);data.recipient=recipient;data.quantity=Number(quantity);}
  const record=await call(['get','list','history'].includes(action)?'get':action,selected,data);if(!record)throw new Error('Record no longer exists');await publish(record);await i.editReply(recordView(system,record));return;
 }
 const extra=system==='supply'&&action==='redistribute'?component?context:`${i.options.getUser('member',true).id}~${i.options.getNumber('quantity',true)}`:undefined;
 const rows=await call('list',undefined,{page});await i.editReply(choices(`${base}:${action}${extra?`:${extra}`:''}`,rows.map((r:any)=>({id:r.id,name:r.title??r.key??`${r.status}: ${r.created_at}`})),page,rows.length===25));
}
