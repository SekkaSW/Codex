# Architecture and Wayfinder migration

The legacy repository was unavailable in this environment, so no legacy repository was altered. Codex defines clean adapters rather than coupling Intel to transport details.

| Legacy concept | Codex concept |
|---|---|
| Ranger role constants | `permission_roles`, many roles per neutral tier |
| cumulative rank roles | explicit ranks plus `rank_progression` edges |
| Hold | administrator-defined assignment group |
| hard-coded duties | `duty_roles` referencing existing Discord roles |
| channel environment IDs | `managed_resources` scoped by guild |
| Ranger Alliance payload | legacy adapter to canonical `CodexReport` |
| `[CORPS ONLY]` | configurable local-only marker |

## Bridge compatibility

Native Codex transport uses a versioned `codex.report` JSON envelope. The inbound legacy adapter accepts the common `content`, `report`, or `body` text fields and normalizes timestamps. Exact wire compatibility cannot be guaranteed without access to the legacy source or captured payloads; add a narrowly scoped parser fixture when that protocol is available. Outbound dispatch must call `mayTransfer` before every adapter, so transport choice cannot bypass confidentiality.

## Atlas compatibility

Atlas remains an optional module and Trailmark identity/access remains the integration boundary. No map repository was changed. A future Codex-Atlas client should resolve guild resources and Trailmark metadata through a versioned API and must not depend on environment-configured channel IDs. Temporary linking codes should remain short-lived, single-use records; their storage is intentionally left to the deployment's authentication service.

## Scope retained for service migration

Existing feature services (roster, funds, strongbox, contacts, applications, mentorship, voting, recruitment, Trailmarks, and Intel) should consume these configuration interfaces as they are brought into the target. Removed feature families—medals, field names, and runecloak—have no schema or command registration here. The `reference` command, if recovered from legacy source, requires functional review rather than automatic deletion.

## Phase 4 administration

`runtime/setupWizard.ts` owns Discord configuration editing. Every action reloads an owner/revision/expiry-checked Supabase draft; selectors persist structured configuration, with no administrator-entered JSON. `codex_save_organization` atomically updates normalized tables and snapshots the change into audit. Stored resource IDs remain authoritative across retries. Configuration stores historical role ownership so old mappings can be reconciled safely.

`administration.ts` handles explicit-edge advancement, cardinality, managed-role deltas, compensation and roster generation. `runtime/handlers/members.ts` and `duty.ts` authorize using freshly fetched Discord membership and live role mappings, then invoke these services. `persistence/administration.ts` calls service-only Supabase RPCs. Member state, duty/assignment membership, rank history and audit commit together with a version check. Notes are separately authored and transactionally audited.

Discord and PostgreSQL cannot share an atomic transaction. The supported deployment has one writer per guild, compensated Discord mutations on confirmed database failure, and explicit reconciliation after crashes, uncertain commits or failed compensation. A durable operation receipt distinguishes acknowledged database commits from some lost responses. Configuration and membership writes use a guild advisory lock within PostgreSQL; that lock does not cover remote Discord calls.

Rank permission tiers remain metadata independent of permission-role mappings. Advancement traverses graph edges, rejects cycles/self/dangling edges, and does not include appointed roles unless explicitly configured as ranks. Duty and assignment roles are independent. Required group membership is enforced for ACTIVE members, while INACTIVE staging allows onboarding across several required groups.

The roster and the configured organization namespace share executable member handlers. Assignment board operations remain separate and deferred; only member assignment administration is part of Phase 4. Existing Funds, Trailmark, Intel, Contact, bridge and Atlas boundaries are retained.

## Phase 5 durable workflows

`field.ts` owns advancement orchestration and Trailmark access reconciliation. `persistence/field.ts` extends the existing administration repository; migration 005 provides guild-scoped service-role-only RPCs. Advancement approval supplies a transactional commit callback to the existing member transition service, allowing rank history and the case decision to commit together. Ballot snapshots preserve historical configuration even if live ranks change.

Trailmark access is persisted desired state (PENDING, ACTIVE, REVOKING, CLOSED). The Discord adapter manipulates only Trailmark channel/member overwrites and stable managed resource identities. The runtime starts recovery on ready and serializes background work with foreground guild mutations.

## Phase 6 intelligence

IntelligencePipeline uses the canonical report model and codex_intelligence. Classification order is priority, name, stable ID; blank keywords never match. HQ delivery precedes local publication. Contact groups expand to active individual Contacts and deduplicate with direct links. Confidentiality only restricts bridge transfer. Durable discord_deliveries receipts protect report sends and Contact forum creation. An uncertain send is recovered by an exact bot-authored token, never blindly retried. The runtime drains 25-report pages per configured guild and serializes them with foreground writes.

## Phase 7 bridges

BridgeCoordinator extends the existing protocol-independent BridgeService. Native codex-v1 transport is a service-only database boundary between mutually authorized guilds in one installation. Version, expected identities and persisted source report are validated before atomic receive/delivery receipt. Imported reports carry immutable origin metadata and do not relay. Legacy ingestion is an isolated Discord message adapter, gated by configured intake channel and trusted sender. Remote guild-local topic names are mapped through stored topic groups.

## Phase 8 organization workflows

The service-only codex_workflow RPC extends existing domain tables with durable review metadata, configurable forms, voter snapshots, uniqueness/cycle checks and audit. It does not replace the Funds ledger. DurableSummary stores message IDs in bot_message_state, edits surviving bot-owned messages and uses delivery receipts for replacement after confirmed deletion. Strongbox, welcome and application sends use the same receipts. Setup no longer shadows StrongboxStore.save: configuration uses its atomic organization save path.

