# Wayfinder command restoration and parity audit

This inventory distinguishes restored execution from deliberate generalization and remaining compatibility gaps. Builder coverage alone is not a COMPLETE claim. Native slash inputs supersede the earlier mandatory dashboard-first plan; optional shortcuts remain.

## Source and method

Read-only source: `C:/Users/elija/OneDrive/Desktop/keizaal-wayfinder-reference`, `lcbmann/keizaal-wayfinder`, revision `1bf76065ffa323838bd71c4657dced65a4923415`. `scripts/audit-wayfinder.cjs` statically inspects command builders and helper functions without importing or executing the reference bot. `test/fixtures/wayfinder-command-contracts.json` preserves original ordered option metadata, constraints, source expressions and service references. Dynamic choice expressions are recorded, not mistaken for resolved values. Public reference/contact classification constants were inspected separately. No operational configuration, database or environment data was imported.

`test/nativeContracts.test.ts` compares every retained source command/subcommand and ordered input name/type/required flag, with explicit exceptions for fixed duties, assignment naming, application routing and Alliance. Supply has its own exact eleven-option check. These are contract tests; behavioral evidence below is separate.

## Behavior and exceptions

### /alliance

PARTIAL compatibility: current reciprocal authenticated bridges remain. Native setup requires remote identity/protocol; group editing retains its existing specialized editor. Original same-server role/HQ group provisioning has no safe one-to-one mapping to reciprocal remote grants. No grants are inferred from a legacy local role. Original group metadata/options and local HQ creation still need a separate migration/design. Existing expected command names remain registered.

Source: `src/commands/alliance.ts`; services: `src/services/allianceIntelService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| setup |  |
| sync |  |
| status |  |
| group-add | `key` (string, required, max length 40); `order` (string, required, max length 80); `role` (role, required); `headquarters` (string, required, max length 80); `hold` (string, required, max length 80); `description` (string, required, max length 1000); `topics` (string, required, max length 500); `submit_emoji` (string, optional, max length 20) |
| group-topics | `key` (string, required, max length 40); `topics` (string, required, max length 500) |
| group-remove | `key` (string, required, max length 40) |
| headquarters-remove | `key` (string, required, max length 40) |

### /application

Native configured position opens the existing application form; own withdrawal/list use persisted applications; setup binds one private Advisors review channel. Fixed source positions and two fixed leadership channels become configurable duties and one private destination.

Source: `src/commands/application.ts`; services: `src/services/applicationService.ts`, `src/services/applicationFormService.ts`, `src/services/rangerService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| apply | `position` (string, required) |
| withdraw | `application` (string, required, autocomplete) |
| list |  |
| setup | `marshal_channel` (channel, required); `captain_channel` (channel, required) |

### /apprenticeship

Alias of mentorship. Native preferences, proposal, sponsor, assignment, end, info and requests write current mentorship records. Recipient accepts/declines using guild controls; durable DM notification and notice board remain. Distinct active members and cycle prevention remain. Current actor is proposer/mentor, rather than inferring a fixed Ranger rank. Existing staff assignment/requests thresholds remain.

Source: `src/commands/apprenticeship.ts`; services: `src/services/apprenticeshipService.ts`, `src/services/assignmentBoardService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| looking-for | `type` (string, required); `note` (string, optional, max length 1500) |
| withdraw-looking |  |
| propose | `member` (user, required) |
| sponsor | `recruit` (user, required); `reason` (string, required, max length 2000) |
| assign | `mentor` (user, required); `apprentice` (user, required) |
| end | `member` (user, optional); `reason` (string, optional, max length 1000) |
| info | `member` (user, optional) |
| requests |  |

### /assignment

Native create preserves a five-field assignment form, configured minimum rank and assignment. Forum setup persists a Forum resource override. Public Sign On/Withdraw/Complete controls call current service; rank graph checks guard sign-on. Existing compatibility list/claim/close/cancel and member-assignment operations remain.

Source: `src/commands/assignment.ts`; services: `src/services/managedAssignmentService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| setup | `forum` (channel, required) |
| create | `minimum_rank` (string, optional); `hold` (string, optional) |

### /atlas

Original no-argument link workflow retained by current Atlas handler; unlink/status and current authenticated identity/session recovery remain. Atlas toggle applies. No external Atlas login was performed.

