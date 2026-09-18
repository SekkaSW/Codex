# Production feature matrix

This matrix distinguishes an executable path from schema or architecture alone.

| System | Status | Current production path / remaining work |
|---|---|---|
| Generalized configuration, permissions, ranks, assignments | Complete | Interactive configuration, normalized atomic persistence, validation, and production member orchestration. |
| Supabase persistence | Complete for Phase 4 | Transactional configuration/member/note RPCs, member versions, role ownership, operation receipts, rank history and durable audit; existing feature repositories retained. |
| Discord runtime and deployment | Complete for Phase 4 | Production setup, roster/organization, member assignments, duties and Funds routing; confirmation/repair synchronizes the guild namespace. Other namespaces fail explicitly until their later phase. |
| `/server setup` | Complete | Owner/revision/expiry-checked durable drafts; role/channel/entity selectors; text modals; paginated choices; full preview; normalized save; retryable provisioning. |
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
| Funds | Partially complete | Typed Discord commands route through generalized LEVEL_2 authorization to the persistent Supabase ledger for deposit, spend, set-balance, undo, balance, history, UTC monthly summaries, and on-demand summary output. Every mutation records actor, reason, timestamp, and reversal linkage. Maintaining a durable public summary-message ID and editing that message in place remains. |
| Strongbox | Partially complete | Persistent submission service/schema and correct managed resources exist; modal review/processing workflow remains. |
| Recruitment, applications, mentorship, voting, assignment board, reference | Partially complete (later phases) | Command surfaces and schemas remain; duties and member assignments are complete in their dedicated rows above. |
| Supply, briefings, patrol | Partially complete | Module gating and relevant resource suppression work; full legacy workflows remain. |
| Atlas | Partially complete | Eligibility/link expiry, compatibility RPC repository, per-guild module-gated poll service/job, and schema exist; full profile/presence and visit/heartbeat RPC implementations remain. |
| Medals, Field Names, Runecloak | Not implemented (intentional) | No commands or runtime services are registered for removed systems. |

Obscure Wayfinder wire fields and exact Atlas RPC signatures not stated in the migration specification remain isolated behind adapters. They must be confirmed against deployed contracts rather than invented.

No retained command reaches a generic “accepted” response. Namespaces without a completed production handler return an explicit not-implemented error and remain classified as partial above.

Phase 4 completion means implemented and locally tested production paths, not a live deployment claim. The runtime uses real Discord.js/Supabase dependencies; tests run real PostgreSQL migrations and RPCs locally and fake Discord boundaries. No live guild or hosted Supabase smoke test has been performed. Operational constraints and crash/uncertain-commit recovery are documented in DEPLOYMENT.md.

Member notes and Phase 4 audits are complete: notes retain author/visibility/time; member mutations and configuration snapshots have transactional durable audit records. Optional log-channel delivery contains operation metadata only. Notes remain administrator-readable even when labelled MEMBER.
