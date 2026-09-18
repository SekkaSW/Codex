import type { ServerConfig } from "./domain.js";
export type SetupStage = "identity" | "namespace" | "permissions" | "ranks" | "duties" | "assignments" | "modules" | "resources" | "destinations" | "integration" | "preview" | "confirmation" | "provisioning";
export interface SetupDraft {
    config: Partial<ServerConfig>;
    stage: SetupStage;
    revision: number;
}
export interface StoredSetupDraft extends SetupDraft {
    guildId: string;
    ownerId: string;
    updatedAt: string;
    expiresAt: string;
    organization?: import('./administration.js').OrganizationConfig;
    resourceSelections?: string[];
    messageConversation?: {
        channelId: string;
        privateThread: boolean;
        threadAttempted: boolean;
        promptId?: string;
        revision?: number;
        answerAction?: string;
        question?: string;
        textPrompt?: { action: string; content: string };
    };
    editor?: {
        section: string;
        selected?: string;
        page: number;
        conversation?: {
            step: string;
            history: Array<{ step: string; selected?: string; group?: string; branch?: string; index: number }>;
            index: number;
            group?: string;
            branch?: string;
            sync?: boolean;
            notice?: string;
        };
    };
}
export interface SetupDraftPersistence {
    loadSetupDraft(guildId: string): Promise<StoredSetupDraft | undefined>;
    saveSetupDraft(draft: StoredSetupDraft): Promise<void>;
    deleteSetupDraft(guildId: string, ownerId?: string): Promise<void>;
}
export async function resumeSetupDraft(store: SetupDraftPersistence, guildId: string, ownerId: string, existing?: ServerConfig, now = new Date()): Promise<StoredSetupDraft> {
    let draft = await store.loadSetupDraft(guildId);
    if (draft && Date.parse(draft.expiresAt) <= now.getTime()) {
        await store.deleteSetupDraft(guildId);
        draft = undefined;
    }
    if (draft && draft.ownerId !== ownerId)
        throw new Error("Another administrator owns the active setup draft");
    if (draft)
        return draft;
    const initial = beginSetup(existing);
    draft = { ...initial, guildId, ownerId, updatedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString() };
    await store.saveSetupDraft(draft);
    return draft;
}
export async function cancelSetupDraft(store: SetupDraftPersistence, guildId: string, ownerId: string): Promise<void> { const draft = await store.loadSetupDraft(guildId); if (!draft)
    throw new Error("Start /server setup first"); if (draft.ownerId !== ownerId)
    throw new Error("Only the draft owner may cancel setup"); await store.deleteSetupDraft(guildId, ownerId); }
export function beginSetup(existing?: ServerConfig): SetupDraft { return { config: existing ? structuredClone(existing) : {}, stage: "identity", revision: 0 }; }
export function updateDraft(draft: SetupDraft, patch: Partial<ServerConfig>, next: SetupStage): SetupDraft { return { config: { ...draft.config, ...patch }, stage: next, revision: draft.revision + 1 }; }
export function preview(draft: SetupDraft): string {
    const c = draft.config;
    return [`Organization: ${c.organizationName ?? "not set"}`, `Namespace: /${c.commandNamespace ?? "not set"}`, `Confidentiality: ${c.confidentialityMarker ?? "not set"}`, `Modules: ${c.modules ? Object.entries(c.modules).filter(([, v]) => v).map(([k]) => k).join(", ") || "none" : "not set"}`].join("\n");
}
export function validateForConfirmation(draft: SetupDraft): asserts draft is SetupDraft & {
    config: ServerConfig;
} {
    const c = draft.config;
    if (!c.guildId || !c.organizationName || !c.commandNamespace || !/^[a-z0-9_-]{1,32}$/.test(c.commandNamespace) || !c.confidentialityMarker || !c.modules)
        throw new Error("Setup is incomplete");
    if (draft.stage !== "preview")
        throw new Error("Setup must reach preview before confirmation");
}
export function validateRankGraph(rankIds: Iterable<string>, edges: Array<{
    fromRankId: string;
    toRankId: string;
}>): void {
    const ids = new Set(rankIds);
    for (const edge of edges) {
        if (edge.fromRankId === edge.toRankId)
            throw new Error("A rank cannot progress to itself");
        if (!ids.has(edge.fromRankId) || !ids.has(edge.toRankId))
            throw new Error("Rank progression references an unknown rank");
    }
    const active = new Set<string>(), done = new Set<string>();
    function visit(id: string): void { if (active.has(id))
        throw new Error('Rank progression contains a cycle'); if (done.has(id))
        return; active.add(id); for (const edge of edges)
        if (edge.fromRankId === id)
            visit(edge.toRankId); active.delete(id); done.add(id); }
    for (const id of ids)
        visit(id);
}
