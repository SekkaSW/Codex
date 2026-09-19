# Wayfinder restoration implementation report

## Scope and source

Started from clean `main` at `2b0fd649bf1d1ca523b4c6b969c7f1c70b476a9d`; implementation branch is `wayfinder-command-ux-restoration`. Main was not changed. Setup checkpoint: `7e540cc37a6e578cb4eb313a2a7876375d57aa4c` (`Fix setup selection reviews and paired rank inputs`). Subsequent local implementation/audit commits are recorded by Git and in the final delivery message.

Read-only original source: `C:/Users/elija/OneDrive/Desktop/keizaal-wayfinder-reference`, `lcbmann/keizaal-wayfinder`, revision `1bf76065ffa323838bd71c4657dced65a4923415`. The source-derived fixture inventories all 21 retained command systems and their original ordered inputs, constraints and referenced services. See [full parity inventory](WAYFINDER_COMMAND_PARITY.md), [native command guide](COMMANDS.md), and [setup investigation](SETUP_CONFIRMATION_FIXES.md).

## Setup outcome

Selection questions now use Select → Review → Confirm & Next → next distinct question. Permission confirmations replace exactly the selected level’s roles; conflicting mappings require correction rather than silent movement. Explicit No Roles is supported. New ranks have separate unanswered role/tier inputs; both orders and rapid paired events work. One selection edits the current question in place; both produce one combined review. Revision aliases are scoped to the same unfinished rank, then invalidated. Progression and Optional Features each advance after one confirmation. Back/resume retain their intended boundaries. Final Confirm Setup still controls production writes and role provisioning.

Before: choose Recruit roles → re-rendered question/extra continuation. After: choose Recruit roles → review → Confirm & Next → Member roles. Rank example: choose tier → same rank, role unanswered → choose role → combined review → Confirm & Next → next rank, both unanswered.

The text “Send order or /order.” was helper copy; no supplied live error/payload established a separate namespace failure. Real message-routing tests accept `order`, `/order`, and surrounding whitespace and reject invalid/reserved names without advancement. Exact historical live failure remains unverified. Six-section setup, owner/channel checks, private conversation boundaries, cancellation and final production confirmation remain.

## Native commands and workflow evidence

Normal commands accept native Discord inputs without a mandatory generic argument wizard. Meaningful applications, dispatches, reports, private source forms, ballots and temporary-access panels remain. Optional compatibility panels are still available, with feature/permission-aware help.

Supply now has a separate item-based transactional model. `/supply log` exposes exactly eleven original ordered options: assignment, item, quantity, item_2, quantity_2, item_3, quantity_3, item_4, quantity_4, member, note. Four-item input validates completely before an atomic write; quotas, actor/recipient separation, target-member authorization, completion, undo, weighted/even redistribution, payout credit and audit receipts persist. Autocomplete resolves the selected order and each item slot in the current guild. Tests exercise the production handler and real SQL, including board failure after a saved operation. Historical scalar campaigns remain intact; no item/pricing conversion is invented.

New real persistence also covers structured profile/Trailmark metadata, private source references, promotion progress and abstention, durable forms/invite claims, dispatch audiences/preferences/read receipts, and mentorship proposal response. Public vote/assignment/promotion controls call current services. Promotion and general votes create discussion threads. Forum assignment setup persists the resource type for repair. Contact assessment controls record and audit assessments; archive proposals require a separate archive decision. Full message bodies that exceed an embed are available as text attachments.

Promotion/apprenticeship aliases coexist with advancement/mentorship. The configured organization root is guild-specific. Configured ranks, duties and assignments replace fixed Ranger ranks, positions and Holds. Current Codex authorization remains: Funds mutations Officer; member/Contact/recruitment administration Advisors; promotion setup Administrator; Briefing access Member; private references Advisors with Leader-only labels enforced again on submit/view. Snapshotted ballot permissions, close-before-approve, majority thresholds, audit history and recovery protections remain.

## Explicit compatibility gaps

This is not a claim of complete original behavior in every system:

