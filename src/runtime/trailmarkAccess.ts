import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { satisfies, type PermissionRole } from '../domain.js';
import type { FieldStore, FieldTrailmark, TrailmarkAccessAdapter } from '../field.js';
import type { Registry } from '../resources.js';
export class DiscordTrailmarkAccess implements TrailmarkAccessAdapter {
 constructor(private readonly guild:any,private readonly store:FieldStore&Registry&{permissionRoles(g:string):Promise<PermissionRole[]>}){}
 async ensure(trailmark:FieldTrailmark):Promise<FieldTrailmark>{
  let channel:any;
  if(!trailmark.channel_id.startsWith('pending:'))channel=await this.fetch(trailmark.channel_id);
  const roles=await this.guild.roles.fetch(),mappings=await this.store.permissionRoles(this.guild.id),bot=await this.guild.members.fetchMe();
  if(!channel){
   // A recovery token is only consulted when the stored ID is absent/missing, never a channel name.
   const token=`codex-resource:${this.guild.id}:TRAILMARK:${trailmark.id}`;
   const found=(await this.guild.channels.fetch()).filter((c:any)=>c?.topic===token);
   if(found.size>1)throw new Error('Multiple Trailmark recovery tokens found; administrator repair is required');
   channel=found.first();
   if(!channel){const parent=(await this.store.list(this.guild.id)).find(r=>r.key==='TRAILMARK_CATEGORY');
    channel=await this.guild.channels.create({name:`trailmark-${trailmark.name.toLowerCase().replace(/[^a-z0-9-]/g,'-')}`.slice(0,100),type:ChannelType.GuildText,topic:token,...(parent?{parent:parent.discordId}:{}),permissionOverwrites:[{id:this.guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:bot.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.SendMessages]}]});
   }
   trailmark=await this.store.trailmark(this.guild.id,'channel',bot.id,trailmark.id,{channel_id:channel.id});
  }
  if(channel.type!==ChannelType.GuildText)throw new Error('Stored Trailmark resource is not a text channel');
  await channel.permissionOverwrites.edit(this.guild.id,{ViewChannel:false});
  await channel.permissionOverwrites.edit(bot.id,{ViewChannel:true,ManageChannels:true,SendMessages:true});
  // Staff access follows current generalized mappings; individual session overwrites are separate.
  const allowed=mappings.filter(r=>roles.has(r.roleId)&&satisfies([r.roleId],'LEVEL_3',mappings));
  for(const overwrite of channel.permissionOverwrites.cache.values())if(overwrite.type===0&&overwrite.id!==this.guild.id&&!allowed.some(r=>r.roleId===overwrite.id))await channel.permissionOverwrites.delete(overwrite.id);
  for(const mapping of allowed)await channel.permissionOverwrites.edit(mapping.roleId,{ViewChannel:true});
  return trailmark;
 }
 async eligible(t:FieldTrailmark,memberId:string):Promise<boolean>{try{const member=await this.guild.members.fetch({user:memberId,force:true}),roles=await this.guild.roles.fetch();return satisfies(member.roles.cache.keys(),t.access_tier,(await this.store.permissionRoles(this.guild.id)).filter(r=>roles.has(r.roleId)),member.permissions.has(PermissionFlagsBits.Administrator));}catch(error){if((error as {code?:number}).code===10007)return false;throw error;}}
 async grant(t:FieldTrailmark,memberId:string):Promise<void>{const channel=await this.fetch(t.channel_id);if(!channel)throw new Error('Trailmark channel is missing; retry access to repair it');await channel.permissionOverwrites.edit(memberId,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});}
 async revoke(t:FieldTrailmark,memberId:string):Promise<void>{if(t.channel_id.startsWith('pending:'))return;const channel=await this.fetch(t.channel_id);if(channel?.permissionOverwrites.cache.has(memberId))await channel.permissionOverwrites.delete(memberId);}
 private async fetch(id:string){try{return await this.guild.channels.fetch(id);}catch(error){if((error as {code?:number}).code===10003)return null;throw error;}}
}
