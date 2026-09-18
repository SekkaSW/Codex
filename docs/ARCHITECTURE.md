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
