# Deployment and operations

## Supabase

Apply migrations `001` through `011` in order. Migration `003` adds durable drafts and authored notes. Migration `004` adds member versions, historical managed-role ownership, operation receipts, additional resource specifications, and atomic administration RPCs. It enables RLS on administrative tables and restricts administration RPCs to `service_role`. Existing Atlas RPC contracts are unchanged. Codex must use `SUPABASE_SERVICE_ROLE_KEY` only on the server. Browser-facing Atlas access belongs behind separately audited RPCs—never expose the service key.

The repository adapter performs real table upserts/selects and invokes the compatibility RPC names for link codes, access requests, and Field Drops. Migration 010 implements the bot-side Atlas contracts with restricted execute grants and atomic leased claims; migration 011 completes grants and integration hardening. Verify companion signatures against ATLAS_COMPATIBILITY.md before rollout.

## Discord

Set `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`, build, and run `npm start`. Enable Guilds, Guild Members, Guild Messages, and Message Content intents. Invite Codex with application-command and Manage Channels/Roles permissions.

Run `npm run deploy:commands` to install global commands. During development, `DISCORD_GUILD_ID` installs them immediately in one guild. `ORGANIZATION_NAMESPACE` adds the configured organization-management namespace. Discord application commands are registered command trees rather than arbitrary runtime aliases, so a configuration change must trigger controlled guild-command synchronization with that guild's validated namespace.

Optional commands reject use when their module is disabled. Atlas poll work is selected per configured guild; there is no global guild ID in job processing. Briefing and Atlas resources are absent when disabled.

## Setup and repair

`/server setup` starts an administrator-only interaction. Its area menu covers identity, namespace, permissions, ranks, branches, progression, duties, assignment groups and entries, modules, resources, destinations, confidentiality settings, and preview. Role and channel selectors handle Discord identities; names are entered in text modals. Entity lists paginate at 25 choices. Drafts are durable, revision-checked, owner-scoped and expire after seven days. Resume with `/server setup`; stale panels cannot overwrite newer drafts.

Preview includes all configured ranks/edges, duties, assignments, roles, modules and resource destinations as a readable attachment. Confirm validates the graph and Discord roles, saves configuration/audit in one transaction, then provisions. The bot role must be above all synchronized roles. Missing, integration-managed or unassignable roles are rejected. Roles can be shared with permission mappings, but ranks, duties and assignment entries need distinct synchronized roles.

Existing managed categories/channels may be selected by type. Additional channels are LEVEL_1 resources under the organization category. Removing an additional resource definition leaves its Discord channel intact. BOT_COMMANDS and BOT_LOGS are optional existing text-channel destinations: non-administrator slash commands use the configured command channel; setup remains available to administrators elsewhere. The log channel receives operation metadata without note bodies. Durable audit records remain in Supabase, and log delivery failures are reported separately from completed operations.

Repair resolves every managed resource by its stored Discord ID. Existing renamed or reordered resources are retained. Missing resources are recreated, their registry IDs are updated, and functional permission overwrites are restored. Repair never restores aesthetic names or positions.

Restricted channels receive overwrites at creation, before becoming visible. Missing-channel responses allow recreation; Discord permission and network failures do not. Confirmation merges current registry IDs so an old draft cannot restore IDs replaced by a repair. Provisioning and guild-command synchronization can be retried through Repair. Reconfiguration preserves member state and rejects deleting definitions still assigned to members or changing cardinality in ways that invalidate current memberships. Changing role mappings retains the old role in the Codex ownership registry; run member synchronization to remove obsolete mappings.

## Member operations and recovery

Deploy **one active bot writer per guild**. The runtime serializes guild operations and asks concurrent callers to retry. PostgreSQL additionally checks member versions and setup revisions. Multiple active gateway workers mutating the same guild are not supported; database version checks alone cannot serialize Discord side effects.