Source: `src/commands/atlas.ts`; services: `src/services/atlasTrailmarkAccessService.ts`, `src/services/atlasDiscordProfileService.ts`, `src/services/medalService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| link |  |

### /briefing

Native channel setup posts Check My Briefing. Audience/recipient/kind open the two-field dispatch form; private collection applies fresh permission tiers and read receipts. DM settings persist per member. DM failure falls back to a private attachment. Collect in batches of 25. Original audience values map to BASELINE/LEVEL_1/LEVEL_3/LEVEL_4; current Briefing access remains LEVEL_1.

Source: `src/commands/briefing.ts`; services: `src/services/briefingService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| setup | `channel` (channel, required) |
| send | `audience` (string, required); `recipient` (user, optional); `kind` (string, optional) |
| settings | `dm_enabled` (boolean, required) |

### /contact

Native create/edit/list/group membership/archive use Contacts with additive detail metadata; individual and group Forum threads recover through durable delivery. Names, descriptions, classifications and priority persist. Current Advisors-only policy is retained, even though original creation allowed lower ranks. Assessment buttons persist and audit Confirmed/Cold/Not found/MIA/Archive-proposed (with group wording); proposing archive does not archive automatically. Complete original Forum tags are not restored.

Source: `src/commands/contact.ts`; services: `src/services/contactService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| setup | `category` (channel, optional) |
| create | `name` (string, required, max length 100); `race` (string, required, max length 100); `sex` (string, required, max length 100); `occupation` (string, required, max length 100); `hold` (string, required); `faction` (string, optional, max length 150); `usual_locations` (string, optional, max length 500); `commentary` (string, optional, max length 1500); `high_priority` (boolean, optional) |
| create-group | `name` (string, required, max length 100); `category` (string, required); `hold` (string, required); `estimated_size` (string, optional, max length 200); `identifying_features` (string, optional, max length 700); `weapons_capabilities` (string, optional, max length 700); `tactics` (string, optional, max length 700); `usual_locations` (string, optional, max length 500); `faction` (string, optional, max length 150); `commentary` (string, optional, max length 1500); `high_priority` (boolean, optional) |
| edit | `contact` (string, required, autocomplete); `name` (string, optional, max length 100); `race` (string, optional, max length 100); `sex` (string, optional, max length 100); `occupation` (string, optional, max length 100); `hold` (string, optional); `faction` (string, optional, max length 150); `usual_locations` (string, optional, max length 500); `commentary` (string, optional, max length 1500); `group_category` (string, optional); `estimated_size` (string, optional, max length 200); `identifying_features` (string, optional, max length 700); `weapons_capabilities` (string, optional, max length 700); `tactics` (string, optional, max length 700); `high_priority` (boolean, optional) |
| list | `type` (string, optional); `hold` (string, optional); `occupation` (string, optional, max length 100); `group_category` (string, optional); `high_priority` (boolean, optional) |
| link-member | `group` (string, required, autocomplete); `person` (string, required, autocomplete) |
| unlink-member | `group` (string, required, autocomplete); `person` (string, required, autocomplete) |
| archive | `contact` (string, required, autocomplete); `reason` (string, optional, max length 500) |

### /duty

Native configured duty resolves to a managed role; real member change and Discord role synchronization retain audit/rollback behavior. Lists show configured duty holders. Remove reason is audited. Fixed Warden/Range/specialty substructure is deliberately replaced by configured duties/assignment groups. Duty setup directs to the final-confirmed server setup role workflow.

Source: `src/commands/duty.ts`; services: `src/services/dutyService.ts`, `src/services/assignmentBoardService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| assign | `member` (user, required); `duty` (string, required); `warden_position` (string, optional); `hold` (string, optional); `range_or_specialty` (string, optional, max length 200) |
| remove | `member` (user, required); `duty` (string, required); `warden_position` (string, optional); `hold` (string, optional); `range` (string, optional, max length 200); `reason` (string, optional, max length 500) |
| list | `duty` (string, optional) |
| setup |  |

### /funds

Native integer amounts, optional attribution, history member filter, note defaults and monthly parameters reach the persisted ledger. Actor and credited/paid member remain separate; deposit/spend interaction IDs deduplicate. Current LEVEL_2 mutation policy and destructive confirmations remain. Current corrective set-balance/undo semantics are preserved.

