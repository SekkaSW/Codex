# Atlas and Skyrim compatibility boundary

Codex does not modify Codex-Atlas or the Skyrim integration. Its responsibility is the bot/database side of two independent paths:

1. **Browser Atlas ↔ Supabase ↔ Codex.** Supabase preserves compatibility RPC names for Discord linking, identity/profile, Trailmark access and visits, departure/heartbeat, Field Drops, live positions, presence, calibration, settlements, and shares. Codex link codes require Trailmark eligibility and expire after ten minutes. Service-role polling claims access requests and Field Drops every five seconds only for guilds with Atlas enabled. Every queue record carries a guild ID. Medal data is not a Codex organization feature and may only be omitted or handled by a legacy profile adapter.
2. **Browser Atlas ↔ Skyrim local bridge.** The existing SKSE plugin remains at `http://127.0.0.1:38471`. Preserve `GET /position`, `GET /events`, `GET /markers`, `POST /markers`, `GET /field-state`, and `POST /field-state`. Live position, native markers, and field state/events must not be routed through or replaced by the Discord bot.

## Hosted-origin constraint

The existing local bridge accepts `https://lcbmann.github.io` plus localhost and `127.0.0.1` browser origins. An initial Codex-Atlas deployment must either use an already accepted origin, or the future renamed Skyrim mod must receive the minimal change of adding the new hosted origin to its allowlist. This constraint does **not** justify redesigning the local HTTP protocol.

## Security and compatibility

Atlas browser RPC permissions require a separate security review. Queue-claim and completion RPCs are service-role-only. Organization/guild scope should be added as compatible optional arguments or resolved from existing link identity; avoid removing legacy signatures until Codex-Atlas has migrated. The bot deliberately uses the known RPC boundary names rather than embedding Atlas tables into command code.
