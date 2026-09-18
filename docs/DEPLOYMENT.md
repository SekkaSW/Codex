# Deployment and operations

## Supabase

Apply migrations `001` through `004` in order. Migration `003` adds durable drafts and authored notes. Migration `004` adds member versions, historical managed-role ownership, operation receipts, additional resource specifications, and atomic administration RPCs. It enables RLS on administrative tables and restricts administration RPCs to `service_role`. Existing Atlas RPC contracts are unchanged. Codex must use `SUPABASE_SERVICE_ROLE_KEY` only on the server. Browser-facing Atlas access belongs behind separately audited RPCs—never expose the service key.

The repository adapter performs real table upserts/selects and invokes the compatibility RPC names for link codes, access requests, and Field Drops. Deployments must install compatible RPC implementations with restricted execute grants. Queue claims must be atomic in production.

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