Source: `src/commands/funds.ts`; services: `src/services/corpsFundService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| deposit | `member` (user, required); `amount` (integer, required, min 1); `note` (string, optional) |
| spend | `amount` (integer, required, min 1); `note` (string, required); `paid_to` (user, optional) |
| set-balance | `amount` (integer, required, min 0); `note` (string, optional) |
| refresh-summary |  |
| balance |  |
| history | `member` (user, optional) |
| undo-last |  |
| monthly | `year` (integer, required, min 2020); `month` (integer, required, min 1, max 12) |

### /intel

Topic and catch-all native arguments bind real destinations; keyword append defaults true. Topic refresh reads persisted delivered reports. Repair-reporters edits owned delivered messages in place. Backfill honors topic/date/mode/per-Trailmark limits over persisted reports. PARTIAL historical compatibility: it does not parse/import unrecognized old Discord reports or old Forum threads; native historical-delivery mode explicitly moves selected stored reports to HQ. Scan cap 5,000 records is reported. Existing confidentiality and authenticated outbound bridge controls remain.

Source: `src/commands/intel.ts`; services: `src/services/intelService.ts`, `src/services/trailmarkService.ts`, `src/services/allianceIntelService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| set-hq | `trailmark` (string, required, autocomplete) |
| topic-add | `name` (string, required, max length 80); `keywords` (string, required, max length 500); `channel` (channel, optional) |
| topic-edit | `topic` (string, required, autocomplete); `keywords` (string, required, max length 500); `append` (boolean, optional) |
| topic-list |  |
| catchall-set | `topic` (string, optional, autocomplete); `name` (string, optional, max length 80); `channel` (channel, optional) |
| catchall-clear |  |
| refresh | `topic` (string, required, autocomplete) |
| repair-reporters | `topic` (string, optional, autocomplete) |
| backfill | `topic` (string, optional, autocomplete); `mode` (string, optional); `after` (string, optional); `limit_per_trailmark` (integer, optional, min 1, max 5000) |

### /patrol

Native configured assignment defaults to the first persisted member assignment. Eligible active Trailmarks are ranked by recorded visits including configured shared activity, then rotated per member among older locations. A suggestion is not a managed assignment. This uses the generalized assignment model, not fixed Skyrim Holds; no assignment falls back to the eligible server pool. Maximum 500 locations.

Source: `src/commands/patrol.ts`; services: `src/services/patrolSuggestionService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| suggest | `hold` (string, optional) |

### /ping

Direct ephemeral readiness response; no dashboard.

Source: `src/commands/ping.ts`; services: .

| Original subcommand | Ordered original options |
| --- | --- |

### /promotion

Alias of advancement. Native setup preserves current ballot settings and binds the private advancement channel. Status persists field-trial/hold markers; eligibility follows configured rank edges. Native open deduplicates, stores reason/role mentions, posts public Yes/No/Abstain ballot and discussion. Close/approve/deny use existing durable decision/role-change service and refresh the board. Current snapshotted voter permissions, minimum affirmative majority, one ballot per voter and separate close-before-approve rules are preserved; no automatic promotion from a legacy majority.

Source: `src/commands/promotion.ts`; services: `src/services/promotionService.ts`, `src/services/rangerService.ts`, `src/services/assignmentBoardService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| setup | `channel` (channel, required) |
| eligible |  |
| status | `candidate` (user, required); `progress` (string, required) |
| open | `candidate` (user, required); `target_rank` (string, optional); `reason` (string, optional); `mentions` (role, optional); `mentions_2` (role, optional); `mentions_3` (role, optional); `mentions_4` (role, optional); `mentions_5` (role, optional) |
| close | `vote` (string, required, autocomplete) |
| approve | `vote` (string, required, autocomplete) |
| deny | `vote` (string, required, autocomplete) |
| ballots | `vote` (string, required, autocomplete) |

### /ranger

Renamed to the configured guild root. Native user/rank/reason inputs reach current administration. Info defaults to actor; audit compares configured roles; assignments refreshes roster board; inactive review uses tracked activity; join-history reads at most 5,000 system join messages. set/clear/sync assignment replace fixed Hold appointments. Current Advisors-only member administration remains; rank correction remains Administrator-only. Authored notes are append-only: append:false is explicitly rejected, not silently ignored. Status choices remain ACTIVE/INACTIVE/RETIRED/LEFT; legacy On Leave is not silently remapped. Sync uses existing managed roles; role creation stays in confirmed setup.

