# Contact permission and Funds label correction — 2026-09-19

Branch: `wayfinder-command-ux-restoration`. Parent restoration checkpoint: `a67e6a33a83c040ac34b510305a9443d30a84cfd`. Follow-up commit message: `Correct Contact creation permissions and Funds labels`.

## Current policy

| Operation | Requirement |
| --- | --- |
| `/contact create`, `/contact create-group` | Member / LEVEL_1 or higher |
| Other Contact operations, including list, setup, repair, edit, archive, assessment and existing-group membership | Advisors / LEVEL_3, unchanged |
| Funds deposit, spend, set-balance, undo-last, refresh-summary | Advanced Member / LEVEL_2, unchanged threshold |
| Funds balance, history, monthly | Existing read policy, unchanged |

Existing Discord Administrator overrides remain. Tier mappings are hierarchical, support multiple roles per tier and are not Discord permission bits or fixed rank names. Native Contact creation no longer has a blanket Advisors guard. Compatibility creation and submission use the same operation-specific helper; role membership and current role existence are checked on submission. Form owner and guild are checked. Older unbound creation forms must be reopened. Existing revision, lifecycle, uniqueness, guild isolation and feature checks remain.

Creation autocomplete now permits configured assignment choices for Members. It refuses broader Contact/person/group lookups on creation paths, even for forged focus names. There is no new general record-listing permission. Other Contact fields retain existing behavior; no separate stronger field authorization was found on the supported creation fields. Panel/help visibility uses the same requirement; hidden staff actions still fail at the production handlers. Native command options and permission defaults are unchanged. Only the two creation descriptions change from Recruit+ to Member+.

Forum access/visibility, report forwarding, HQ/confidentiality policies and bot provisioning permissions remain unchanged. Both compatibility creation kinds publish through the existing durable Forum delivery implementation, matching native creation. Duplicate submission uses the existing interaction identity; durable receipts recover interrupted Forum identity persistence without a second post. Creating a group does not authorize later group administration. Setup, Supply options/order, meaningful forms, ballots and other restored workflows are unchanged. Funds ledger semantics, attribution, privacy, destinations and confirmation/drift guards are unchanged. Configured ranks named Officer remain valid; historical reports retain their original wording with a dated correction.

## Persistence and migration review

No SQL migration is required: Codex user-tier checks run in trusted server handlers; RPC access remains service-only. Canonical migrations 001–014 and their deployment mirrors are byte-for-byte unchanged. Latest is **014**. A hosted project currently at 012 has these existing pending migrations:

- `migrations/013_native_supply_workflows.sql` / `supabase/migrations/20260919144046_native_supply_workflows.sql`
- `migrations/014_native_workflow_contracts.sql` / `supabase/migrations/20260919145259_native_workflow_contracts.sql`

Do not apply both canonical and mirror copies. No hosted database was accessed or changed.

## Local validation

- `npm.cmd test`: **244 passed, 0 failed, 0 skipped**. Four new regression tests exercise matrices of cases, not just builders.
- `npm.cmd run lint`: passed (TypeScript no-emit check).
- `npm.cmd run build`: passed.
- `git diff --check`: passed.
- `npm.cmd ls --depth=0`: installed dependency tree valid; reused existing dependencies without reinstalling or modifying lockfiles.
- Existing full-chain SQL, populated upgrade, migration-mirror, RLS/service-role and guild-isolation tests passed as part of the full suite.

New coverage runs native creation through production routing/handlers with real PGlite SQL and controlled Discord boundaries. It checks individual/group creation by LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, a second LEVEL_1 mapping and Administrator; rejects BASELINE, unmapped, deleted and revoked roles, foreign guilds and disabled Intelligence; checks owner/guild binding and stale record revisions; rejects staff operations and forged staff components; verifies Member-only panel actions and assignment-only autocomplete. Persistence assertions inspect guild, actor audit, Contact kind, Forum identity and delivery receipt counts across retries and an injected failure after Forum delivery. Compatibility modal submissions reauthorize after role changes and create both kinds without duplicate Forum posts.

Funds tests exercise all five mutations through the production handler/service for LEVEL_2, higher tiers and Administrator; reject LEVEL_1, revoked/deleted roles; retain reads without a qualifying role; verify confirmation-time revocation and the Advanced Member denial text. Existing tests retain ledger-drift, ownership and one-use confirmation coverage. Local command payload checks verify Member+ descriptions, unchanged Contact defaults and guild-root-only registration.

## Rollout and boundaries

Use the exact PowerShell global/core and per-guild organization-root registration commands in [DEPLOYMENT.md](DEPLOYMENT.md#contact-permission-correction-rollout--2026-09-19). They were verified against current `src/runtime/deploy.ts` and `src/runtime/registration.ts`; payloads were generated locally without Discord calls. The only scope variables are `DISCORD_GUILD_ID` and `ORGANIZATION_NAMESPACE`; credentials are `DISCORD_TOKEN` and `DISCORD_APPLICATION_ID`. There are no CLI scope flags. The script does not automatically read `.env`.

The broader native-command restoration still needs registration; this correction also updates two descriptions. The deployment section includes read-only GET commands to inspect older guild-local core definitions that may shadow globals. No deletion or bulk replacement is automatic. Keep unrelated registrations and organization roots.

No push, merge, live command registration, bot restart, hosted migration, Discord mutation, legacy/Atlas modification or production-data access occurred. Main remains at `2b0fd649bf1d1ca523b4c6b969c7f1c70b476a9d`. The pre-commit review covers only intended source/tests/docs; environment files, dependencies and generated output remain ignored. No credentials or confidential operational data were added. Discord behavior still needs operator-controlled staging under actual channel permissions; local controlled-boundary tests are not a live Discord acceptance test. Legacy Alliance provisioning, unrecognized historical report import, Forum tag automation, On Leave and append-only-note redesign remain out of scope.
