import { ChannelType } from 'discord.js';
import { DurableDelivery, IntelligencePipeline, type ContactRow, type DurablePublisher, type IntelligenceDestinations, type IntelligenceStore, type TopicRow } from '../intelligence.js';
import type { Registry, ManagedResource } from '../resources.js';
export class DiscordDurablePublisher implements DurablePublisher {
 constructor(private readonly guild:any){}
 async send(channelId:string,key:string,body:string):Promise<string>{
  const channel=await this.guild.channels.fetch(channelId);if(!channel)throw new Error('Delivery destination is missing');
  const payload={embeds:[{description:body.slice(0,4096),footer:{text:`codex-delivery:${key}`}}],allowedMentions:{parse:[]}};
  if(channel.type===ChannelType.GuildForum){const thread=await channel.threads.create({name:body.split('\n')[0]!.slice(0,100),message:payload});return thread.id;}
  if(!channel.isTextBased()||!('send'in channel))throw new Error('Delivery requires a text channel or forum');
  return (await channel.send(payload)).id;
 }
 async recover(channelId:string,key:string):Promise<string|undefined>{
  const channel=await this.guild.channels.fetch(channelId);if(!channel)throw new Error('Original delivery destination is missing');
  const matches=(message:any)=>message.author?.id===this.guild.client.user.id&&message.embeds?.some((e:any)=>e.footer?.text===`codex-delivery:${key}`);
  if(channel.type===ChannelType.GuildForum){
   const active=await channel.threads.fetchActive(),archived=await channel.threads.fetchArchived({limit:100});
   for(const thread of [...active.threads.values(),...archived.threads.values()].slice(0,100))if(matches(await thread.fetchStarterMessage()))return thread.id;
   return undefined;
  }
  const messages=await channel.messages.fetch({limit:100});return messages.find(matches)?.id;
 }
}
export class DiscordIntelligence implements IntelligenceDestinations {
 readonly delivery:DurableDelivery;readonly pipeline:IntelligencePipeline;
 constructor(private readonly guild:any,private readonly store:IntelligenceStore&Registry){this.delivery=new DurableDelivery(store,new DiscordDurablePublisher(guild));this.pipeline=new IntelligencePipeline(store,this.delivery,this);}
 async resource(key:ManagedResource['key'],name:string,forum=false):Promise<string>{
  const records=await this.store.list(this.guild.id),record=records.find(r=>r.key===key);let channel=record?await this.fetch(record.discordId):null;
  if(channel){if(channel.type!==(forum?ChannelType.GuildForum:ChannelType.GuildText))throw new Error('Stored Intelligence destination has the wrong channel type');return channel.id;}
  const token=`codex-resource:${this.guild.id}:${key}`,matches=(await this.guild.channels.fetch()).filter((c:any)=>c?.topic===token);
  if(matches.size>1)throw new Error('Duplicate Intelligence resource tokens require administrator repair');channel=matches.first();
  if(!channel){const parent=records.find(r=>r.key==='INTELLIGENCE_CATEGORY');channel=await this.guild.channels.create({name:name.slice(0,100),type:forum?ChannelType.GuildForum:ChannelType.GuildText,topic:token,...(parent?{parent:parent.discordId}:{})});}
  await this.store.put({guildId:this.guild.id,key,discordId:channel.id,kind:forum?'FORUM':'CHANNEL'});return channel.id;
 }
 topic(topic?:TopicRow):Promise<string>{return topic?this.resource(`REPORT_TOPIC:${topic.id}`,`reports-${topic.name}`):this.resource('REPORT_CATCHALL','reports-general');}
 async contact(contact:ContactRow):Promise<string>{
  if(contact.kind!=='CONTACT'||!contact.active)throw new Error('Contact is not active');
  if(contact.forum_thread_id){const thread=await this.fetch(contact.forum_thread_id);if(thread){if(!thread.isThread())throw new Error('Stored contact destination is not a thread');if(thread.archived)await thread.setArchived(false);return thread.id;}}
  const forum=await this.resource('CONTACTS','contacts',true);
  const key=`contact-create:${contact.id}:${contact.forum_thread_id??'initial'}`;
  const thread=await this.delivery.deliver(this.guild.id,key,forum,`${contact.name}\n${contact.description}`);
  await this.store.intelligence(this.guild.id,'contact-thread','system',contact.id,{thread});return thread;
 }
 async refresh():Promise<void>{await this.resource('CONTACTS','contacts',true);await this.topic();for(const topic of await this.store.intelligence<TopicRow[]>(this.guild.id,'topics','system'))await this.topic(topic);}
 async fetch(id:string):Promise<any>{try{return await this.guild.channels.fetch(id);}catch(error){if((error as {code?:number}).code===10003)return null;throw error;}}
}
