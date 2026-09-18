import { AdministrationRepository } from './administration.js';
import { PersistenceUncertainError, type MemberState } from '../administration.js';
import type { AdvancementCase, FieldStore, FieldTrailmark } from '../field.js';
export class FieldRepository extends AdministrationRepository implements FieldStore {
 optional<T=any>(guild:string,system:string,action:string,actor:string,id?:string,data:Record<string,unknown>={}):Promise<T>{return this.rpc('codex_optional',{p_guild:guild,p_system:system,p_action:action,p_actor:actor,p_id:id??null,p_data:data});}
 atlasRpc<T=any>(name:string,args:Record<string,unknown>):Promise<T>{return this.rpc(name,args);}
 workflow<T=any>(guild:string,system:string,action:string,actor:string,id?:string,data:Record<string,unknown>={}):Promise<T>{return this.rpc('codex_workflow',{p_guild:guild,p_system:system,p_action:action,p_actor:actor,p_id:id??null,p_data:data});}
 bridge<T=unknown>(guild:string,action:string,actor:string,id?:string,data:Record<string,unknown>={}):Promise<T>{return this.rpc('codex_bridge',{p_guild:guild,p_action:action,p_actor:actor,p_id:id??null,p_data:data});}
 intelligence<T=unknown>(guild:string,action:string,actor:string,id?:string,data:Record<string,unknown>={}):Promise<T>{return this.rpc('codex_intelligence',{p_guild:guild,p_action:action,p_actor:actor,p_id:id??null,p_data:data});}
 advancement<T=AdvancementCase>(guildId:string,action:string,actorId:string,id?:string,data:Record<string,unknown>={}):Promise<T>{return this.rpc('codex_advancement',{p_guild:guildId,p_action:action,p_actor:actorId,p_id:id??null,p_data:data});}
 trailmark<T=FieldTrailmark>(guildId:string,action:string,actorId:string,id?:string,data:Record<string,unknown>={}):Promise<T>{return this.rpc('codex_trailmarks',{p_guild:guildId,p_action:action,p_actor:actorId,p_id:id??null,p_data:data});}
 async approveAdvancement(record:AdvancementCase,before:MemberState,after:MemberState,actorId:string):Promise<void>{
  let result;
  try{result=await this.client.rpc('codex_approve_advancement',{p_guild:record.guild_id,p_case:record.id,p_revision:record.revision,p_before_version:before.version,p_member:after,p_actor:actorId,p_reason:`Advancement ${record.id}`,p_operation:record.id});}
  catch{throw new PersistenceUncertainError('Approval response was interrupted. Check case status and synchronize the member');}
  if(!result.error)return;
  if(/^(P0001|22|23|42)/.test((result.error as {code?:string}).code??''))throw new Error(result.error.message);
  try{const current=await this.advancement(record.guild_id,'get',actorId,record.id);if(current.status==='APPROVED')return;}catch{}
  throw new PersistenceUncertainError('Approval outcome is uncertain. Refresh case status and synchronize the member before retrying');
 }
}
