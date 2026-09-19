# Production feature matrix

This matrix distinguishes an executable path from schema or architecture alone.

| System | Status | Current production path / remaining work |
|---|---|---|
| Generalized configuration, permissions, ranks, assignments | Complete | Interactive configuration, normalized atomic persistence, validation, and production member orchestration. |
| Supabase persistence | Complete for implemented bot paths | Eleven ordered migrations, transactional RPCs, service-role grants, RLS on all Codex tables, guild-reference checks and durable operation/delivery receipts. |
| Discord runtime and deployment | Complete locally | Every registered command routes to a production handler; all command builders serialize. Guild namespace synchronization and bounded multi-guild workers are executable. Live staging is still required. |
| `/server setup` | Complete | Owner/revision/expiry-checked durable drafts; role/channel/entity selectors; text modals; paginated choices; full preview; normalized save; retryable provisioning. |
| Conversational setup UX | Complete locally | Single-question flow, value confirmations, persisted progress, Resume/Start Over/Back/Skip/Cancel, section editing, full review and final confirmation. Detailed editor retains advanced removal/maintenance paths. |
| Feature dashboards and help | Complete locally | `/help`, 20 feature panels including the organization hub, native argument prompts, paginated actions and records, reference search and claimed-assignment filter. Existing authorization remains in production handlers. |
| Confirmation and stale-panel UX | Complete locally | Important mutations confirm; owner/guild/expiry/single-use UI sessions, setup Resume on revision conflicts, original record checks and Funds undo ledger-change guard. Live Discord staging remains required. |
| Managed resources and repair | Complete | Desired module-aware resources, stored-ID lookup, missing-resource recreation, registry update, and functional overwrite restoration are executable. |
| Post-setup server configuration | Complete | View with readable export, editing all Phase 4 configuration areas, ID-based Repair, and Cancel. |
| Permission mappings | Complete | View/add/remove multiple roles per tier; hierarchical authorization uses fetched membership and existing roles. |
| Rank configuration | Complete | Rank names/roles/tiers, branches and explicit edges have interactive editors; self/dangling/cyclic graphs are rejected before confirmation. |
| Duties | Complete | Role definition editor and `/duty assign/remove/list`; transactional member/audit persistence and compensating Discord role changes. |
| Assignment groups | Complete | Group/entry editors, optional role mapping, single/multiple and required/optional rules; `/assignment set-member/clear-member/sync-roles` persist, synchronize and audit. |
| Member/roster persistence | Complete | Guild-scoped members, statuses/timestamps, rank history, duties, assignments, authored notes, versions and audit through production Supabase RPCs. |
| Member synchronization | Complete | One-member and bulk reconciliation, initial role import, departure/return/status review, scoped rank/duty/assignment roles and per-member failure reports. Single writer per guild is required. |
| Rank-role synchronization | Complete | Non-cumulative role deltas preserve unrelated roles; rank history and audit commit with state; confirmed failures compensate, uncertain outcomes request reconciliation. |
| Direct advancement/member promotion | Complete | Authorized ACTIVE-member promotion via explicit edges, paginated target selection, independent administrator rank initialization/correction. |
| Roster output/export | Complete | Ephemeral persisted roster summary and full escaped CSV with rank, branch, duties and configured assignment columns. |
| Advancement/promotion | Complete | Durable cases, snapshotted requirements, authorized duplicate-safe ballots, close/approve/deny, atomic rank/history/decision/audit, restart recovery. |
| Trailmarks and expiry | Complete | Production lifecycle, ID-based channels/repair, HQ, access selectors, durable grant/revocation/expiry recovery, reports and Atlas linkage. Local report publication is tracked under Intel. |
| Intel and structured reports | Complete | Structured Trailmark capture, canonical metadata, HQ delivery, deterministic topics/catch-all, local publication, bounded backfill, resource repair and durable delivery recovery. |
| Contacts and HQ forwarding | Complete | Forum creation/repair, details/archive, member links, paginated group/report linking, HQ-gated direct/group deduplication and durable local delivery receipts. Uncertain outcomes require recovery, never blind resend. |
| Confidentiality | Complete | Case-insensitive detection is local-pipeline-neutral and bridge transfer is denied at the transport boundary. |
| Cross-server bridge | Native complete; legacy compatibility partial | Reciprocal same-installation guild authorization, private HQ/intake, topic groups/mappings, atomic native receipts, bounded retries, status and explicit category archival. Trusted legacy JSON ingestion works; undocumented deployed Wayfinder envelopes and separate-installation transport are not claimed. |
| Funds | Complete | Existing ledger behavior preserved; durable public summary IDs, in-place edits, confirmed-deletion recovery and operation receipts. |
| Strongbox | Complete | Modal submissions, private LEVEL_3 HQ delivery, public receipt, persisted staff review/process/reject and history. |
| Recruitment, applications, mentorship, voting, assignment board | Complete | Real Discord forms/selectors and durable RPCs, review metadata, membership/duplicate/cycle checks, eligible ballots, board claims, idempotent welcome/invite behavior and audit. |
| Reference | Complete | Staff stable-key editor, persisted entries, authorized get/list selectors and bounded output. |
| Supply, briefings, patrol | Complete | Current-config module gating at interaction and SQL boundaries; durable stock/contribution/allocation lifecycle, dispatch-desk delivery receipts, and configured-Trailmark suggestions. |
| Atlas | Bot-side complete; companion compatibility partial | Ten-minute hashed links, service-only RPCs, leased multi-guild five-second polling, access/drop orchestration, profile/presence sync, visits/heartbeats and live-position boundary. Browser authentication, deployed overloads, calibration/settlement/share contracts require companion verification. |
| Medals, Field Names, Runecloak | Not implemented (intentional) | No commands or runtime services are registered for removed systems. |

