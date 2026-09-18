export interface CodexReport { id: string; originGuildId: string; authorId?: string; body: string; createdAt: string; topic?: string; source: "codex" | "legacy-wayfinder" }
export function isConfidential(body: string, marker: string): boolean { return marker.trim() !== "" && body.toLocaleLowerCase().includes(marker.toLocaleLowerCase()); }
export function mayTransfer(report: CodexReport, marker: string): boolean { return !isConfidential(report.body, marker); }
export function classifyReport(body: string, topics: ReadonlyArray<{name: string; keywords: string[]}>): string | undefined {
  const normalized = body.toLocaleLowerCase();
  return topics.find(topic => topic.keywords.some(keyword => normalized.includes(keyword.toLocaleLowerCase())))?.name;
}
export const nativeAdapter = {
  serialize(report: CodexReport): string { return JSON.stringify({version:1, type:"codex.report", report}); },
  parse(payload: string): CodexReport { const value: unknown = JSON.parse(payload); if (!value || typeof value !== "object" || (value as {type?:unknown}).type !== "codex.report") throw new Error("Unsupported Codex bridge payload"); return (value as {report: CodexReport}).report; }
};
// Legacy Wayfinder messages are accepted without changing the deployed legacy bot.
export const legacyWayfinderAdapter = {
  parse(payload: string, originGuildId: string): CodexReport {
    const value: unknown = JSON.parse(payload); if (!value || typeof value !== "object") throw new Error("Invalid legacy payload");
    const item = value as Record<string, unknown>; const body = item.content ?? item.report ?? item.body;
    if (typeof body !== "string") throw new Error("Legacy payload has no report text");
    return { id: String(item.id ?? crypto.randomUUID()), originGuildId, body, createdAt: String(item.created_at ?? item.createdAt ?? new Date().toISOString()), source:"legacy-wayfinder" };
  }
};
