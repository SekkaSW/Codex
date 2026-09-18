import type { ServerConfig } from "../domain.js";
import type { ManagedResource, Registry } from "../resources.js";
import type { AtlasDrop, AtlasGateway, AtlasRequest, IntelStore, LedgerEntry, LedgerStore, StoredReport, StrongboxStore, StrongboxSubmission, TrailmarkSession, TrailmarkStore } from "../services.js";

type QueryResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
export interface SupabaseQuery {
  select(columns?: string): SupabaseQuery; eq(column: string, value: unknown): SupabaseQuery; is(column: string, value: null): SupabaseQuery;
  order(column: string, options?: { ascending?: boolean }): SupabaseQuery; limit(count: number): SupabaseQuery;
  upsert(value: unknown, options?: { onConflict?: string }): QueryResult<unknown>; insert(value: unknown): QueryResult<unknown>; update(value: unknown): SupabaseQuery;
  then<TResult1 = {data:unknown;error:{message:string}|null}>(onfulfilled?: ((value:{data:unknown;error:{message:string}|null})=>TResult1|PromiseLike<TResult1>) | null): Promise<TResult1>;
}
export interface SupabaseClientLike { from(table: string): SupabaseQuery; rpc<T = unknown>(name: string, args?: Record<string, unknown>): QueryResult<T> }
function dataOrThrow<T>(result: {data:T|null;error:{message:string}|null}): T { if (result.error) throw new Error(result.error.message); return result.data as T; }

