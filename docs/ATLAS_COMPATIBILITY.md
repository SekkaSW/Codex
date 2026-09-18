# Atlas and Skyrim compatibility boundary

Codex implements bot-side Atlas linking, service-role queue RPCs, Discord access/drop processing, profile/presence synchronization, visits/heartbeats and live-position persistence. The companion and Skyrim repositories were not modified. These are locally tested production paths; deployed companion compatibility has not been verified.

## Implemented RPC contracts

Migration 010 preserves the names and parameter contracts actually used by the existing bot repository:

- create_atlas_discord_link_code(p_guild_id, p_discord_user_id, p_expires_at) returns the temporary code.
- claim_pending_atlas_trailmark_access_requests(p_guild_id) and claim_pending_atlas_trailmark_drops(p_guild_id) return bounded arrays with id, guildId, memberId, trailmarkId and optional payload.
- complete_atlas_trailmark_access_request(p_request_id, p_success, p_detail) and complete_atlas_trailmark_drop(p_drop_id, p_success, p_detail) finalize or retry a claim.

Additional service-only functions supplied by this repository:

- claim_atlas_discord_link(p_guild_id, p_atlas_user_id, p_code), get_atlas_discord_link(p_guild_id, p_discord_user_id), unlink_atlas_discord(p_guild_id, p_discord_user_id).
- request_atlas_trailmark_access(p_guild_id, p_atlas_user_id, p_trailmark_id, p_request_id).
- submit_atlas_trailmark_drop(p_guild_id, p_atlas_user_id, p_trailmark_id, p_drop_id, p_payload), where payload.body is bounded report text.
- get_atlas_trailmark_access_request(p_guild_id, p_discord_user_id, p_request_id) and get_atlas_trailmark_drop(p_guild_id, p_discord_user_id, p_drop_id).
- record_atlas_trailmark_visit(p_guild_id, p_discord_user_id, p_trailmark_id, p_session_id), touch_atlas_trailmark_visit(p_guild_id, p_discord_user_id, p_visit_id).
- upsert_atlas_live_position(p_guild_id, p_atlas_user_id, p_position), remove_atlas_live_position(p_guild_id, p_atlas_user_id), get_atlas_live_positions(p_guild_id). Position contains bounded numeric x/y/z; reads omit entries older than two minutes and return at most 100.

Profile/presence and queue-session binding use the internal codex_atlas RPC. No Medals dependency exists. Codes are hashed, single-use and ten-minute; queue claims have leases and bounded retries. Imported field drops retain their source through the report boundary. Active sessions govern Discord permissions and visits.

## Exact compatibility limitations

The starting repository contained declarations of several browser concepts but no executable implementations or verified deployed signatures for calibration, settlements, shares, browser identity claims or local-mod events. Those external contracts are not claimed complete and were not overwritten. A deployed database with additional same-name overloads requires signature comparison in staging before migration 010. Separate browser/mod changes, if needed to match the listed contracts, belong in Codex-Atlas and require separate authorization.

Every Atlas function here is service-role-only. A trusted authenticated service gateway must bind the caller to its account. No browser may hold the service key or self-assert another account. Direct browser Supabase integration therefore remains PARTIAL until its actual authentication contracts are reviewed against the companion.

## Unchanged local bridge

The browser/local-mod boundary remains 127.0.0.1:38471 with GET /position, GET /events, GET /markers, POST /markers, GET /field-state, POST /field-state and OPTIONS. The bot neither implements nor reroutes this protocol. Any hosted-origin allowlist change must be checked in the companion/mod project; this repository makes no live claim about a particular deployed origin allowlist.
