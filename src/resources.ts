import type { ModuleKey } from "./domain.js";

export const resourceKeys = ["CORE_CATEGORY", "NOTICE_BOARD", "ROSTER", "FUNDS", "STRONGBOX_DROP", "ASSIGNMENTS", "ORGANIZATION_CATEGORY", "HQ_STRONGBOX", "APPLICATIONS", "ADVANCEMENT", "INTELLIGENCE_CATEGORY", "CONTACTS", "REPORT_CATCHALL", "TRAILMARK_CATEGORY", "TRAILMARK_ACCESS", "BOT_COMMANDS", "BOT_LOGS", "ATLAS", "DISPATCH_DESK"] as const;
export type ResourceKey = typeof resourceKeys[number];
export interface ManagedResource { guildId: string; key: ResourceKey | `TRAILMARK:${string}` | `REPORT_TOPIC:${string}`; discordId: string; kind: "CATEGORY" | "CHANNEL" | "FORUM"; ownerId?: string }
export interface ResourceSpec { key: ManagedResource["key"]; kind: ManagedResource["kind"]; name: string; parent?: ResourceKey; minimumTier?: "LEVEL_1" | "LEVEL_3" }

export function desiredResources(modules: Record<ModuleKey, boolean>): ResourceSpec[] {
  const specs: ResourceSpec[] = [
    { key:"CORE_CATEGORY", kind:"CATEGORY", name:"Codex" }, { key:"NOTICE_BOARD", kind:"CHANNEL", name:"notice-board", parent:"CORE_CATEGORY" },
    { key:"ROSTER", kind:"CHANNEL", name:"roster", parent:"CORE_CATEGORY" }, { key:"FUNDS", kind:"CHANNEL", name:"funds", parent:"CORE_CATEGORY" },
    { key:"STRONGBOX_DROP", kind:"CHANNEL", name:"strongbox-drop", parent:"CORE_CATEGORY" }, { key:"ASSIGNMENTS", kind:"CHANNEL", name:"assignments", parent:"CORE_CATEGORY" },
    { key:"ORGANIZATION_CATEGORY", kind:"CATEGORY", name:"Organization", minimumTier:"LEVEL_1" }, { key:"HQ_STRONGBOX", kind:"CHANNEL", name:"hq-strongbox", parent:"ORGANIZATION_CATEGORY", minimumTier:"LEVEL_3" },
    { key:"APPLICATIONS", kind:"CHANNEL", name:"applications", parent:"ORGANIZATION_CATEGORY", minimumTier:"LEVEL_1" }, { key:"ADVANCEMENT", kind:"CHANNEL", name:"advancement", parent:"ORGANIZATION_CATEGORY", minimumTier:"LEVEL_1" },
    { key:"INTELLIGENCE_CATEGORY", kind:"CATEGORY", name:"Intelligence" }, { key:"CONTACTS", kind:"FORUM", name:"contacts", parent:"INTELLIGENCE_CATEGORY" },
    { key:"REPORT_CATCHALL", kind:"CHANNEL", name:"reports-general", parent:"INTELLIGENCE_CATEGORY" }, { key:"TRAILMARK_CATEGORY", kind:"CATEGORY", name:"Trailmarks" },
    { key:"TRAILMARK_ACCESS", kind:"CHANNEL", name:"trailmark-access", parent:"TRAILMARK_CATEGORY" }
  ];
  if (modules.atlas) specs.push({ key:"ATLAS", kind:"CHANNEL", name:"atlas", parent:"CORE_CATEGORY" });
  if (modules.briefings) specs.push({ key:"DISPATCH_DESK", kind:"CHANNEL", name:"dispatch-desk", parent:"ORGANIZATION_CATEGORY", minimumTier:"LEVEL_1" });
  return specs;
}

export interface Provisioner { exists(id: string): Promise<boolean>; create(spec: ResourceSpec, parentId?: string): Promise<string>; restorePermissions(resource: ManagedResource, spec: ResourceSpec): Promise<void> }
export interface Registry { list(guildId: string): Promise<ManagedResource[]>; put(resource: ManagedResource): Promise<void> }
export async function repairResources(guildId: string, specs: ResourceSpec[], registry: Registry, provisioner: Provisioner): Promise<{created: string[]; retained: string[]}> {
  const records = await registry.list(guildId); const byKey = new Map(records.map(r => [r.key, r]));
  const created: string[] = []; const retained: string[] = [];
  for (const spec of specs) {
    let record = byKey.get(spec.key);
    if (!record || !(await provisioner.exists(record.discordId))) {
      const parentId = spec.parent ? byKey.get(spec.parent)?.discordId : undefined;
      const discordId = await provisioner.create(spec, parentId);
      record = { guildId, key: spec.key, discordId, kind: spec.kind };
      await registry.put(record); byKey.set(spec.key, record); created.push(spec.key);
    } else retained.push(spec.key);
    await provisioner.restorePermissions(record, spec);
  }
  return { created, retained };
}
