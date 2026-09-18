import type { AssignmentEntry, AssignmentGroup, MemberAssignment, MemberRecord, ModuleKey, Rank } from "./domain.js";
import { advancementOptions, assignMember, rolesForRank, type RankEdge } from "./domain.js";
import { classifyReport, isConfidential, mayTransfer, nativeAdapter, type CodexReport } from "./reports.js";

export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() };

export interface Trailmark { id: string; guildId: string; slug: string; name: string; channelId: string; active: boolean; isHeadquarters: boolean; pinned: boolean; location?: string; atlasId?: string }
export interface TrailmarkSession { id: string; guildId: string; trailmarkId: string; memberId: string; expiresAt: string; active: boolean }
export interface TrailmarkStore { listActiveSessions(guildId?: string): Promise<TrailmarkSession[]>; saveSession(session: TrailmarkSession): Promise<void>; deactivateSession(id: string): Promise<void> }
export class TrailmarkService {
  constructor(private readonly store: TrailmarkStore, private readonly clock: Clock = systemClock) {}
  async grant(guildId: string, trailmarkId: string, memberId: string, durationMs: number): Promise<TrailmarkSession> {
    if (durationMs <= 0) throw new Error("Session duration must be positive");
    for (const session of await this.store.listActiveSessions(guildId)) if (session.memberId === memberId) await this.store.deactivateSession(session.id);
    const session = { id: crypto.randomUUID(), guildId, trailmarkId, memberId, expiresAt: new Date(this.clock.now().getTime() + durationMs).toISOString(), active: true };
    await this.store.saveSession(session); return session;
  }
  async expire(guildId?: string, revoke?: (session: TrailmarkSession) => Promise<void>): Promise<TrailmarkSession[]> {
    const expired = (await this.store.listActiveSessions(guildId)).filter(item => Date.parse(item.expiresAt) <= this.clock.now().getTime());
    for (const session of expired) { if (revoke) await revoke(session); await this.store.deactivateSession(session.id); }
    return expired;
  }
}

export type DeliveryStatus = "CAPTURED" | "AT_HQ" | "PUBLISHED";
export interface StoredReport extends CodexReport { reporterId?: string; sourceTrailmarkId?: string; sourceChannelId?: string; sourceMessageId?: string; delivererId?: string; status: DeliveryStatus; linkedContactIds: string[] }
export interface IntelTopic { id: string; guildId: string; name: string; keywords: string[]; channelId?: string }
export interface IntelStore { saveReport(report: StoredReport): Promise<void>; getReport(id: string): Promise<StoredReport | undefined>; hasContactForward(reportId: string, contactId: string): Promise<boolean>; recordContactForward(reportId: string, contactId: string, messageId: string): Promise<void> }
export class IntelService {
  constructor(private readonly store: IntelStore) {}
  async capture(input: Omit<StoredReport, "topic" | "status">, topics: IntelTopic[]): Promise<StoredReport> {
    const topic = classifyReport(input.body, topics);
    const report: StoredReport = { ...input, ...(topic ? { topic } : {}), status: "CAPTURED" };
    await this.store.saveReport(report); return report;
  }
  async markAtHeadquarters(id: string, delivererId?: string): Promise<StoredReport> {
    const existing = await this.required(id); const report: StoredReport = { ...existing, status: "AT_HQ", ...(delivererId ? { delivererId } : {}) };
    await this.store.saveReport(report); return report;
  }
  async publishLocally(id: string): Promise<StoredReport> { const report = { ...(await this.required(id)), status: "PUBLISHED" as const }; await this.store.saveReport(report); return report; }
  private async required(id: string): Promise<StoredReport> { const report = await this.store.getReport(id); if (!report) throw new Error("Report not found"); return report; }
}
export interface ContactPublisher { publish(contactId: string, report: StoredReport): Promise<string> }
export class ContactForwardingService {
  constructor(private readonly store: IntelStore, private readonly publisher: ContactPublisher) {}
  async forward(reportId: string): Promise<string[]> {
    const report = await this.store.getReport(reportId);
    if (!report || !report.sourceChannelId || !report.sourceMessageId || (report.status !== "AT_HQ" && report.status !== "PUBLISHED")) return [];
    const forwarded: string[] = [];
    for (const contactId of report.linkedContactIds) if (!(await this.store.hasContactForward(report.id, contactId))) {
      const messageId = await this.publisher.publish(contactId, report); await this.store.recordContactForward(report.id, contactId, messageId); forwarded.push(contactId);
    }
    return forwarded;
  }
}

export interface BridgeTransport { send(payload: string): Promise<void> }
export class BridgeService {
  async transfer(report: CodexReport, marker: string, transport: BridgeTransport, protocol: "codex-v1" | "legacy-wayfinder"): Promise<boolean> {
    if (!mayTransfer(report, marker)) return false;
    const payload = protocol === "codex-v1" ? nativeAdapter.serialize(report) : JSON.stringify({ id: report.id, content: report.body, created_at: report.createdAt, topic: report.topic });
    await transport.send(payload); return true;
  }
}

