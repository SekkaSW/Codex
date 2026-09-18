# Architecture and Wayfinder migration

The legacy repository was unavailable in this environment, so no legacy repository was altered. Codex defines clean adapters rather than coupling Intel to transport details.

| Legacy concept | Codex concept |
|---|---|
| Ranger role constants | `permission_roles`, many roles per neutral tier |
| cumulative rank roles | explicit ranks plus `rank_progression` edges |
| Hold | administrator-defined assignment group |
| hard-coded duties | `duty_roles` referencing existing Discord roles |
| channel environment IDs | `managed_resources` scoped by guild |
| Ranger Alliance payload | legacy adapter to canonical `CodexReport` |
| `[CORPS ONLY]` | configurable local-only marker |

## Bridge compatibility

Native Codex transport uses a versioned `codex.report` JSON envelope. The inbound legacy adapter accepts the common `content`, `report`, or `body` text fields and normalizes timestamps. Exact wire compatibility cannot be guaranteed without access to the legacy source or captured payloads; add a narrowly scoped parser fixture when that protocol is available. Outbound dispatch must call `mayTransfer` before every adapter, so transport choice cannot bypass confidentiality.

## Atlas compatibility

Atlas remains an optional module and Trailmark identity/access remains the integration boundary. No map repository was changed. A future Codex-Atlas client should resolve guild resources and Trailmark metadata through a versioned API and must not depend on environment-configured channel IDs. Temporary linking codes should remain short-lived, single-use records; their storage is intentionally left to the deployment's authentication service.

## Scope retained for service migration

Existing feature services (roster, funds, strongbox, contacts, applications, mentorship, voting, recruitment, Trailmarks, and Intel) should consume these configuration interfaces as they are brought into the target. Removed feature families—medals, field names, and runecloak—have no schema or command registration here. The `reference` command, if recovered from legacy source, requires functional review rather than automatic deletion.