Newly imported members start INACTIVE and retain unambiguous configured rank, duty and assignment roles. Complete required memberships before activation. If multiple rank roles are present during first import, remove the obsolete role and retry. Existing records are authoritative during synchronization. Absent members become LEFT; returning LEFT members become INACTIVE; RETIRED stays retired. `sync-join-history` imports Discord's currently available joined-at timestamp, not unavailable historical join events. Bulk sync reports per-member failures; retrying continues from persisted state after an interruption.

Rank, assignment, duty and status changes first apply scoped Discord role deltas, then atomically write member state, rank history and audit. Confirmed write failures compensate role changes. Failed compensation explicitly requests synchronization. If the database response is ambiguous, operation receipts are checked when available; the bot does not claim rollback or success when the result cannot be confirmed. Run `sync-member` to reconcile to persisted state before retrying. A process crash between Discord and PostgreSQL likewise requires synchronization. Unrelated roles are never replaced through a full role-set write.

`rank` is an administrator-only initialization/correction tool. `promote` allows only explicit outgoing graph edges for ACTIVE members, including same-tier branch alternatives. `retire-left` processes persisted LEFT members. Notes are authored records with ADMIN/MEMBER visibility labels; both labels are currently retrieved only by LEVEL_3/Administrator. All roster/admin responses are ephemeral. CSV exports contain the complete persisted roster and escape formula-leading cell values.

## Operational checks

Run `npm test`, `npm run typecheck`, `npm run lint`, and `git diff --check`. Monitor failed interaction responses and background-job completion details. Encrypt bridge credentials before persistence and rotate both Discord and Supabase credentials through the hosting platform.

Tests apply the real migrations to PGlite (PostgreSQL) and exercise the production repository RPC adapter and Discord handlers through fakes. They require no live Supabase or Discord credentials. A live staging-guild smoke test remains a deployment step: verify bot hierarchy, intents, channel permissions, command registration, setup, a member import/promotion, and Repair with the deployment's own credentials.

## Phase 5 advancement and Trailmarks

Apply migration 005 after the Phase 4 migrations and register the updated commands. `/advancement setup` configures a voter tier and minimum affirmative count. Open cases snapshot organization/rank definitions and voting rules; ballots allow one vote per eligible non-candidate. Reviewers close before approving, and approval also requires a positive majority. Candidate/edge/target-role drift rejects approval. Rank, rank history, decision and audit commit in the same transaction, reusing the Phase 4 role compensation and uncertain-outcome rules. `status` and `ballots` work after restart; an already-approved case cannot apply twice.

`/trailmark create`, `edit`, `configure`, `hq`, `deactivate`, `repair`, `set-atlas`, `clear-atlas`, `list`, `panel`, `sessions`, `leave` and `report` are executable. Create a Trailmark, configure its minimum tier and duration, and optionally designate it as HQ. A member's access panel grants one active session at a time. Stored channel IDs are authoritative; an exact recovery token in a newly created channel's topic can recover a lost creation response, without matching names. Renames and positions remain untouched. Revoking access deletes the member-specific managed overwrite.

Pending access grants and revocations persist in PostgreSQL. Startup and a non-overlapping 30-second worker reconcile up to 100 outstanding sessions per guild, sharing the guild write lock with interactions. Failed revocation blocks a subsequent grant for that member in the same batch. Expiration is read from durable timestamps, so offline expiry is processed after restart. Background failures are reported in server logs and retried. Discord Administrator bypasses channel restrictions as Discord itself defines; a session cannot remove Discord's own administrator override.

Trailmark reports are persisted with source Trailmark/channel, reporter, interaction identity, HQ-delivery state and a case-insensitive confidentiality flag. HQ-origin reports begin AT_HQ; others begin CAPTURED. Local publication and Contact delivery are completed in Phase 6. Atlas linkage stores a location identifier and optional numeric coordinates; it does not alter the browser or Skyrim local bridge.

## Phase 6 deployment and recovery