Source: `src/commands/ranger.ts`; services: `src/services/rangerService.ts`, `src/services/holdRoleService.ts`, `src/services/assignmentBoardService.ts`, `src/services/dutyService.ts`, `src/services/fieldNameService.ts`, `src/services/atlasDiscordProfileService.ts`, `src/services/medalService.ts`, `src/services/promotionService.ts`, `src/services/briefingService.ts`, `src/services/runecloakService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| info | `user` (user, optional) |
| briefing |  |
| assignments |  |
| audit |  |
| inactive-review | `days` (integer, optional, min 1, max 365) |
| sync-member | `user` (user, optional) |
| sync-all |  |
| sync-join-history | `channel` (channel, required) |
| status | `user` (user, required); `status` (string, required) |
| retire-left | `discord_user_id` (string, required, max length 20) |
| clear-hold | `discord_user_id` (string, required, max length 20) |
| set-hold | `user` (user, required); `hold` (string, required) |
| sync-hold-roles |  |
| note | `user` (user, required); `note` (string, required); `append` (boolean, optional) |
| promote | `user` (user, required); `rank` (string, required); `reason` (string, optional) |

### /recruit

Native no-argument invite defaults to actor. Invite is unique, single-use, expires after 24 hours; an uncertain creation receipt blocks blind duplicate creation. Welcome sends the generalized onboarding checklist privately and deduplicates. Current Advisors requirement remains.

Source: `src/commands/recruit.ts`; services: .

| Original subcommand | Ordered original options |
| --- | --- |
| invite |  |
| welcome | `user` (user, required) |

### /reference

Native metadata opens the original five-field source form. Exact text, source attribution, links and handling labels persist in a private immutable archive separate from older shared reference entries. Advisors access; Leader label is checked again at form submission and view. Embedded URL credentials are rejected. Superseding preserves the earlier record. Generic reference compatibility entries remain separate.

Source: `src/commands/reference.ts`; services: `src/services/referenceService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| add | `title` (string, required, max length 150); `category` (string, required); `source-url` (string, required, max length 2000); `authority` (string, optional); `context` (string, optional); `confidentiality` (string, optional); `posted-at` (string, optional); `attachment-links` (string, optional, max length 2000); `supersedes` (string, optional) |
| view | `id` (string, required) |

### /roster

Native export uses persisted generalized ranks/duties/assignments and CSV escaping. Existing staff policy and compatibility administration actions remain.

Source: `src/commands/roster.ts`; services: `src/services/rosterExportService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| export |  |

### /strongbox

Native message plus optional attachment immediately persists a private submission, publishes to restricted HQ Strongbox and a content-free receipt at the drop. Full 4,000-character message plus attachment URL is retained; oversized Discord bodies include a text attachment. Original form-based compatibility submit/history remain.

Source: `src/commands/strongbox.ts`; services: `src/services/strongboxService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| drop | `message` (string, required, max length 4000); `attachment` (attachment, optional) |
| setup |  |

### /supply

New item-based transactional orders persist quotas, item contributions, actor/recipient, client pricing, payout rates, automatic completion, undo, redistribution and audit receipts. Real native autocomplete is guild/feature/permission scoped. Public boards use durable summaries; saved operations survive board failure. Original four-item log is atomic. Historical scalar campaigns stay intact and separate; no invented item/pricing conversion.

