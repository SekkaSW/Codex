# Codex

Codex is a configuration-driven Discord organization-management and field-information framework. It separates ranks, permission tiers, appointed duties, and arbitrary assignment dimensions rather than prescribing one organization's vocabulary.

## Installation

Use Node 22+, run `npm install`, apply SQL files in `migrations/` to PostgreSQL/Supabase, and configure `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Discord IDs belonging to a server are database configuration, not environment variables. See [deployment](docs/DEPLOYMENT.md) for command synchronization and security requirements.

## Server setup

`/server setup` follows six sections: **Group & Permissions**, **Ranks & Progression**, **Duties & Assignments**, **Optional Features**, **Channels**, and **Review**. Text answers are literal owner messages in a private setup thread, or direct replies to the current question in the starting channel. Native selectors choose Discord roles and channels; buttons handle decisions and navigation. Enable Message Content Intent in the Developer Portal.

Permission labels are Recruit, Member, Advanced Member, Advisors and Leader; they retain the existing internal authorization meanings and are separate from ranks. Enter ranks as a comma-separated list, then choose each rank's role and permission level together. Progression supports named branches or a simple starting rank and successive next-rank choices. Enter duties and assignment entries as lists too. Codex creates new, permission-free duty roles only after final confirmation. Assignment role synchronization remains in Detailed Editor.

Intelligence and Trailmarks are independently optional. Existing guilds retain both enabled after upgrade. Disabled features disappear from relevant dashboards and stop provisioning and workers, while historical records and resources remain. Disabling Trailmarks closes temporary access during confirmation before stopping workers. Atlas can remain enabled for linking and map use while its Trailmark-dependent features are unavailable.

Every answer saves an owner-scoped, revision-checked, seven-day draft. Back retains values; optional duties offer Skip; Cancel discards only the draft. Resume continues after restart. Edit Section offers targeted settings within the six sections, plus View Saved, Repair and Detailed Editor. Only **Confirm Setup** applies configuration, creates duty roles and provisions channels. Repair uses stored IDs and respects disabled features without renaming, moving or deleting healthy resources. See the [refinement report](docs/SERVER_SETUP_REFINEMENT.md).

## Start with a dashboard

Use `/help` to discover your available features, or `/trailmark panel`, `/application panel`, `/funds panel`, and the other feature dashboards. Buttons open selectors and forms backed by the existing production handlers. The configured organization command, such as `/example panel`, opens a member navigation hub; staff record tools remain permission-gated. Reference includes search and the assignment board includes My Claimed Assignments. All previous subcommands remain available; `/trailmark panel` now opens its dashboard, whose Request Access button opens the original access selector. Discord command trees that have subcommands use `panel` rather than an unsupported bare root invocation.

Destructive actions ask for confirmation. Expired input forms can be reopened from `/help`; setup progress remains durable across bot restarts. Register dashboard commands when installing the earlier UX overhaul, as described in [deployment](docs/DEPLOYMENT.md). The setup refinement requires migration 012 and a bot restart, but no slash-command redeployment. See the [setup correction report](docs/SETUP_MESSAGE_CORRECTION.md) and [UX completion report](docs/UX_COMPLETION.md) for coverage and limitations.

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

Duty roles, assignment groups/entries, permission mappings, ranks/progression and module switches are independently editable. Intel topics are managed through /intel topic-add and topic-edit. Codex never manages unrelated server resources and does not enforce layout after creation.

## Development and deployment

Run `npm test`, `npm run typecheck`, and `npm run lint`. Build with `npm run build`; deploy `dist/` with global secrets only. Setup requires Manage Channels/Roles and application-command scopes.

## Production implementation

The runtime uses Discord.js interactions, a Supabase service-role repository, ID-based resource repair, and multi-guild background-job boundaries. Apply all eleven migrations in order through `011_production_audit.sql` before running this version. Run one active writer for each guild; see [deployment and recovery](docs/DEPLOYMENT.md). The test suite exercises the production handlers with Discord fakes and applies the real migrations to a local PostgreSQL engine. Retained service behavior and known implementation limits are tracked in [the feature matrix](docs/FEATURE_MATRIX.md); Atlas and the unchanged Skyrim bridge boundary are documented separately in [Atlas compatibility](docs/ATLAS_COMPATIBILITY.md).

## Advancement and field access

Apply migration `005_advancement_trailmarks.sql` for `/advancement` ballots and the full `/trailmark` lifecycle. Reviewers configure/open/close/approve/deny advancement cases; members vote through selectors. Trailmark panels grant timed, durable access, `leave` revokes it, and restart-safe background reconciliation expires sessions. Reports retain local confidentiality and distinguish HQ origin from pending delivery. See deployment documentation for permissions and recovery.

## Intelligence and Contacts

Use /trailmark report for structured capture, /intel deliver while holding an active HQ session, and topic/catch-all publication. /intel topic-add/topic-edit, /contact create/create-group/group-members, and /intel link-report provide the local workflow. Apply migration 006 before using these commands. See deployment notes for uncertain-delivery recovery.

## Cross-server intelligence

Native bridges connect configured Discord guilds on the same Codex installation. Each guild administrator independently uses /alliance setup to authorize the other. Use /alliance group-topics for local-to-remote topic mappings and /alliance status/sync for delivery monitoring/retry. See [bridge compatibility](docs/BRIDGE_COMPATIBILITY.md) for the supported legacy intake and deployment boundary.

## Organization workflows

Apply migration 008 for Strongbox, duty applications, mentorship, general voting, recruitment and the assignment board. /strongbox setup verifies private HQ review access. /application setup enables a configurable question for configured duties. /mentorship manages persisted requests and relationships. /vote opens durable polls with permission snapshots; /assignment open creates board items distinct from member assignment groups. Funds mutations and /funds refresh-summary maintain the stored public summary message.

## Optional systems and Atlas

Apply migrations 009 and 010. Enable Supply, Briefings, Patrol or Atlas using /server setup. Supply records contributions, undo and allocations on the assignments resource. Briefings use dispatch-desk; Patrol suggests configured active Trailmarks without provisioning another channel. Reference entries support /reference edit/get/list. Atlas links expire in ten minutes and guild-scoped workers run approximately every five seconds. See ATLAS_COMPATIBILITY.md for exact bot RPCs, service-role security, browser limitations and unchanged Skyrim protocol.

## Native Wayfinder command restoration

Native slash arguments now supersede the mandatory dashboard-first plan. Optional feature panels remain shortcuts; original meaningful forms, access panels and ballots remain. Setup selection reviews use one Confirm & Next transition and paired rank inputs. New persistence is in migrations 013–014; rebuild, reviewed migration application, command registration and restart are required. See [command guide](docs/COMMANDS.md), [parity inventory](docs/WAYFINDER_COMMAND_PARITY.md), and [implementation report](docs/WAYFINDER_RESTORATION_REPORT.md). Compatibility gaps are explicit; this is not a claim of full original Alliance or historical Discord-message import parity.