Apply 006_intelligence.sql and re-register commands. /intel set-hq uses the same HQ Trailmark as access sessions. Configure topics with /intel topic-add and the mandatory fallback with /intel catchall-set. Clearing its override binds a managed default without removing the fallback. /intel refresh and /intel repair-reporters repair destinations. Reports are submitted explicitly using /trailmark report; arbitrary chat messages are not captured as structured reports. Bot-authored messages preserve reporter IDs without webhook impersonation.

Obtain an active HQ session and use /intel deliver for field reports. HQ-origin reports already satisfy delivery. The worker processes 25 reports per guild per pass; /intel backfill page:N processes a chosen page. Published classifications remain historical. Contact and report-link selectors paginate; reports/groups support up to 100 links. /contact repair page:N repairs a bounded page of missing threads or incomplete archive operations. Removing links never deletes earlier deliveries.

Durable READY/SENDING/SENT receipts protect Discord sends. Recovery scans at most 100 messages or forum threads for the exact bot-owned token. If the original is not found, the outcome stays uncertain rather than risking a duplicate. For report messages use /intel recover-delivery key:... message:... with the original ID; author, destination and token are verified. Forum recovery searches active/archived starter messages; older unresolved cases require operator inspection of the original thread and receipt. Never reset a SENDING receipt without proving no Discord object was created. Run one bot writer per guild.

Staging smoke test: submit normal and confidential field reports, verify HQ gating, deliver both, verify topic/catch-all publication and direct-plus-group Contact deduplication. Restart and backfill again without duplicates. Rename destinations, delete a managed Contact thread, then repair: surviving names and IDs must be preserved. No live verification has been performed.

## Phase 7 bridge rollout

Apply 007_bridge.sql and re-register commands. Native peers must share this bot and service-role database. Both guilds independently configure /alliance setup with the other guild ID. The Discord administrator or configured LEVEL_3 role can manage bridges. The shared service identity authenticates native transfer, and reciprocal records authorize each source/destination; no per-peer plaintext credential is needed. Configure local topic => remote topic mappings through topic-group modals. Unknown mapped remote topics fail and retry after correction. Unmapped reports use the destination classifier/catch-all. Imported reports never relay automatically.

Worker batches send 25 queued/failed reports per guild. Source and destination report IDs plus delivery state commit in one database transaction, so retry after an ambiguous response cannot create a second remote report. Each destination then uses Phase 6 publication receipts. Local confidential reports are recorded BLOCKED and remain locally usable. /alliance headquarters-remove disables transfer and retains the private HQ/intake/history; rerun setup to reactivate. /alliance archive-category explicitly retains a selected legacy category and children with staff-only visibility; no legacy categories are detected or changed by name.

Smoke test two configured guilds: configure only one direction and verify retryable rejection, opt in on the receiver, sync normal/confidential reports, confirm a single normal remote publication, verify topic mapping, restart and sync again without duplicates. Live Discord/Supabase verification is still required.

## Phase 8 workflow rollout

Apply 008_workflows.sql and re-register commands (the neutral command is /mentorship). Run /strongbox setup to verify strongbox-drop and enforce LEVEL_3 HQ review permissions. Submit with /strongbox submit or drop; review/process/reject are staff-only. Contents go to private HQ; the drop channel receives only a receipt. /application setup enables the configured question. Applicants select an existing duty, submit, view and withdraw; staff review/approve/deny. Approval records a decision; duty assignment remains the explicit /duty assign action, so application decisions cannot silently grant roles.

Mentorship requests require synchronized ACTIVE member records. Members can request, propose/sponsor and withdraw; LEVEL_3 staff assign; participants or staff end relationships. Contradictory active mentee records and cycles are rejected. General polls snapshot eligible permission mappings, forbid duplicate ballots, and persist closing/audit. Board claims are distinct from organization assignment-group membership.

Recruitment welcome is sent once per guild/member. Invites reuse the bot-owned permanent channel invite and persist its code. The bot needs Create Instant Invite on the notice board. Invitations are returned ephemerally rather than sent as unsolicited DMs. Manual deletion of a stored invitation requires an administrator to repair its recruitment record before retrying.