export class SupabaseRepositories implements Registry, TrailmarkStore, IntelStore, LedgerStore, StrongboxStore, AtlasGateway {
  constructor(private readonly client: SupabaseClientLike) {}
  async server(guildId: string): Promise<ServerConfig | undefined> {
    const rows = dataOrThrow(await this.client.from("server_config").select("*,server_modules(*)").eq("guild_id",guildId).limit(1) as unknown as {data:Record<string,unknown>[]|null;error:{message:string}|null});
    const row=rows[0]; if(!row)return undefined; const modules={briefings:false,patrols:false,supply:false,atlas:false}; for(const module of (row.server_modules as Array<{module_key:keyof typeof modules;enabled:boolean}> ?? [])) modules[module.module_key]=module.enabled;
    return {guildId:String(row.guild_id),organizationName:String(row.organization_name),commandNamespace:String(row.command_namespace),confidentialityMarker:String(row.confidentiality_marker),modules};
  }
  async saveServer(config: ServerConfig): Promise<void> {
    dataOrThrow(await this.client.from("server_config").upsert({guild_id:config.guildId,organization_name:config.organizationName,command_namespace:config.commandNamespace,confidentiality_marker:config.confidentialityMarker},{onConflict:"guild_id"}));
    dataOrThrow(await this.client.from("server_modules").upsert(Object.entries(config.modules).map(([module_key,enabled])=>({guild_id:config.guildId,module_key,enabled})),{onConflict:"guild_id,module_key"}));
  }
  async list(guildId: string): Promise<ManagedResource[]> { const rows=dataOrThrow(await this.client.from("managed_resources").select().eq("guild_id",guildId) as unknown as {data:RecordType[]|null;error:{message:string}|null}); return rows.map(row=>({guildId:String(row.guild_id),key:String(row.resource_key) as ManagedResource["key"],discordId:String(row.discord_id),kind:String(row.resource_kind) as ManagedResource["kind"],...(row.owner_id?{ownerId:String(row.owner_id)}:{})})); }
  async put(row: ManagedResource): Promise<void> { dataOrThrow(await this.client.from("managed_resources").upsert({guild_id:row.guildId,resource_key:row.key,discord_id:row.discordId,resource_kind:row.kind,owner_id:row.ownerId??null},{onConflict:"guild_id,resource_key"})); }
  async listActiveSessions(guildId?: string): Promise<TrailmarkSession[]> { let query=this.client.from("trailmark_sessions").select().eq("active",true); if(guildId)query=query.eq("guild_id",guildId); return (dataOrThrow(await query as unknown as {data:RecordType[]|null;error:{message:string}|null})).map(sessionFromRow); }
  async saveSession(row: TrailmarkSession): Promise<void> { dataOrThrow(await this.client.from("trailmark_sessions").upsert({id:row.id,guild_id:row.guildId,trailmark_id:row.trailmarkId,discord_member_id:row.memberId,expires_at:row.expiresAt,active:row.active},{onConflict:"id"})); }
  async deactivateSession(id:string):Promise<void>{dataOrThrow(await this.client.from("trailmark_sessions").update({active:false}).eq("id",id) as unknown as {data:unknown;error:{message:string}|null});}
  async saveReport(row:StoredReport):Promise<void>{dataOrThrow(await this.client.from("intel_reports").upsert({id:row.id,guild_id:row.originGuildId,body:row.body,created_at:row.createdAt,source:row.source,topic:row.topic??null,reporter_id:row.reporterId??null,source_trailmark_id:row.sourceTrailmarkId??null,source_channel_id:row.sourceChannelId??null,source_message_id:row.sourceMessageId??null,deliverer_id:row.delivererId??null,delivery_status:row.status,linked_contact_ids:row.linkedContactIds},{onConflict:"id"}));}
  async getReport(id:string):Promise<StoredReport|undefined>{const rows=dataOrThrow(await this.client.from("intel_reports").select().eq("id",id).limit(1) as unknown as {data:RecordType[]|null;error:{message:string}|null}); const row=rows[0]; return row?reportFromRow(row):undefined;}
  async hasContactForward(reportId:string,contactId:string):Promise<boolean>{const rows=dataOrThrow(await this.client.from("contact_report_forwards").select("report_id").eq("report_id",reportId).eq("contact_id",contactId).limit(1) as unknown as {data:unknown[]|null;error:{message:string}|null});return rows.length>0;}
  async recordContactForward(reportId:string,contactId:string,messageId:string):Promise<void>{dataOrThrow(await this.client.from("contact_report_forwards").insert({report_id:reportId,contact_id:contactId,discord_message_id:messageId}));}
  async history(guildId:string):Promise<LedgerEntry[]>{const rows=dataOrThrow(await this.client.from("fund_ledger").select().eq("guild_id",guildId).order("created_at",{ascending:true}) as unknown as {data:RecordType[]|null;error:{message:string}|null});return rows.map(row=>({id:String(row.id),guildId:String(row.guild_id),amount:Number(row.amount),kind:String(row.kind) as LedgerEntry["kind"],actorId:String(row.actor_id),note:String(row.note),createdAt:String(row.created_at),...(row.reversed_entry_id?{reversedEntryId:String(row.reversed_entry_id)}:{})}));}
  async append(row:LedgerEntry):Promise<void>{dataOrThrow(await this.client.from("fund_ledger").insert({id:row.id,guild_id:row.guildId,amount:row.amount,kind:row.kind,actor_id:row.actorId,note:row.note,created_at:row.createdAt,reversed_entry_id:row.reversedEntryId??null}));}
  async save(row:StrongboxSubmission):Promise<void>{dataOrThrow(await this.client.from("strongbox_submissions").insert({id:row.id,guild_id:row.guildId,discord_member_id:row.memberId,contents:row.contents,source_message_id:row.sourceMessageId,status:row.status,created_at:row.createdAt}));}
  async createLinkCode(guildId:string,memberId:string,expiresAt:string):Promise<string>{return dataOrThrow(await this.client.rpc<string>("create_atlas_discord_link_code",{p_guild_id:guildId,p_discord_user_id:memberId,p_expires_at:expiresAt}));}
  async claimAccess(guildId:string):Promise<AtlasRequest[]>{return dataOrThrow(await this.client.rpc<AtlasRequest[]>("claim_pending_atlas_trailmark_access_requests",{p_guild_id:guildId}));}
  async completeAccess(id:string,ok:boolean,detail?:string):Promise<void>{dataOrThrow(await this.client.rpc("complete_atlas_trailmark_access_request",{p_request_id:id,p_success:ok,p_detail:detail??null}));}
  async claimDrops(guildId:string):Promise<AtlasDrop[]>{return dataOrThrow(await this.client.rpc<AtlasDrop[]>("claim_pending_atlas_trailmark_drops",{p_guild_id:guildId}));}
  async completeDrop(id:string,ok:boolean,detail?:string):Promise<void>{dataOrThrow(await this.client.rpc("complete_atlas_trailmark_drop",{p_drop_id:id,p_success:ok,p_detail:detail??null}));}
}
type RecordType=Record<string,unknown>;
function sessionFromRow(row:RecordType):TrailmarkSession{return{id:String(row.id),guildId:String(row.guild_id),trailmarkId:String(row.trailmark_id),memberId:String(row.discord_member_id),expiresAt:String(row.expires_at),active:Boolean(row.active)}}
function reportFromRow(row:RecordType):StoredReport{return{id:String(row.id),originGuildId:String(row.guild_id),body:String(row.body),createdAt:String(row.created_at),source:String(row.source) as StoredReport["source"],status:String(row.delivery_status) as StoredReport["status"],linkedContactIds:(row.linked_contact_ids as string[]??[]),...(row.topic?{topic:String(row.topic)}:{}),...(row.source_channel_id?{sourceChannelId:String(row.source_channel_id)}:{}),...(row.source_message_id?{sourceMessageId:String(row.source_message_id)}:{})}}
