# Command wording and UX audit — 2026-09-20

## Scope and evidence

Started in `C:\Users\elija\OneDrive\Desktop\SekkaSWCodex`, on clean `main` at `e977e2fcc6acc0288c9ed089a44cc8d49f3076d0`, remote `https://github.com/SekkaSW/Codex.git`. Work is on `command-copy-and-ux-audit`. No baseline work was discarded. No applicable AGENTS.md was found.

[Machine-readable inventory](COMMAND_WORDING_INVENTORY.json) records **25 command trees, 202 operations and 22 interaction families** from current definitions and routers. Aliases count separately; the synthetic configured root is `/organization`. Core registration alone has 24 trees. Each operation records its description, ordered inputs, implementation and routing/test evidence. This inventory describes the checked-out implementation, not an old operation count.

Review covered assembled registration descriptions/options/choices, source handlers, shared send/error/navigation helpers, autocomplete, retained forms and access controls, setup new/resume/edit/fallback rendering, public delivery/recovery and operator documentation. [Rendered transcript](COMMAND_WORDING_TRANSCRIPT.md) uses production renderers/handlers with synthetic repositories and Discord objects. It was read end to end. Local checks do not establish live Discord behavior.

The existing independent Wayfinder source-derived fixture and native contract suites were used. The original read-only Wayfinder checkout was not inspected again in this pass; this report makes no new claim of original-source equivalence. No reference repository, live Discord server, hosted database or service process was modified.

## Shared source changes versus registration changes

`src/runtime/userCopy.ts` supplies targeted command-name normalization and static labels. It does not transform user-authored names or stored data. `src/runtime/commandCopy.ts`, applied by `nativeDefinitions.ts`, changes registered display descriptions/choice labels only. Native identifiers, option order/types/constraints/autocomplete flags, values and default permissions remain intact. An existing configured-root description used by registration ownership detection is deliberately retained.

Runtime copy changes take effect after build and restart. Registration descriptions need a separate command-registration run. Neither action rewrites already-posted setup conversations; use Resume/Refresh to render current text against the saved draft. No migration was added or edited; current canonical latest is 014, with its existing timestamped deployment mirror.

## Setup question and minimal behavior correction

Every active command-name renderer uses:

> What do you want your command to be?
> For example: enter Order for /order.
> Send your answer here.

Before: `Send order or /order.` After: the question above, with current value separately displayed in edit mode and `Command set to /order in your setup draft.` after acceptance. The fallback previously rejected capitalized names even though the example implies acceptance.

`Order`, `order`, `/order`, ` Order ` and ` /Order ` normalize to stored `order`. Trimming, removing one leading slash and lowercasing precede existing length/character/reserved-name validation. Internal spaces and extra slashes remain invalid. Organization/rank/duty/Contact display names retain their case and content. Removing the old whole-render vocabulary replacement also prevents authored names such as `LEVEL_2 Study Group` from being rewritten.

Sources: `messageSetup.ts`, `setupRefinement.ts`, `setupConversation.ts`, `setupWizard.ts`, `setupSelections.ts`, all under `src/runtime/`. Production-route tests in `test/setupRefinement.test.ts` cover new, resumed, Back, invalid retry, edit and Detailed Editor paths; `test/setupMessage.test.ts` covers fallback variants. The full synthetic setup reaches final confirmation, checks that provisioning has not occurred before it, and exercises both paired-rank selector orders. Existing ownership, revision, expiry, rapid-input, public Reply binding and privacy tests remain in place.

## Family findings

Paths below are relative to the repository. All entries include both current native actions and retained compatibility operations listed individually in the inventory. No live UI review was performed for any family.

