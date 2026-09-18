# Codex

Codex is a configuration-driven Discord framework for ESO roleplay organizations. It separates ranks, permission tiers, appointed duties, and arbitrary assignment dimensions rather than prescribing one organization's vocabulary.

## Installation

Use Node 22+, run `npm install`, apply SQL files in `migrations/` to PostgreSQL/Supabase, and configure `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Discord IDs belonging to a server are database configuration, not environment variables. See [deployment](docs/DEPLOYMENT.md) for command synchronization and security requirements.

## Server setup

`/server setup` is designed as a staged interaction: identity, permission-role mappings, rank branches and explicit progression edges, existing duty roles, assignment groups/entries, modules, resource choices, integrations, and a final preview. No Discord structure is changed before confirmation. Existing configurations offer View, Edit, Repair, and Cancel. Repair uses stored IDs, recreates only missing managed resources, updates their records, and restores functional permission overwrites without renaming or repositioning resources.

The wizard now uses role/channel selectors, paginated entity menus, buttons, and text-only modals. Configuration edits remain in an owner-scoped, seven-day Supabase draft until confirmation. Choose configuration areas from the area menu; Preview includes a downloadable readable configuration. Confirmation saves normalized configuration and its audit atomically, then repairs resources and registers the organization command namespace. Failed provisioning can be retried without replacing stored resource identities.

## Member administration

`/roster` and the configured organization namespace expose `info`, `export`, `assignments`, `audit`, `inactive-review`, `sync-member`, `sync-all`, `sync-join-history`, `status`, `retire-left`, `note`, `notes`, `rank`, and `promote`. Administration requires LEVEL_3 or Discord Administrator; arbitrary initial/corrective rank changes require Discord Administrator. Promotion uses configured graph edges and a target selector, never tier arithmetic.

Use `/assignment set-member`, `clear-member`, and `sync-roles` for member assignments. `/duty assign`, `remove`, and `list` use independently configured duty roles. Changes persist member state, rank history where applicable, and audit together. Discord role changes are scoped to configured roles, with compensation on confirmed persistence failure.

First-time synchronization imports configured roles into an INACTIVE member record. Resolve ambiguous ranks, complete required assignments, then use `status` to activate the member. A returning LEFT member becomes INACTIVE for review. Roster output includes configured branches, duties and assignment dimensions, with a full CSV export. Notes retain author, visibility and timestamp; retrieval is administrator-only.

Discord cannot expose a different global command tree to each guild from one static registration. Deployments should synchronize the configured organization namespace as guild commands; stable generic commands (`/trailmark`, `/intel`, `/contact`, `/funds`, `/strongbox`, `/duty`, `/vote`) remain static.

## Organization model

Neutral permissions are hierarchical from `BASELINE` through `LEVEL_4`; any number of Discord roles can map to a tier. `ADMIN` uses Discord administrator authorization. Ranks and advancement are explicit graph edges grouped by branch. Duties are existing Discord roles and never implicit ranks. Assignment groups contain arbitrary administrator-defined entries and independently choose single/multiple and optional/required membership.

## Resources and modules

Every managed category/channel is recorded by guild and logical key. Dynamic Trailmark and report-topic records use owned keys. Briefings, patrols, supply, and Atlas are per-server switches: only Briefings adds `dispatch-desk`; only Atlas adds `atlas`; patrols need no channel; supply shares assignments.

Trailmarks retain private sessions, reports, HQ designation, and Atlas association at the service boundary. Intelligence always includes a catch-all, supports keyword topics, and keeps Contacts as a forum. Reports containing the server's case-insensitive confidentiality marker remain fully available locally but bridge dispatch must reject them.

## Reconfiguration

Duty roles, assignment groups/entries, permission mappings, ranks/progression and module switches are independently editable. Intel topic administration remains a later-phase workflow. Codex never manages unrelated server resources and does not enforce layout after creation.

## Development and deployment

Run `npm test`, `npm run typecheck`, and `npm run lint`. Build with `npm run build`; deploy `dist/` with global secrets only. Setup requires Manage Channels/Roles and application-command scopes.

## Production implementation

The runtime uses Discord.js interactions, a Supabase service-role repository, ID-based resource repair, and multi-guild background-job boundaries. Apply all four migrations in order, including `004_phase4_administration.sql` before running this version. Run one active writer for each guild; see [deployment and recovery](docs/DEPLOYMENT.md). The test suite exercises the production handlers with Discord fakes and applies the real migrations to a local PostgreSQL engine. Retained service behavior and known implementation limits are tracked in [the feature matrix](docs/FEATURE_MATRIX.md); Atlas and the unchanged Skyrim bridge boundary are documented separately in [Atlas compatibility](docs/ATLAS_COMPATIBILITY.md).

## Advancement and field access

Apply migration `005_advancement_trailmarks.sql` for `/advancement` ballots and the full `/trailmark` lifecycle. Reviewers configure/open/close/approve/deny advancement cases; members vote through selectors. Trailmark panels grant timed, durable access, `leave` revokes it, and restart-safe background reconciliation expires sessions. Reports retain local confidentiality and distinguish HQ origin from pending delivery. See deployment documentation for permissions and recovery.

## Intelligence and Contacts

Use /trailmark report for structured capture, /intel deliver while holding an active HQ session, and topic/catch-all publication. /intel topic-add/topic-edit, /contact create/create-group/group-members, and /intel link-report provide the local workflow. Apply migration 006 before using these commands. See deployment notes for uncertain-delivery recovery.

## Cross-server intelligence

Native bridges connect configured Discord guilds on the same Codex installation. Each guild administrator independently uses /alliance setup to authorize the other. Use /alliance group-topics for local-to-remote topic mappings and /alliance status/sync for delivery monitoring/retry. See BRIDGE_COMPATIBILITY.md for the supported legacy intake and deployment boundary.