Source: `src/commands/supply.ts`; services: `src/services/supplyAssignmentService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| create | `name` (string, required, max length 100); `client` (string, required, max length 100); `sale_price` (number, required, min 0); `ranger_rate` (number, required, min 0); `item_1` (string, required, max length 100); `quota_1` (integer, required, min 1); `item_2` (string, optional, max length 100); `quota_2` (integer, optional, min 1); `item_3` (string, optional, max length 100); `quota_3` (integer, optional, min 1); `item_4` (string, optional, max length 100); `quota_4` (integer, optional, min 1); `organizer` (user, optional); `notes` (string, optional, max length 1000) |
| log | `assignment` (string, required, autocomplete); `item` (string, required, autocomplete); `quantity` (integer, required, min 1); `item_2` (string, optional, autocomplete); `quantity_2` (integer, optional, min 1); `item_3` (string, optional, autocomplete); `quantity_3` (integer, optional, min 1); `item_4` (string, optional, autocomplete); `quantity_4` (integer, optional, min 1); `member` (user, optional); `note` (string, optional, max length 500) |
| undo-last | `assignment` (string, required, autocomplete); `member` (user, optional) |
| redistribute | `assignment` (string, required, autocomplete); `source_id` (string, required, max length 30); `before` (string, required, max length 40); `method` (string, required); `reason` (string, optional, max length 500) |
| status | `assignment` (string, required, autocomplete) |
| contributors | `assignment` (string, required, autocomplete) |
| refresh | `assignment` (string, required, autocomplete) |
| close | `assignment` (string, required, autocomplete) |
| reopen | `assignment` (string, required, autocomplete) |
| cancel | `assignment` (string, required, autocomplete) |

### /trailmark

Original access panel, native create/edit/set-atlas and General/Incident five-field report forms retained. Pinned ordering, access pagination, metadata, contacts and participants persist. Fresh eligibility/session/channel checks apply. Guild-scoped temporary access and disabled-feature cleanup remain. Report transport keeps current HQ/classification boundaries, not legacy unsafe forwarding. Native report local-post recovery is conservative after an uncertain Discord result.

Source: `src/commands/trailmark.ts`; services: `src/services/trailmarkService.ts`, `src/services/contactService.ts`, `src/services/structuredTrailmarkReportService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| panel |  |
| leave |  |
| list |  |
| sessions |  |
| report | `type` (string, required); `contact` (string, optional, autocomplete); `contact_2` (string, optional, autocomplete); `contact_3` (string, optional, autocomplete); `participant` (user, optional); `participant_2` (user, optional); `participant_3` (user, optional) |
| create | `name` (string, required); `hold` (string, required); `location_description` (string, required); `screenshot` (attachment, optional); `atlas_location_id` (string, optional) |
| edit | `trailmark` (string, required, autocomplete); `name` (string, optional); `hold` (string, optional); `location_description` (string, optional, max length 4000); `screenshot` (attachment, optional); `clear_screenshot` (boolean, optional); `atlas_location_id` (string, optional); `clear_atlas` (boolean, optional); `pinned` (boolean, optional); `patrol_primary` (string, optional, autocomplete); `clear_patrol_primary` (boolean, optional) |
| deactivate | `trailmark` (string, required, autocomplete) |
| set-atlas | `trailmark` (string, required, autocomplete); `atlas_location_id` (string, required) |
| clear-atlas | `trailmark` (string, required, autocomplete) |

### /vote

Native binary question opens a persisted Yes/No/Abstain ballot; choice format uses a meaningful multiple-choice form. Public select controls enforce snapshotted voter authorization. Native close/audit use the actual record and original channel. Current duplicate-vote and staff-only audit policies remain. General votes create a discussion thread from their ballot message.

Source: `src/commands/vote.ts`; services: `src/services/generalVoteService.ts`.

| Original subcommand | Ordered original options |
| --- | --- |
| open | `format` (string, optional); `question` (string, optional, max length 300); `context` (string, optional, max length 1000) |
| close | `vote` (string, required, autocomplete) |
| audit | `vote` (string, required, autocomplete) |

## Verification boundaries

The regression suite exercises real repositories and the full PGlite SQL chain, with fake Discord at the network boundary. Dedicated Supply tests cover four-item writes, retry idempotence, actor/recipient authorization, malformed pairs, duplicate/foreign items, quotas, completion, undo, redistribution, disabled autocomplete and failed board delivery. Native workflow tests cover source contracts, SQL forms/ownership, private dispatch audiences/read receipts, proposal acceptance, promotion receipts/abstention, contact profile persistence, vote/assignment writes, private reference authorization, populated upgrades and the Discord event queue. Existing phase tests continue to cover administration, votes, applications, bridge confidentiality, Atlas and recovery. This is not exhaustive live interaction parity for every retained system.

The source-local Alliance group model, old unrecognized historical report parsing, complete original Contact Forum tags remain explicit gaps. They must not be presented as restored production parity. Staging acceptance is required for Discord layout, native autocomplete, channel permissions, DM failures and command propagation.
