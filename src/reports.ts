export interface CodexReport { id: string; originGuildId: string; authorId?: string; body: string; createdAt: string; topic?: string; source: "codex" | "legacy-wayfinder";reporterId?:string|undefined;sourceTrailmarkId?:string|undefined;sourceChannelId?:string|undefined;sourceMessageId?:string|undefined;confidential?:boolean;hqDeliveryState?:'CAPTURED'|'AT_HQ'|'PUBLISHED';linkedContactIds?:string[];linkedGroupIds?:string[];adapterMetadata?:Record<string,unknown> }
export function isConfidential(body: string, marker: string): boolean { return marker.trim() !== "" && body.toLocaleLowerCase().includes(marker.toLocaleLowerCase()); }
export function mayTransfer(report: CodexReport, marker: string): boolean { return !report.confidential && !isConfidential(report.body, marker); }
export function classifyReport(body: string, topics: ReadonlyArray<{name: string; keywords: string[]}>): string | undefined {
  const normalized = body.toLocaleLowerCase();
  return topics.find(topic => topic.keywords.some(keyword => keyword.trim()!=='' && normalized.includes(keyword.toLocaleLowerCase())))?.name;
}
export const nativeAdapter = {
  serialize(report: CodexReport): string { return JSON.stringify({version:1, type:"codex.report", report}); },
  parse(payload: string): CodexReport { if(payload.length>20000)throw new Error('Bridge envelope is too large');const value: unknown = JSON.parse(payload); if (!value || typeof value !== "object" || (value as {type?:unknown}).type !== "codex.report" || (value as {version?:unknown}).version!==1) throw new Error("Unsupported Codex bridge payload");const report=(value as {report:CodexReport}).report;validateReport(report);return report; }
};
function validateReport(report:CodexReport):void {if(!report||typeof report!=='object'||typeof report.id!=='string'||report.id.length<1||report.id.length>100||typeof report.originGuildId!=='string'||report.originGuildId.length<1||report.originGuildId.length>30||typeof report.body!=='string'||!report.body.trim()||report.body.length>4000||typeof report.createdAt!=='string'||!Number.isFinite(Date.parse(report.createdAt))||!['codex','legacy-wayfinder'].includes(report.source)||report.confidential!==undefined&&typeof report.confidential!=='boolean')throw new Error('Malformed report envelope');}
// Legacy Wayfinder messages are accepted without changing the deployed legacy bot.
export const legacyWayfinderAdapter = {
  parse(payload: string, originGuildId: string): CodexReport {
    if(payload.length>20000)throw new Error('Legacy envelope is too large');const value: unknown = JSON.parse(payload); if (!value || typeof value !== "object") throw new Error("Invalid legacy payload");
    const item = value as Record<string, unknown>; const body = item.content ?? item.report ?? item.body;
    if (typeof body !== "string") throw new Error("Legacy payload has no report text");
    const report:CodexReport={ id: String(item.id ?? crypto.randomUUID()), originGuildId, body, createdAt: String(item.created_at ?? item.createdAt ?? new Date().toISOString()), source:"legacy-wayfinder",...(item.confidential===true?{confidential:true}:{}) };validateReport(report);return report;
  }
};