- Original Alliance groups provisioned local role/HQ sections. Current Codex bridges require reciprocal remote identity/protocol authorization. Those local grants and metadata are not automatically interpreted as remote authority; the original local group provisioning/options need a separately specified bridge-compatible model. Existing Alliance command names and current authenticated bridge operations remain.
- Historical Intel backfill handles persisted reports and the selected topic/date/mode/per-Trailmark bound. It does not import unrecognized legacy Discord messages or old Forum threads without a validated parser. The 5,000-record bound is explicit.
- Original Contact Forum tag automation is not fully reproduced. Profile fields, group membership, assessment controls, archive behavior and real Forum records are retained.
- Authored member notes remain append-only; `append:false` is rejected explicitly. Membership status uses current ACTIVE/INACTIVE/RETIRED/LEFT choices; legacy On Leave is not silently mapped. Fixed Warden/Hold role-creation structures use confirmed configurable setup.
- Patrol uses configured assignments and current recorded sessions, with bounded location scanning and per-process rotation; it does not replicate fixed geography or persist a fabricated assignment.

These exceptions and command-by-command behavior are detailed in the parity inventory. No command is marked COMPLETE solely because its builder exists.

## Migrations and local verification

Additive canonical files: `013_native_supply_workflows.sql`, `014_native_workflow_contracts.sql`. Deployment mirrors: `20260919144046_native_supply_workflows.sql`, `20260919145259_native_workflow_contracts.sql`. Earlier 001–012 files were not changed. New tables enable RLS and revoke public/anon/authenticated access; RPCs use service-role grants. Tests cover fresh full-chain installation and populated legacy Supply/dispatch/reference upgrades. PGlite is a local PostgreSQL-compatible test boundary, not a hosted Supabase or live Discord test.

Final local results: `npm test` — 240 passed, 0 failed; `npm run lint` — passed; `npm run build` — passed; `git diff --check` — passed. Migration mirrors are checked by the suite.

Verification includes the full test suite, TypeScript lint/build, migration mirror checks, whitespace review, source contract comparison, and a changed-file scan for environment/build/archive/key files, private-key blocks, GitHub/AWS/JWT tokens and assigned credential literals. No secret or operational Ranger data was found in intended changes. Existing ignored environment/dependency/build output remains uncommitted. Test artifacts are synthetic.

A final compatibility regression verifies that individual Briefings cannot leak through the old history selector or be publicly republished. A Discord event-boundary regression verifies that both rapid rank selectors are acknowledged before queued processing. Meaningful runtime/SQL tests are stronger evidence than route-only assertions, but cannot certify all live workflows.

## Rollout and live acceptance

After review/merge by the user, apply only pending migrations using the established process, rebuild, upsert global core definitions, upsert each affected guild’s configured organization root, and restart. The registration script rejects incomplete scope/namespace configuration and never bulk-replaces unrelated guild commands. Old guild-local core definitions can shadow globals; inspect them explicitly. Nothing was registered, deployed, restarted, or applied to a hosted database during this task.

Staging checklist:

1. Start `/server setup` in the intended private test conversation.
2. Enter a group name, then `order` or `/order`.
3. Select Recruit roles; verify a review rather than the same question.
4. Confirm once; reach Member. Repeat all five levels, including No Roles and a conflict.
5. Configure three ranks, selecting role/tier in both orders and rapidly.
6. Verify partial input stays in place, one paired review appears, and one confirmation advances to the correct rank with saved values.
7. Exercise branching progression and explicit endpoints, one confirmation per source.
8. Confirm Optional Features once and reach Channels.
9. Cancel or finish deliberately; no production changes before final confirmation.
10. In a Supply-enabled test guild, verify all eleven `/supply log` options and all item autocomplete slots.
11. Submit one- and four-item contributions; verify totals, audit, attribution, quotas, payout and board updates without a dashboard detour.
12. Exercise representative applications, Strongbox, Funds, Contacts/assessments, Intel, Trailmarks/reports, votes, assignments, mentorship, promotion, Briefings, Patrol, Atlas, member commands and current Alliance bridges. Include denied permissions, disabled features, stale controls, DM failure and board recovery.

No reference repository modifications, hosted database changes, live Discord actions, push, merge or deployment occurred. Final Git SHA and working-tree status are provided with delivery.