| Family / entry surfaces | Source and review finding, before → after | Verification / remaining live check |
|---|---|---|
| `/server setup`, all six sections, text messages, selectors, Detailed Editor, previews | Setup sources above: ambiguous command question → exact explanation; `Modules` → `Optional Features`; `managed resources` → `Channels & Categories`; internal tiers → human labels; duty/group/selection messages explicitly say draft. Removed duplicate progression wording and Atlas Review control. Confidential marker explains local visibility and blocked transfer. | `setupRefinement`, `setupMessage`, `ux`, `phase4` tests. Live fresh/resumed/edit draft, role hierarchy and final provisioning still require staging. |
| `/ping`, `/help`, optional panels | `bot.ts`, `panels.ts`: guide previously documented Administrator-only → actual accessible ping/help. Dashboard-first README → direct native slash commands with optional shortcuts. Disabled/no-action states and expiry recovery clarified. Boolean `No` string → actual false. Attachment shortcuts now direct to native input; autocomplete shortcuts explain saved ID versus native name search. | `audit`, `ux`, `commandWording` tests. Confirm visible client command picker and attachment chooser in staging. |
| Configured organization root, `/roster` | `nativeMembers.ts`, `handlers/members.ts`, `commandCopy.ts`: one-word descriptions → precise member targets/actions; rank/notes retain Administrator policy, audit copy explains staff access. Bulk failures use redacted friendly errors. User-authored notes remain intact. | `nativeContracts`, `phase4`, `ux`, `audit`; inspect a long synthetic member record in staging. |
| `/duty`, member assignments | `handlers/duty.ts`, `nativeMembers.ts`, `commandCopy.ts`: duty setup explains opening server setup; member assignment descriptions distinguish membership from board tasks. Long lists now attach full text instead of silently truncating. | `phase4`, `setupRefinement`, `commandWording`; staging role synchronization remains necessary. |
| `/promotion`, `/advancement`, promotion ballots | `nativePromotion.ts`, `handlers/field.ts`, `commandCopy.ts`: `Commander`/ambiguous setup → Discord Administrator; closing a ballot explicitly does not promote; binary vote buttons `Approve/Oppose` → `Vote Yes/Vote No`; destination labels `Promotions`. Native promotion vote values remain unchanged. | `phase5`, `nativeWorkflows`, `nativeContracts`, `audit`. Staging vote, close and separate approval. |
| `/trailmark`, access selectors, report form, access expiry | `nativeField.ts`, `trailmarkAccess.ts`, `handlers/field.ts`, `commandCopy.ts`: raw tier access options → human labels; saved record followed by channel failure → explicit saved state and `/trailmark repair`; saved report delivery failure says do not resubmit. Deactivation distinguishes saved state from pending cleanup. | `phase5`, `nativeContracts`, `nativeWorkflows`, `audit`. Live channel permissions, repair and delayed cleanup unverified. |
| `/intel`, report topics, delivery, reporter repair, backfill | `nativeIntelligence.ts`, `handlers/intelligence.ts`, `commandCopy.ts`: `Scan old Trailmark messages` → retry saved reports, no Discord history import; catch-all clear restores configured default; refresh rebuilds bulletin; reporter repair addresses recognized bot embeds. Per-Trailmark limit wording matches iteration. | `phase6`, `nativeContracts`, `commandWording`. Live bulletin/report delivery and recognized historical embeds need staging. |
| `/contact`, creation/group creation, forms, assessment buttons | `nativeIntelligence.ts`, `contactPermissions.ts`, `handlers/intelligence.ts`, `commandCopy.ts`: edit/link descriptions formerly Recruit+ → Advisors+; list explicitly includes archived records; repair explicitly individual threads. Member creation remains available and other administration remains restricted. | `contactPermissions`, `nativeContracts`, `phase6`. Non-Administrator Member creation and lower-tier rejection tested locally. Group repair/tag limitations remain below. |
| `/alliance` | `nativeIntelligence.ts`, `commandCopy.ts`: vague compatibility labels → named configuration/member/archive actions. Review preserves proposal versus archive distinction and recorded history; no added provisioning. | `phase6`, `nativeContracts`, `audit`. Historical provisioning parity remains unverified. |
| `/funds`, `/strongbox` | `handlers/funds.ts`, `nativeWorkflows.ts`, `commandCopy.ts`: Funds descriptions explicitly Advanced Member+, generic currency rather than hardcoded Septims; refresh updates configured summary rather than moving it. Strongbox instructions say Advisors. Ledger confirmation and receipt guards retained. | `contactPermissions`, `phase7`, `ux`, `production`; non-Administrator Advanced Member mutations and lower-tier rejection included in existing tests. Live summaries/attachment delivery unverified. |
| `/recruit`, `/application`, application forms | `handlers/workflows.ts`, `nativeWorkflows.ts`, `commandCopy.ts`: missing destination uses human label; onboarding asks Advisors to inspect existing record rather than telling recruit to invoke staff action; application list says own application. Saved form/board failure now distinguishes persistence from delivery. | `phase7`, `nativeWorkflows`, `nativeContracts`, `audit`. Staging applicant/staff visibility still required. |
| `/apprenticeship`, `/mentorship`, accept/decline forms | `nativeWorkflows.ts`, `handlers/workflows.ts`, `commandCopy.ts`, `panels.ts`: propose description names actor as mentor and selected member as recipient; assignment/sponsorship descriptions distinguish roles. Requests guide/panel now match existing Advisors handler gate. Saved response + board failure explicitly avoids resubmission. | `phase7`, `nativeWorkflows`, `ux`, `audit`. Native invitation/board refresh needs staging. |
| `/vote`, ballots, `/assignment` board tasks | `nativeWorkflows.ts`, `handlers/workflows.ts`, `commandCopy.ts`: assignment create description matches Advisors gate; member assignment versus task distinction. Saved vote/claim/close with board failure → recorded result, inspect existing record and avoid repeat mutation. | `commandWording` fault-injected production handlers assert exactly one mutation; `nativeWorkflows`, `phase7`. Existing native-board recovery limitation below. |
| `/briefing`, collection and dispatch forms | `nativeOptional.ts`, `handlers/optional.ts`, `commandCopy.ts`: audience values display human names; Recruit+ audience explicitly notes collection requires Member+; uncertain partial DM delivery → check existing DMs and use attached briefing. | `phase8`, `nativeContracts`, `nativeWorkflows`, `ux`. No new audience policy; live per-recipient deliveries remain unverified. |
| `/supply`, autocomplete, logs, boards | `nativeSupply.ts`, `nativeDefinitions.ts`, `commandCopy.ts`, `confirmation.ts`, `panels.ts`: dependent item/quantity/quota pairs explained; numeric limit 1–1,000,000,000 retained; refresh description/guide/shortcut match Advisors handler. All eleven log options remain ordered and direct. | `nativeSupply`, `nativeContracts`, `phase8`, `commandWording`, `ux`. Live board refresh and autocomplete picker check. |
| `/patrol` | `nativeOptional.ts`, `handlers/optional.ts`, `setupRefinement.ts`, `commandCopy.ts`: promise of persisted/older-first assignment → route suggestion, no saved assignment. Existing persisted compatibility assignments/list/resolve remain separate. | `commandWording`, `phase8`, `nativeContracts`. No new patrol engine; discrepancy recorded below. |
| `/reference` | `nativeWorkflows.ts`, `handlers/optional.ts`, `commandCopy.ts`, `panels.ts`: `marshal_plus` → Advisors+ display while preserving wire value; nested metadata prints readable JSON rather than `[object Object]`; add/view guide and shortcut match existing Advisors gate. Existing shared get/list authorization preserved. | `phase8`, `nativeWorkflows`, `nativeContracts`, `ux`. Staging page/attachment readability remains necessary. |
| `/atlas` | `handlers/bridge.ts`, `atlas.ts`, `commandCopy.ts`, setup sources: vague labels → link/status/health actions; setup says saved for final confirmation and status shows integration limitations. No invented units, contract expansion or cross-server confidentiality bypass. | `phase9`, `nativeContracts`, `audit`, `setupRefinement`. External Atlas contract compatibility is not verified by local rendering tests. |

