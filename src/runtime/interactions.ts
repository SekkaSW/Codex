import { PermissionFlagsBits } from 'discord.js';
import { satisfies, type PermissionRole, type Requirement } from '../domain.js';
import type { MemberRepositories } from './handlers/members.js';
import { createHash } from 'node:crypto';
export async function requireTier(i:any,store:Pick<MemberRepositories,'permissionRoles'>,tier:Requirement,mappings?:PermissionRole[]):Promise<void>{
 const member=await i.guild.members.fetch({user:i.user.id,force:true});const roles=await i.guild.roles.fetch();
 if(!satisfies(member.roles.cache.keys(),tier,(mappings??await store.permissionRoles(i.guildId)).filter(r=>r.guildId===i.guildId&&roles.has(r.roleId)),member.permissions.has(PermissionFlagsBits.Administrator)))throw new Error(`${tier} or Discord Administrator permission is required`);
}
export function interactionUuid(id:string):string {const hex=createHash('sha256').update(id).digest('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;}
export function choices(customId:string,items:Array<{id:string;name:string}>,page=0,more=false):any {
 if(!items.length)return {content:'No matching records on this page.',components:[]};
 const components:any[]=[{type:1,components:[{type:3,custom_id:customId,placeholder:'Select an item',options:items.slice(0,25).map(x=>({label:x.name.slice(0,100),value:x.id}))}]}];
 const buttons=[];if(page>0)buttons.push({type:2,style:2,label:'Previous',custom_id:`${customId}:page:${page-1}`});if(more)buttons.push({type:2,style:2,label:'Next',custom_id:`${customId}:page:${page+1}`});if(buttons.length)components.push({type:1,components:buttons});
 return {content:`Select an item (page ${page+1}).`,components,allowedMentions:{parse:[]}};
}
export function textModal(customId:string,title:string,fields:Array<{id:string;label:string;value?:string;max?:number;paragraph?:boolean;optional?:boolean}>):any {
 return {custom_id:customId,title:title.slice(0,45),components:fields.map(f=>({type:1,components:[{type:4,custom_id:f.id,label:f.label.slice(0,45),style:f.paragraph?2:1,required:!f.optional,max_length:f.max??100,...(f.value?{value:f.value}:{})}]}))};
}
export function replyText(content:string):any{return {content:content.slice(0,1900),components:[],allowedMentions:{parse:[]}};}