Funds operations retain the original ledger and update one persisted public summary. Confirmed deleted messages are recreated using durable receipts; permission/network failures do not imply deletion. If a record saves but Discord publication fails, use its history/review/list selector to retry the saved record instead of submitting another. Interrupted summaries and welcomes retain the Phase 6 uncertain-outcome policy. Staging: restart during each workflow; verify saved decisions/ballots/claims and no duplicate messages, validate restricted Strongbox visibility, then delete and refresh the Funds summary.

## Phase 9 rollout

Apply 009_optional_systems.sql and 010_atlas.sql, then re-register commands. Optional modules must be enabled in /server setup. /supply create names the resource/unit; log records contributions, undo-last reverses only the actor's latest unallocated contribution, redistribute allocates available stock to a synchronized ACTIVE member, close/reopen/cancel control the campaign. /supply refresh repairs its summary on the configured assignments resource. /briefing setup stores the heading and verifies dispatch-desk; send publishes once, and history retries persisted publications. /patrol suggest rotates across active configured Trailmarks, while resolve is staff-only. /reference edit saves a stable-key entry; get/list use paginated selectors.

Atlas bot polling runs every five seconds when enabled, skipping busy guilds and overlapping ticks. Queue batches are 25, leases 30 seconds, maximum attempts five; exhausted requests appear REJECTED with diagnostic details in /atlas status. Link codes are 128-bit random values stored only as SHA-256 hashes and expire after ten minutes. /atlas unlink invalidates pending work. Profiles and visit heartbeats synchronize ten linked members per poll. Set CODEX_DISCORD_PRESENCE=true only after enabling the privileged Presence Intent in Discord; otherwise presence is explicitly unknown. Profile and queue failures retry without blocking other guilds or core field recovery.

All new Atlas browser-facing RPCs remain service-role-only. A trusted authenticated Atlas backend must map its caller to the Atlas account before invoking link/queue/position RPCs. Do not grant these functions to anon/authenticated or put the service key in a browser. Actual companion compatibility needs staging against its deployed signatures. The bot does not control the browser/local mod or change the Skyrim local bridge.

Smoke test each disabled module through both slash and saved components, then enable and exercise its full lifecycle. For Atlas, test two guilds, expired/reused link codes, queue lease reclamation after restart, a field drop into the canonical HQ pipeline, profile sync and visit end/heartbeat. Verify disabled Atlas claims nothing and unrelated field expiration continues after a simulated Atlas failure.

## Final audit migration and operating limits

Apply 011_production_audit.sql after 001-010. It consolidates legacy report_topics into the canonical topic store, archives the original rows in audit_events, preserves a read compatibility view, fixes service-role grants, enforces guild references and adds durable report work tracking. The bot only processes pending/changed reports; completed history does not delay new arrivals. Contact-group changes requeue affected reports without resending earlier Contact deliveries. Failed report work rotates by attempt timestamp.

Resource provisioning records a pending creation before calling Discord. Text/forum creation can recover by an exact bot resource token. Discord categories have no such metadata; after an ambiguous create response, explicitly bind the existing category in /server setup instead of retrying creation blindly. Surviving resources retain names/positions. A confirmed failure with no created category requires administrator inspection and clearing/rebinding the pending registry record.

Bulk member sync/retirement and Trailmark session exports accept page numbers with up to 100 records per page. Guild workers use round-robin scheduling with at most four concurrent guild jobs, one writer per guild, five-second Atlas opportunities and thirty-second core field recovery. Funds balances aggregate in SQL and public history retrieves at most 25 rows. Monthly summaries/undo retain the original ledger semantics. Briefing reads require LEVEL_1 because dispatch-desk is a restricted resource.

The unreleased migration 010 grant loop was narrowed to its explicit function names so unrelated Atlas overloads/functions are not blanket-revoked. Compare deployed companion signatures before applying it. Review the complete command inventory in COMMANDS.md and audit evidence in FINAL_AUDIT.md.
