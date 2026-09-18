import { AdministrationService, type AdministrationStore, type MemberState, type OrganizationConfig, type RoleMember } from './administration.js';
import { advancementOptions, type PermissionTier } from './domain.js';

export interface AdvancementCase {
 id:string; guild_id:string; candidate_id:string; from_rank_id:string; to_rank_id:string;
 status:'OPEN'|'CLOSED'|'APPROVED'|'DENIED'; revision:number; opened_at:string;
 snapshot:{organization:OrganizationConfig;settings:{voter_tier:PermissionTier;minimum_yes:number}};
 yes?:number; no?:number;
}
export interface FieldTrailmark {
 id:string;guild_id:string;name:string;description:string;channel_id:string;active:boolean;
 is_headquarters:boolean;access_tier:PermissionTier;session_minutes:number;revision:number;
 atlas_id?:string|null;coordinates?:unknown;
}
export interface AccessSession {
 id:string;guild_id:string;trailmark_id:string;discord_member_id:string;expires_at:string;
 state:'PENDING'|'ACTIVE'|'REVOKING'|'CLOSED';active:boolean;
}
export interface FieldStore extends AdministrationStore {
 advancement<T=AdvancementCase>(guildId:string,action:string,actorId:string,id?:string,data?:Record<string,unknown>):Promise<T>;
 trailmark<T=FieldTrailmark>(guildId:string,action:string,actorId:string,id?:string,data?:Record<string,unknown>):Promise<T>;
 approveAdvancement(record:AdvancementCase,before:MemberState,after:MemberState,actorId:string):Promise<void>;
}
export class AdvancementService {
 constructor(private readonly store:FieldStore){}
 async eligible(guildId:string,memberId:string){const member=await this.store.member(guildId,memberId),config=await this.store.organization(guildId);return member?.status==='ACTIVE'&&member.rankId?advancementOptions(member.rankId,config.edges,config.ranks):[];}
 async approve(guildId:string,id:string,actorId:string,roles:RoleMember):Promise<void>{
  const record=await this.store.advancement(guildId,'get',actorId,id);
  if(record.status==='APPROVED')return;
  if(record.status!=='CLOSED')throw new Error('Close the ballot before approval');
  if((record.yes??0)<record.snapshot.settings.minimum_yes||(record.yes??0)<=(record.no??0))throw new Error('The ballot has not met its minimum approvals and positive majority');
  const before=await this.store.member(guildId,record.candidate_id),config=await this.store.organization(guildId);
  if(!before||before.status!=='ACTIVE'||before.rankId!==record.from_rank_id)throw new Error('Candidate state changed. Deny this case and open a new one');
  const service=new AdministrationService(this.store),after=service.promote(before,config,record.to_rank_id);
  const originalRole=record.snapshot.organization.ranks.find(r=>r.id===record.to_rank_id)?.roleId;
  if(config.ranks.find(r=>r.id===record.to_rank_id)?.roleId!==originalRole)throw new Error('Target role mapping changed. Deny this case and open a new one');
  await service.change(before,after,config,actorId,'MEMBER_PROMOTED',`Advancement ${id}`,roles,()=>this.store.approveAdvancement(record,before,after,actorId));
 }
}
export interface TrailmarkAccessAdapter {
 ensure(trailmark:FieldTrailmark):Promise<FieldTrailmark>;
 grant(trailmark:FieldTrailmark,memberId:string):Promise<void>;
 revoke(trailmark:FieldTrailmark,memberId:string):Promise<void>;
 eligible(trailmark:FieldTrailmark,memberId:string):Promise<boolean>;
}
export class TrailmarkLifecycle {
 constructor(private readonly store:FieldStore,private readonly adapter:TrailmarkAccessAdapter,private readonly now=()=>new Date()){}
 async reconcile(guildId:string,actorId='system'):Promise<{completed:number;failures:string[]}>{
  const sessions=await this.store.trailmark<AccessSession[]>(guildId,'pending',actorId);let completed=0;const failures:string[]=[];
  const blocked=new Set<string>();
  for(const session of sessions){
   try{
    if(blocked.has(session.discord_member_id))continue;
    let trailmark=await this.store.trailmark(guildId,'get',actorId,session.trailmark_id);
    const revoke=session.state==='REVOKING'||!trailmark.active||Date.parse(session.expires_at)<=this.now().getTime()||!(await this.adapter.eligible(trailmark,session.discord_member_id));
    if(revoke){
     await this.store.trailmark(guildId,'session-revoke',actorId,session.id);
     await this.adapter.revoke(trailmark,session.discord_member_id);
     await this.store.trailmark(guildId,'session-closed',actorId,session.id);
    }else{
     trailmark=await this.adapter.ensure(trailmark);
     await this.adapter.grant(trailmark,session.discord_member_id);
     await this.store.trailmark(guildId,'session-active',actorId,session.id);
    }completed++;
   }catch(error){blocked.add(session.discord_member_id);failures.push(`${session.id}: ${error instanceof Error?error.message:'reconciliation failed'}`);}
  }return {completed,failures};
 }
 async access(guildId:string,trailmarkId:string,memberId:string):Promise<AccessSession>{
  const trailmark=await this.store.trailmark(guildId,'get',memberId,trailmarkId);
  if(!trailmark.active||!(await this.adapter.eligible(trailmark,memberId)))throw new Error('You are not eligible for this Trailmark');
  const session=await this.store.trailmark<AccessSession>(guildId,'access',memberId,trailmarkId);
  const result=await this.reconcile(guildId,memberId);
  if(result.failures.length)throw new Error('Access is saved but Discord reconciliation needs retry. Check bot channel permissions; the background worker will retry');
  const current=await this.store.trailmark<AccessSession[]>(guildId,'sessions',memberId);
  if(!current.some(s=>s.id===session.id&&s.state==='ACTIVE'))throw new Error('Access request is saved and queued; use the panel again after background recovery');
  return session;
 }
 async leave(guildId:string,memberId:string):Promise<void>{await this.store.trailmark(guildId,'leave',memberId);const result=await this.reconcile(guildId,memberId);if(result.failures.length)throw new Error('Leave is saved; Discord access revocation is pending retry');}
}