export interface LedgerEntry { id: string; guildId: string; amount: number; kind: "DEPOSIT" | "SPEND" | "ADJUSTMENT"; actorId: string; note: string; createdAt: string; reversedEntryId?: string }
export interface LedgerStore { history(guildId: string): Promise<LedgerEntry[]>; append(entry: LedgerEntry): Promise<void> }
export class FundsService {
  constructor(private readonly store: LedgerStore, private readonly clock: Clock = systemClock) {}
  async balance(guildId: string): Promise<number> { return (await this.store.history(guildId)).reduce((sum, row) => sum + row.amount, 0); }
  async record(guildId: string, amount: number, actorId: string, note: string, kind: LedgerEntry["kind"]): Promise<LedgerEntry> {
    if (!Number.isFinite(amount) || amount === 0) throw new Error("Amount must be non-zero");
    const entry = { id: crypto.randomUUID(), guildId, amount: kind === "SPEND" ? -Math.abs(amount) : amount, kind, actorId, note, createdAt: this.clock.now().toISOString() };
    await this.store.append(entry); return entry;
  }
  async undoLast(guildId: string, actorId: string): Promise<LedgerEntry> {
    const rows = await this.store.history(guildId); const reversed = new Set(rows.flatMap(row => row.reversedEntryId ? [row.reversedEntryId] : []));
    const target = [...rows].reverse().find(row => !row.reversedEntryId && !reversed.has(row.id)); if (!target) throw new Error("No transaction to undo");
    const linked: LedgerEntry = { id: crypto.randomUUID(), guildId, amount: -target.amount, kind:"ADJUSTMENT", actorId, note:`Undo: ${target.note}`, createdAt:this.clock.now().toISOString(), reversedEntryId:target.id }; await this.store.append(linked); return linked;
  }
}

export interface StrongboxSubmission { id: string; guildId: string; memberId: string; contents: string; sourceMessageId: string; status: "SUBMITTED" | "PROCESSED"; createdAt: string }
export interface StrongboxStore { save(submission: StrongboxSubmission): Promise<void> }
export class StrongboxService { constructor(private readonly store: StrongboxStore, private readonly clock: Clock = systemClock) {} async submit(guildId: string, memberId: string, contents: string, sourceMessageId: string) { if (!contents.trim()) throw new Error("Contents are required"); const row: StrongboxSubmission = { id:crypto.randomUUID(),guildId,memberId,contents,sourceMessageId,status:"SUBMITTED",createdAt:this.clock.now().toISOString() }; await this.store.save(row); return row; } }

export class MemberService {
  promotionOptions(member: MemberRecord, edges: RankEdge[], ranks: Rank[]): Rank[] { return member.rankId ? advancementOptions(member.rankId, edges, ranks) : []; }
  desiredRankRoles(member: MemberRecord, ranks: Rank[]): string[] { return rolesForRank(member.rankId, ranks); }
  assign(rows: MemberAssignment[], next: MemberAssignment, entries: AssignmentEntry[], group: AssignmentGroup) { return assignMember(rows, next, entries, group); }
}

export interface AtlasRequest { id: string; guildId: string; memberId: string; trailmarkId: string }
export interface AtlasDrop extends AtlasRequest { payload: unknown }
export interface AtlasGateway { createLinkCode(guildId: string, memberId: string, expiresAt: string): Promise<string>; claimAccess(guildId: string): Promise<AtlasRequest[]>; completeAccess(id: string, ok: boolean, detail?: string): Promise<void>; claimDrops(guildId: string): Promise<AtlasDrop[]>; completeDrop(id: string, ok: boolean, detail?: string): Promise<void> }
export class AtlasService {
  constructor(private readonly gateway: AtlasGateway, private readonly clock: Clock = systemClock) {}
  async link(guildId: string, memberId: string, eligible: boolean): Promise<string> { if (!eligible) throw new Error("Trailmark eligibility is required"); return this.gateway.createLinkCode(guildId, memberId, new Date(this.clock.now().getTime()+600_000).toISOString()); }
  async poll(guildId: string, enabled: boolean, grant: (request: AtlasRequest)=>Promise<void>, drop: (request: AtlasDrop)=>Promise<void>): Promise<{access:number;drops:number}> {
    if (!enabled) return {access:0,drops:0}; const access = await this.gateway.claimAccess(guildId); const drops = await this.gateway.claimDrops(guildId);
    for (const request of access) { try { await grant(request); await this.gateway.completeAccess(request.id,true); } catch (error) { await this.gateway.completeAccess(request.id,false,String(error)); } }
    for (const request of drops) { try { await drop(request); await this.gateway.completeDrop(request.id,true); } catch (error) { await this.gateway.completeDrop(request.id,false,String(error)); } }
    return {access:access.length,drops:drops.length};
  }
}
export function enabledModules<T>(configs: Array<{guildId:string;modules:Record<ModuleKey,boolean>}>, module: ModuleKey): string[] { return configs.filter(config=>config.modules[module]).map(config=>config.guildId); }
export { isConfidential };
