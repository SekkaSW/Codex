# Production feature matrix

This matrix distinguishes an executable path from schema or architecture alone.

| System | Status | Current production path / remaining work |
|---|---|---|
| Generalized configuration, permissions, ranks, assignments | Complete | Normalized schema and tested domain resolution; rank progression uses explicit edges. |
| Supabase persistence | Partially complete | Concrete configuration/resource, Trailmark-session, Intel, Contact-forward, funds, Strongbox, and Atlas repository methods exist. Member/workflow CRUD and production RPC SQL still need expansion. |
| Discord runtime and deployment | Partially complete | Login, intents, command deployment, interaction router, errors, module gates, and dynamic namespace deployment exist. Generic acceptance acknowledgements have been removed; Funds has dedicated routing, while unimplemented namespaces now fail explicitly rather than claiming success. |
| `/server setup` | Partially complete | Administrator entry, existing-config actions, modal stages, preview model, persistence boundary, and provisioning exist. Role/channel select components and durable resumable drafts remain. |
| Managed resources and repair | Complete | Desired module-aware resources, stored-ID lookup, missing-resource recreation, registry update, and functional overwrite restoration are executable. |
| Roster/member and rank sync | Partially complete | Persistent schema and non-cumulative desired-role service exist; Discord member reconciliation, inactive review, and audit command implementations remain. |
| Advancement/promotion | Partially complete | Branch-aware targets and schema are present; ballot lifecycle and Discord promotion actions remain. |
| Trailmarks and expiry | Partially complete | Persistent Trailmark/session schema, single-active-session service, expiration, and multi-guild job exist; full panels and channel lifecycle handlers remain. |
| Intel and structured reports | Partially complete | Capture, classification, state transitions, metadata, persistence, and local confidential processing exist; Discord capture/backfill/reporter-repair handlers remain. |
| Contacts and HQ forwarding | Partially complete | HQ gating, source-message requirement, duplicate prevention, publisher boundary, and persistence exist; forum-thread CRUD interactions remain. |
| Confidentiality | Complete | Case-insensitive detection is local-pipeline-neutral and bridge transfer is denied at the transport boundary. |
| Cross-server bridge | Partially complete | Native and isolated legacy adapters plus transfer boundary exist; bridge provisioning, authentication, retries, alliance topic synchronization, and exact undocumented legacy fields remain. |
| Funds | Partially complete | Typed Discord commands route through generalized LEVEL_2 authorization to the persistent Supabase ledger for deposit, spend, set-balance, undo, balance, history, UTC monthly summaries, and on-demand summary output. Every mutation records actor, reason, timestamp, and reversal linkage. Maintaining a durable public summary-message ID and editing that message in place remains. |
| Strongbox | Partially complete | Persistent submission service/schema and correct managed resources exist; modal review/processing workflow remains. |
| Recruitment, duties, applications, mentorship, voting, assignment board, reference | Partially complete | Command surfaces and normalized schemas exist; feature-specific Discord components/services remain. |
| Supply, briefings, patrol | Partially complete | Module gating and relevant resource suppression work; full legacy workflows remain. |
| Atlas | Partially complete | Eligibility/link expiry, compatibility RPC repository, per-guild module-gated poll service/job, and schema exist; full profile/presence and visit/heartbeat RPC implementations remain. |
| Medals, Field Names, Runecloak | Not implemented (intentional) | No commands or runtime services are registered for removed systems. |

Obscure Wayfinder wire fields and exact Atlas RPC signatures not stated in the migration specification remain isolated behind adapters. They must be confirmed against deployed contracts rather than invented.

No retained command reaches a generic “accepted” response. Namespaces without a completed production handler return an explicit not-implemented error and remain classified as partial above.