## All reachable component families and shared states

The JSON inventory covers `setup`, `ux`, `uxform`, `uxbrowse`, `uxconfirm`, `member`, `field`, `intel`, `bridge`, `flow`, `optional`, and native contact-assessment, promotion, briefing-collect, briefing-form, access, access-page, trail-report, form, ballot, assignment and mentorship routes. `commandWording.test.ts` sends every family through the real router with controlled repository/authorization boundaries or verifies the actual safe expiry response. This is routing evidence, not a claim that every possible state is rendered by that test. Existing feature tests exercise successful actions, authorization and persistence separately.

Shared sources: `interactions.ts`, `browse.ts`, `confirmation.ts`, `bot.ts`, `panels.ts`. Before: Previous on an empty first page, Continue Search at the end of results, raw internal tier denial, silent truncation, and generic failure after a committed mutation. After: navigable empty/end states, human permission names, complete long-text attachment, and truthful saved-versus-delivered results. Logs now record handled interactions and bounded redacted failure categories/codes; they do not claim every handled interaction completed its operation or print raw payload exceptions. A logging failure explicitly refers to the operation response above.

These targeted mappings leave actual organization-defined rank names alone. Recruit, Member, Advanced Member, Advisors and Leader are permission labels only. Contact Member creation and Funds Advanced Member mutation checks were already implemented in baseline SQL/server paths and were preserved; no permission migration was needed.

