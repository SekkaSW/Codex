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
 const components:any[]=items.length?[{type:1,components:[{type:3,custom_id:customId,placeholder:'Select an item',options:items.slice(0,25).map(x=>({label:x.name.slice(0,100),value:x.id}))}]}]:[];
 const buttons=[];if(page>0)buttons.push({type:2,style:2,label:'Previous',custom_id:`${customId}:page:${page-1}`});if(more)buttons.push({type:2,style:2,label:'Next',custom_id:`${customId}:page:${page+1}`});if(buttons.length)components.push({type:1,components:buttons});
 return {content:items.length?`Select an item (page ${page+1}).`:'No matching records on this page. Use Previous to go back.',components,allowedMentions:{parse:[]}};
}

/** A readable record view for routine workflows; raw JSON remains an audit/export tool. */
export function recordView(system:string,record:any):any {
 const labels:Record<string,string>={title:'Title',name:'Name',status:'Status',body:'Details',contents:'Contents',description:'Description',created_at:'Created',opened_at:'Opened',closed_at:'Closed',discord_member_id:'Member',applicant_id:'Applicant',duty_role_id:'Duty',mentor_id:'Mentor',mentee_id:'Member seeking a mentor',stock:'Available stock',quantity:'Quantity',heading:'Heading',key:'Lookup name',reason:'Reason'};
 const lines:string[]=[`**${system[0]!.toUpperCase()+system.slice(1)}**`];
 for(const [key,label]of Object.entries(labels))if(record[key]!=null)lines.push(`${label}: ${String(record[key])}`);
 if(record.answers)lines.push(...Object.values(record.answers).map(v=>`Answer: ${String(v)}`));
 if(record.payload?.description)lines.push(`Details: ${record.payload.description}`);
 if(record.payload?.claimed)lines.push(`Claimed by: ${record.payload.claimed.join(', ')||'Nobody yet'}`);
 if(record.options)lines.push(`Choices: ${record.options.join(' / ')}`);
 if(record.counts)lines.push(...Object.entries(record.counts).map(([choice,count])=>`${choice}: ${count}`));
 if(record.contributors)lines.push(`Contributors:\n${Array.isArray(record.contributors)?record.contributors.map((c:any)=>typeof c==='object'?`${c.actor_id??c.member_id??'Member'}: ${c.quantity??c.total??''}`:String(c)).join('\n'):Object.entries(record.contributors).map(([k,v])=>`${k}: ${v}`).join('\n')}`);
 if(record.allocations)lines.push(`Allocations:\n${record.allocations.map((r:any)=>`${r.recipient_id}: ${r.quantity}`).join('\n')||'None'}`);
 const text=lines.join('\n');return {content:text.length>1900?`${lines[0]}\nThe full details are attached.`:text,components:[],allowedMentions:{parse:[]},files:[...(text.length>1900?[{attachment:Buffer.from(text),name:`${system}-details.txt`}]:[]),{attachment:Buffer.from(JSON.stringify(record,null,2)),name:`${system}-export.json`}]};
}
export function textModal(customId:string,title:string,fields:Array<{id:string;label:string;value?:string;max?:number;paragraph?:boolean;optional?:boolean}>):any {
 return {custom_id:customId,title:title.slice(0,45),components:fields.map(f=>({type:1,components:[{type:4,custom_id:f.id,label:f.label.slice(0,45),style:f.paragraph?2:1,required:!f.optional,max_length:f.max??100,...(f.value?{value:f.value}:{})}]}))};
}
export function replyText(content:string):any{return {content:content.slice(0,1900),components:[],allowedMentions:{parse:[]}};}