Obscure Wayfinder wire fields and exact Atlas RPC signatures not stated in the migration specification remain isolated behind adapters. They must be confirmed against deployed contracts rather than invented.

Every registered namespace has an executable production handler. Unknown/stale registrations fail clearly and require command re-registration. Explicitly partial external compatibility is documented above; it is not represented as a complete deployed integration.

Complete means implemented and locally tested production paths, not a live deployment claim. The runtime uses real Discord.js/Supabase dependencies; tests run real PostgreSQL migrations and RPCs locally and fake Discord boundaries. No live guild or hosted Supabase smoke test has been performed. Operational constraints and crash/uncertain-commit recovery are documented in DEPLOYMENT.md.

Member notes and Phase 4 audits are complete: notes retain author/visibility/time; member mutations and configuration snapshots have transactional durable audit records. Optional log-channel delivery contains operation metadata only. Notes remain administrator-readable even when labelled MEMBER.


## Setup refinement

| Capability | Implemented behavior |
|---|---|
| Six-section literal-message setup | Group & Permissions; Ranks & Progression; Duties & Assignments; Optional Features; Channels; Review. |
| Human permission labels | Recruit, Member, Advanced Member, Advisors, Leader; existing authorization semantics retained. |
| Bulk ranks and progression | Bounded case-insensitive list parsing; same-screen role/level selection; named or simple paths with multiple next ranks and validation. |
| Managed duties | Safe role creation at final confirmation; durable reservation/ID/audit; exact recovery; manual mappings preserved. |
| Assignment Groups | Required/as-needed, single/multiple, bulk entries; advanced role synchronization retained. |
| Intelligence optional | Guild flags gate provisioning, repair, dashboards, direct handlers, background work and SQL; history retained. |
| Trailmarks optional | Guild flags gate resources, access/UI, workers and SQL; disable closes temporary access without deleting history. |
| Atlas without Trailmarks | Linking/map integration retained; dependent access/drop/polling unavailable with clear status. |
| Channels & Categories | Existing/new command/log destinations; ordered bulk creation-name customization; Forum types and stored IDs preserved; Promotions naming. |
| Review / Edit / Repair | Readable summaries/attachments, targeted edits, optional-feature-aware non-destructive repair. |

Validated locally, with Discord boundaries simulated and real SQL migrations/RPCs exercised in PGlite. See SERVER_SETUP_REFINEMENT.md and DEPLOYMENT.md for test results, migration 012 and required live staging.

## Native Wayfinder command restoration

Native slash arguments now supersede the mandatory dashboard-first plan. Optional feature panels remain shortcuts; original meaningful forms, access panels and ballots remain. Setup selection reviews use one Confirm & Next transition and paired rank inputs. New persistence is in migrations 013–014; rebuild, reviewed migration application, command registration and restart are required. See [command guide](COMMANDS.md), [parity inventory](WAYFINDER_COMMAND_PARITY.md), and [implementation report](WAYFINDER_RESTORATION_REPORT.md). Compatibility gaps are explicit; this is not a claim of full original Alliance or historical Discord-message import parity.


## Contact and Funds correction — 2026-09-19

Contact creation (individual and group) is available to Member / LEVEL_1 and higher through native commands and compatibility forms. Other Contact operations retain Advisors / LEVEL_3 authorization. Funds mutations retain Advanced Member / LEVEL_2; read access is unchanged. See [correction report](CONTACT_PERMISSION_CORRECTION.md) for regression coverage and rollout.