## Verification and limits

Validation results are recorded below after the final run. The existing contract, migration mirror, SQL security, durability and native option suites remain part of `npm.cmd test`. Local database tests use the repository's local test harness, not a hosted database. Existing copy assertions changed only where intended UI wording changed. No functional regression tests were removed.

Unresolved or deliberately preserved boundaries:

- Setup's existing namespace validator accepts a digit/underscore first; registration's existing validator requires a leading letter. This pre-existing disagreement is recorded instead of silently changing the prompt's required preserved validation contract. The approved Order example passes both.
- Patrol native suggest rotates among eligible Trailmarks (up to six); it neither persists an assignment nor guarantees least-recent activity ordering. Compatibility persisted patrol records are separate. Copy no longer promises either missing behavior.
- Briefing can label a Recruit+ audience, but collection still requires Member+. The label now states the restriction; broadening authorization is outside this wording task.
- Native board delivery/refresh and older compatibility board paths do not all share recovery keys. Where no dedicated native recovery action exists, messages identify the saved record and ask Advisors to inspect its list/audit before recovering delivery; they do not promise an automatic repair or recommend a second submission.
- Contact repair covers individual threads, not a complete group-thread recovery workflow. Legacy Contact tag automation and Alliance provisioning equivalence are not established by this pass.
- Intel backfill processes persisted reports; it does not import arbitrary historical Discord messages. Reporter repair recognizes existing bot embeds only.
- Optional shortcut forms still accept saved IDs for autocomplete-backed fields; they now explain the native slash-command name-search alternative. Attachment actions open through native commands. Native slash inputs remain the preferred direct path.
- Atlas remote contracts/coordinate units and production integration availability remain unverified. Local confidential reports stay local and visible only according to actual channel/command permissions; the marker is not encryption.
- No live Discord visual, permissions, attachment, role-hierarchy, command cache, restart or delivery checks were performed. Synthetic payload tests cannot replace those checks or guarantee absence of future copy defects.

## Operator handover

See [exact rollout commands and staging checklist](DEPLOYMENT.md#wording-and-ux-rollout--2026-09-20). Build compiles sources; restarting the existing bot loads runtime text; registration changes command descriptions. This task ran build/tests only and did not restart or register. No schema change requires a migration. An installation behind existing migration 014 must follow its established migration procedure separately, not apply a wording migration.

Use a fresh or resumed draft, verify the exact question and `/order` draft confirmation, paired rank choices in both orders and one Confirm & Next, then cancel the test draft or complete only an authorized staging setup. Check native Supply's eleven inputs, Member Contact creation, Advanced Member Funds, lower-tier denial, disabled features, a saved-record delivery failure and a long/empty list. Resume/Refresh old prompts safely; do not reset configuration or bulk-edit conversation history.

## Final local validation and commit review

- `npm.cmd test`: **262 passed, 0 failed, 0 skipped** (baseline: 244). Includes native contract/ordered Supply input tests, Contact/Funds non-Administrator authorization, migrations/mirrors/security and setup selection/durability checks.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed.
- `git diff --check`: passed.
- Inventory is checked against current operation names, descriptions and ordered input descriptions; all 22 component families have real routing/expiry evidence.
- Reviewed 36 intended files: source, regression tests, current documentation, inventory and synthetic transcript. No inappropriate environment/build/archive paths or credential signatures were found. `dist`, `node_modules` and `.env` remain ignored and unstaged. Synthetic IDs and authored example text in the transcript are intentional.
- No blocked local checks. Live Discord, hosted database, remote Atlas and a fresh original-reference inspection were not performed; their verification gaps are listed above.
- One focused commit is intended: `Audit and correct Codex command wording and UX consistency`. The handover records its SHA after creation. `main` remains at the starting SHA; no push, merge or deployment is part of this pass.
