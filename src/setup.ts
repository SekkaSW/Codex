import type { ServerConfig } from "./domain.js";
export type SetupStage = "identity" | "namespace" | "permissions" | "ranks" | "duties" | "assignments" | "modules" | "resources" | "destinations" | "integration" | "preview" | "confirmation" | "provisioning";
export interface SetupDraft { config: Partial<ServerConfig>; stage: SetupStage; revision: number }
export function beginSetup(existing?: ServerConfig): SetupDraft { return { config: existing ? structuredClone(existing) : {}, stage:"identity", revision:0 }; }
export function updateDraft(draft: SetupDraft, patch: Partial<ServerConfig>, next: SetupStage): SetupDraft { return { config:{...draft.config, ...patch}, stage:next, revision:draft.revision + 1 }; }
export function preview(draft: SetupDraft): string {
  const c = draft.config; return [`Organization: ${c.organizationName ?? "not set"}`, `Namespace: /${c.commandNamespace ?? "not set"}`, `Confidentiality: ${c.confidentialityMarker ?? "not set"}`, `Modules: ${c.modules ? Object.entries(c.modules).filter(([,v])=>v).map(([k])=>k).join(", ") || "none" : "not set"}`].join("\n");
}
export function validateForConfirmation(draft: SetupDraft): asserts draft is SetupDraft & {config: ServerConfig} {
  const c=draft.config; if (!c.guildId || !c.organizationName || !c.commandNamespace || !/^[a-z0-9_-]{1,32}$/.test(c.commandNamespace) || !c.confidentialityMarker || !c.modules) throw new Error("Setup is incomplete");
  if (draft.stage !== "preview") throw new Error("Setup must reach preview before confirmation");
}
