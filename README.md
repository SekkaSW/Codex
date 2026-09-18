# Codex

Codex is a configuration-driven Discord framework for ESO roleplay organizations. It separates ranks, permission tiers, appointed duties, and arbitrary assignment dimensions rather than prescribing one organization's vocabulary.

## Installation

Use Node 22+, run `npm install`, apply SQL files in `migrations/` to PostgreSQL/Supabase, and configure `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Discord IDs belonging to a server are database configuration, not environment variables. See [deployment](docs/DEPLOYMENT.md) for command synchronization and security requirements.

## Server setup

`/server setup` is designed as a staged interaction: identity, permission-role mappings, rank branches and explicit progression edges, existing duty roles, assignment groups/entries, modules, resource choices, integrations, and a final preview. No Discord structure is changed before confirmation. Existing configurations offer View, Edit, Repair, and Cancel. Repair uses stored IDs, recreates only missing managed resources, updates their records, and restores functional permission overwrites without renaming or repositioning resources.

Discord cannot expose a different global command tree to each guild from one static registration. Deployments should synchronize the configured organization namespace as guild commands; stable generic commands (`/trailmark`, `/intel`, `/contact`, `/funds`, `/strongbox`, `/duty`, `/vote`) remain static.

## Organization model

Neutral permissions are hierarchical from `BASELINE` through `LEVEL_4`; any number of Discord roles can map to a tier. `ADMIN` uses Discord administrator authorization. Ranks and advancement are explicit graph edges grouped by branch. Duties are existing Discord roles and never implicit ranks. Assignment groups contain arbitrary administrator-defined entries and independently choose single/multiple and optional/required membership.

## Resources and modules

Every managed category/channel is recorded by guild and logical key. Dynamic Trailmark and report-topic records use owned keys. Briefings, patrols, supply, and Atlas are per-server switches: only Briefings adds `dispatch-desk`; only Atlas adds `atlas`; patrols need no channel; supply shares assignments.

Trailmarks retain private sessions, reports, HQ designation, and Atlas association at the service boundary. Intelligence always includes a catch-all, supports keyword topics, and keeps Contacts as a forum. Reports containing the server's case-insensitive confidentiality marker remain fully available locally but bridge dispatch must reject them.

## Reconfiguration

Duty roles, assignment groups/entries, topics, and module switches are independently editable. Codex never manages unrelated server resources and does not enforce layout after creation.

## Development and deployment

Run `npm test`, `npm run typecheck`, and `npm run lint`. Build with `npm run build`; deploy `dist/` with global secrets only. Setup requires Manage Channels/Roles and application-command scopes.

## Production implementation

The runtime uses Discord.js interactions, a Supabase service-role repository, ID-based resource repair, and multi-guild background-job boundaries. Production tables are added non-destructively by `002_production_features.sql`. Retained service behavior and known implementation limits are tracked in [the feature matrix](docs/FEATURE_MATRIX.md); Atlas and the unchanged Skyrim bridge boundary are documented separately in [Atlas compatibility](docs/ATLAS_COMPATIBILITY.md).