## Phase 9 optional systems and Atlas

Optional commands and component submissions check current module configuration; their SQL boundary also enforces gating. Supply has immutable contribution/allocation/undo events, stock checks and durable campaign lifecycle. Briefings use delivery receipts; Reference edits are keyed upserts. Patrol rotates suggestions among configured active Trailmarks. AtlasRuntime uses the retained AtlasService/AtlasGateway boundary. Queue claims are bounded to 25 with 30-second leases and five attempts, and all polling is guild-scoped. An access request atomically references its durable Trailmark session before Discord reconciliation, so reclaims do not renew the request. Drops reuse queue UUIDs as report IDs. Profile synchronization batches ten linked members per poll; visits follow durable active sessions. Atlas failure does not suppress Trailmark expiration or local report processing.

## Final audit hardening

One canonical topic table backs the legacy report_topics compatibility view; migrated rows are snapshotted in the audit log. All Codex-owned tables have RLS and explicit service-role-only grants. Triggers reject cross-guild rank/Trailmark/Contact references. Durable report dirty/attempt state prevents scanning completed history on every worker pass and requeues changes to group membership. Provisioning writes a pending registry record before external creation and refuses blind retries after uncertain category creation. Multi-guild workers are round-robin with four concurrent guilds, while foreground/background work remains serialized within each guild.

## Conversational setup and dashboards

`runtime/setupConversation.ts` edits only the existing setup draft. Its current question, bounded navigation history, selected entities, and confirmation text live inside the existing draft JSON payload. `SetupWizard` retains ownership, expiry, revision checks, normalized save, and final provisioning. No migration or RPC changes are needed. Back changes navigation, not saved answers; editing an answer replaces that draft value. Review and Confirm Setup are separate. Existing-resource IDs remain authoritative. Creation names are represented by existing `additionalResources` preferences; `configuredResources` merges them by key and filters disabled module resources. Renaming a creation preference does not rename a healthy Discord resource.

`runtime/panels.ts` builds dashboards from the command schema and a presentation permission map. Fresh Discord membership and existing role mappings govern visibility. Argument collection projects a normal command interaction into the existing route; original handlers perform authorization again. The organization namespace presents a navigation hub without exposing staff-only records to ordinary members. There are no alternate mutation implementations in the dashboards.

`runtime/confirmation.ts` adds owner/guild-bound, expiring, single-use confirmation screens. It retains the original selected record/revision or command arguments, then dispatches through the same handlers. Funds undo additionally detects a changed ledger head. `runtime/browse.ts` provides bounded search/filter views over existing read RPCs. These UI input/search/confirmation sessions are process-local and safely expire on restart; no durable mutation state depends on them. Existing operation receipts, workflow state machines, authorization snapshots and recovery behavior remain authoritative.

The runtime error boundary logs detailed errors and emits plain-language recovery guidance. Unknown components receive an explicit stale-panel response. Native command/button/select/modal interactions implement the conversational UI; no gateway intent or raw-message setup listener was added. Existing Message Content use for legacy bridge intake is unchanged.


## Server setup refinement (current)

The production runtime enables the versioned six-section draft flow in `runtime/setupRefinement.ts`. `MessageSetupWizard` retains the existing owner/guild/channel/prompt/revision fencing and message listener. Older drafts retain their accepted configuration and reopen in the new section editor; obsolete prompt expectations are cleared. The previous flow remains compatible with historical tests, while production starts the refinement. Lists are bounded to 1,800 characters and 100 entries, with 100 characters per name. Rank and assignment identity reuse is case-insensitive; existing member-reference constraints still reject unsafe removals at final save.

The draft stores rank-list review, progression path traversal, selected group and navigation history. No-branch progression uses an internal “General progression” branch because the existing normalized model requires branch identities. Named and simple paths both persist explicit next-rank relationships, including same-tier alternatives, with cycle/self/dangling validation. Permission labels are presentation only: Recruit=BASELINE, Member=LEVEL_1, Advanced Member=LEVEL_2, Advisors=LEVEL_3, Leader=LEVEL_4. Rank tier metadata does not implicitly rewrite permission-role mappings.

Migration 012 widens the existing `server_modules` key constraint for `intelligence` and `trailmarks` and backfills true for populated configurations. Missing flags also read as enabled for compatibility. Resource planning filters both default and overridden resources by feature. Runtime entry points, dashboards, background scheduling and the original service RPCs enforce current flags. Shared Intelligence delivery-receipt operations remain available to Funds and other unrelated workflows. Native bridge delivery checks both source and destination Intelligence flags. Atlas linking/status remain available independently; Trailmark queues, grants and visits are gated. Explicit Trailmark disable confirmation first closes temporary sessions through existing revocation methods, then saves the flag; no background processing is required while disabled.

New duties are draft definitions until final confirmation. The service-only `managed_duty_creations` table records a guild/name-scoped creation reservation and attempt UUID before Discord role creation. A completed stored role ID is authoritative; uncertainty recovers only an exact bot-authored RoleCreate audit event, never a name match. Roles default to zero permissions, not mentionable and not hoisted. Missing or unmanageable stored roles fail without duplication. Existing manual duties are retained. Completion records creation audit atomically; first-time guild receipts flush audit when the server configuration is first inserted. Normal `duty_roles`, historical owned-role tracking and assign/remove workflows remain unchanged.

The schema is additive, RLS-enabled and service-role-only. The canonical numbered migration and generated Supabase timestamp mirror are byte-equivalent after line-ending normalization. No browser keys, authentication claims, external Atlas contracts, previous migrations or command definitions were changed.
