import {AtlasService,type AtlasGateway} from '../services.js';
import {TrailmarkLifecycle,type AccessSession} from '../field.js';import {DiscordTrailmarkAccess} from './trailmarkAccess.js';
import type {WorkflowRepositories} from './handlers/workflows.js';import {requireTier,replyText} from './interactions.js';
export interface AtlasRepositories extends WorkflowRepositories,AtlasGateway {atlasRpc<T=any>(name:string,args:Record<string,unknown>):Promise<T>}
export async function handleAtlas(i:any,store:AtlasRepositories):Promise<void>{
 await i.deferReply({ephemeral:true});const config=await store.load(i.guildId);if(!config?.modules.atlas)throw new Error('Atlas module is disabled');await requireTier(i,store,'BASELINE');
 const action=i.options.getSubcommand();if(action==='link'){const code=await new AtlasService(store).link(i.guildId,i.user.id,true);await i.editReply(replyText(`Atlas Discord link code (expires in ten minutes):\n${code}\nOnly enter it in your trusted Atlas account linking page.`));return;}
 if(action==='unlink'){await store.atlasRpc('unlink_atlas_discord',{p_guild_id:i.guildId,p_discord_user_id:i.user.id});await i.editReply(replyText('Atlas identity unlinked; pending requests cancelled.'));return;}
 const status=await store.atlasRpc('codex_atlas',{p_guild:i.guildId,p_action:'status',p_member:i.user.id});await i.editReply({content:status.link?'Atlas identity is linked.':'Atlas identity is not linked.',files:[{attachment:Buffer.from(JSON.stringify(status,null,2)),name:'atlas-status.json'}]});
}
export class AtlasRuntime {
 private readonly pages=new Map<string,number>();
 constructor(private readonly store:AtlasRepositories){}
 async poll(guild:any):Promise<void>{
  const config=await this.store.load(guild.id);if(!config?.modules.atlas)return;
  const adapter=new DiscordTrailmarkAccess(guild,this.store),lifecycle=new TrailmarkLifecycle(this.store,adapter);
  await new AtlasService(this.store).poll(guild.id,true,async request=>{
   if(request.guildId!==guild.id)throw new Error('Atlas request guild mismatch');const t=await this.store.trailmark(guild.id,'get',request.memberId,request.trailmarkId);if(!await adapter.eligible(t,request.memberId))throw new Error('Trailmark access permission is required');
   const session=await this.store.atlasRpc<AccessSession>('codex_atlas',{p_guild:guild.id,p_action:'grant',p_member:request.memberId,p_id:request.id});await lifecycle.reconcile(guild.id);
   const current=await this.store.trailmark<AccessSession[]>(guild.id,'sessions',request.memberId);if(!current.some(s=>s.id===session.id&&s.state==='ACTIVE'&&Date.parse(s.expires_at)>Date.now()))throw new Error('Atlas access session is expired or awaiting Discord recovery');
  },async drop=>{
   if(drop.guildId!==guild.id)throw new Error('Atlas drop guild mismatch');const linked=await this.store.atlasRpc('get_atlas_discord_link',{p_guild_id:guild.id,p_discord_user_id:drop.memberId});if(!linked)throw new Error('Atlas identity is no longer linked');
   const t=await this.store.trailmark(guild.id,'get',drop.memberId,drop.trailmarkId),sessions=await this.store.trailmark<AccessSession[]>(guild.id,'sessions',drop.memberId);if(!t.active||!await adapter.eligible(t,drop.memberId)||!sessions.some(s=>s.trailmark_id===t.id&&s.state==='ACTIVE'&&Date.parse(s.expires_at)>Date.now()))throw new Error('An active eligible Trailmark session is required for this drop');
   const payload=drop.payload as {body?:unknown};if(typeof payload?.body!=='string'||!payload.body.trim()||payload.body.length>4000)throw new Error('Atlas drop needs a report body');await this.store.trailmark(guild.id,'report',drop.memberId,t.id,{id:drop.id,body:payload.body,interaction_id:`atlas:${drop.id}`});
  });
  const page=this.pages.get(guild.id)??0,profiles=await this.store.atlasRpc<Array<{discord_user_id:string}>>('codex_atlas',{p_guild:guild.id,p_action:'profiles',p_member:'system',p_data:{page}});this.pages.set(guild.id,profiles.length===10?page+1:0);
  for(const profile of profiles){const id=profile.discord_user_id;let member;try{member=await guild.members.fetch({user:id,force:true});}catch(error){if((error as {code?:number}).code===10007){await this.store.atlasRpc('unlink_atlas_discord',{p_guild_id:guild.id,p_discord_user_id:id});continue;}throw error;}
   await this.store.atlasRpc('codex_atlas',{p_guild:guild.id,p_action:'profile',p_member:id,p_data:{profile:{displayName:member.displayName,avatar:member.displayAvatarURL()},presence:member.presence?.status??'unknown'}});
   const sessions=await this.store.atlasRpc<AccessSession[]>('codex_atlas',{p_guild:guild.id,p_action:'heartbeat',p_member:id});for(const s of sessions){const visit=await this.store.atlasRpc<string>('record_atlas_trailmark_visit',{p_guild_id:guild.id,p_discord_user_id:id,p_trailmark_id:s.trailmark_id,p_session_id:s.id});await this.store.atlasRpc('touch_atlas_trailmark_visit',{p_guild_id:guild.id,p_discord_user_id:id,p_visit_id:visit});}
  }
 }
}
