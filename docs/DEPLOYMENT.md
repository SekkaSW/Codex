# Deployment and operations

## Supabase

Apply `migrations/001_codex_core.sql` and `002_production_features.sql` in order. The normalized configuration remains authoritative; the second migration adds member, Trailmark, Intel, Contact, finance, workflow, bridge, and Atlas queue data. Sensitive production tables have RLS enabled without permissive public policies. Codex must use `SUPABASE_SERVICE_ROLE_KEY` only on the server. Browser-facing Atlas access belongs behind separately audited `SECURITY DEFINER` RPCs—never expose the service key.

The repository adapter performs real table upserts/selects and invokes the compatibility RPC names for link codes, access requests, and Field Drops. Deployments must install compatible RPC implementations with restricted execute grants. Queue claims must be atomic in production.

## Discord

Set `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`, build, and run `npm start`. Enable Guilds, Guild Members, Guild Messages, and Message Content intents. Invite Codex with application-command and Manage Channels/Roles permissions.

Run `npm run deploy:commands` to install global commands. During development, `DISCORD_GUILD_ID` installs them immediately in one guild. `ORGANIZATION_NAMESPACE` adds the configured organization-management namespace. Discord application commands are registered command trees rather than arbitrary runtime aliases, so a configuration change must trigger controlled guild-command synchronization with that guild's validated namespace.

Optional commands reject use when their module is disabled. Atlas poll work is selected per configured guild; there is no global guild ID in job processing. Briefing and Atlas resources are absent when disabled.

## Setup and repair

`/server setup` starts an administrator-only interaction. The wizard is split into identity, namespace, permissions, ranks, duties, assignments, modules, resources, destinations, integrations, preview, confirmation, and provisioning stages. Production UI expansion should use Discord role/channel selectors for their respective stages; values must be persisted before provisioning.

Repair resolves every managed resource by its stored Discord ID. Existing renamed or reordered resources are retained. Missing resources are recreated, their registry IDs are updated, and functional permission overwrites are restored. Repair never restores aesthetic names or positions.

## Operational checks

Run `npm test`, `npm run typecheck`, `npm run lint`, and `git diff --check`. Monitor failed interaction responses and background-job completion details. Encrypt bridge credentials before persistence and rotate both Discord and Supabase credentials through the hosting platform.
