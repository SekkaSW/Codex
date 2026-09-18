# Discord UX completion report

Historical report for the dashboard overhaul. Setup text modals described below are superseded by [the message conversation correction](SETUP_MESSAGE_CORRECTION.md); feature-panel forms are unchanged.

This pass adds conversational setup and dashboard entry points to the completed Codex implementation. It preserves the production services, existing command operations, authorization, durable receipts, and recovery paths.

## Repository checkpoint

- Starting branch: `main`, clean.
- Starting HEAD: `f60994a05ec34a669ecd0c74bc2f249c2a5b8844` (`Add Supabase deployment configuration`).
- Remote: `https://github.com/SekkaSW/Codex.git`.
- Implementation branch: `discord-ux-overhaul`, created from that HEAD.
- Commit: `Improve Discord setup and interaction UX` (the commit containing this report; its resulting SHA is reported separately).
- No earlier work was discarded or repeated. No push, merge, command deployment, bot deployment, or production-data access was performed. `main` remains at the starting HEAD.

## Exact setup flow

1. Organization Name → single-field modal → named confirmation.
2. Command namespace → single-field modal → syntax/core-name validation and confirmation.
3. BASELINE, LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4 → native multi-role selectors. Each selection adds/reassigns roles to that tier; another selection adds more. Done advances. Clear this tier edits only the draft. Authorization and rank progression are explained separately.
4. Ranks → add or select an existing rank → name → Discord role → tier metadata → optional progression branch → Add Another/Done. Branch membership is represented by explicit edges in the existing model; selecting a branch never infers an edge.
5. Branches/progression → choose/create branch → source rank → one or more target ranks → add more targets, choose another source, or Done. Choices paginate. Self/dangling/cyclic progression is rejected; same-tier alternatives and branching remain valid.
6. Optional duties → native role picker → friendly display name → Add Another/Done. Duties stay independent of ranks.
7. Assignment groups → name → required/optional → multiple/single → synchronize roles yes/no → entry name → optional mapped role → Add Another/Done for entries and groups. Detailed maintenance of existing entries remains available in the Detailed Editor.
8. Modules → friendly multi-select for Briefings, Patrol, Supply and Atlas → confirmation of enabled choices.
9. Managed resources → command/log destinations, core, organization, intelligence, Trailmark and enabled-module resources. Each asks for an existing type-filtered channel/category/forum or creation at confirmation. Creation names can be customized. Existing IDs retain names/layout. Command/log creation preferences use the existing additional-resource storage. Duplicate destination bindings are rejected.
10. Confidentiality → accept `[CONFIDENTIAL]` or enter a custom marker → confirmation.
11. Atlas → explain the enabled/disabled state and current account-link/Trailmark contract. No browser credentials or undocumented integration setup are requested.
12. Review → bounded readable summary plus full text attachment → Back/Edit Section/Confirm Setup/Cancel. Only Confirm Setup saves production configuration and provisions resources.

Each accepted answer increments and saves the existing durable draft revision. Back revisits a question without undoing its saved answer. Skip is offered for optional sections/choices and preserves existing values. Cancel deletes the draft only. Start Over asks for confirmation and resets from the saved server configuration. Interrupted setup offers Resume, Start Over, View Progress and Cancel with draft age. Revision conflicts offer a fresh Resume button; ownership, Administrator permission, seven-day expiry and SQL revision checks remain enforced.

Existing guilds begin with Edit Server Configuration. Section questions reuse the conversational flow; View Saved, Repair and Detailed Editor remain available. Repair inspects stored IDs and functional permission overwrites before offering Repair Missing/Incorrect Items, View Details or Cancel. Confirmed repair uses the established recovery/provisioning implementation and does not cosmetically rename or move surviving resources.

## Dashboards, compatibility and authorization

There are 20 dashboards: Trailmark, Advancement, Application, Mentorship, Assignment, Intel, Contacts, Funds, Strongbox, Recruitment, Voting, Briefings, Supply, Patrol, Reference, Atlas, Roster, Duty, Alliance and the configured organization namespace. See [the command inventory](COMMANDS.md) for their action mappings.

`/help` discovers available features using fresh member roles, existing mappings and enabled modules. Member actions precede staff actions. Feature actions paginate ten per page; entity selectors remain bounded to 25 choices. Command arguments use native user/role/channel/choice selectors and one-field text/number modals, with optional Skip and a final Continue. These forms dispatch to the real production command handlers. Reference search and My Claimed Assignments inspect at most 250 records per interaction with navigation to later batches.

All 155 earlier registered operations remain. The update adds `/help` and 19 new `panel` subcommands; the existing `/trailmark panel` now opens its dashboard with Request Access leading to the original selector. Total registration is **23 trees / 175 operations**, including the organization namespace. The deploy script builds successfully; it was not executed against Discord. **Slash commands must be redeployed.**

Funds mutations retain LEVEL_2. Member/duty administration remains LEVEL_3; rank correction and notes retrieval retain their Administrator requirements. Advancement setup remains Administrator, decisions remain LEVEL_3, and ballots keep snapshot authorization. Leave Trailmark remains available after eligibility loss. Report author/staff checks, active-HQ requirements, Briefing LEVEL_1 reads, module gates, bridge rules and all server-side authorization remain in the existing handlers. Hidden controls are not an authorization boundary.

Confirmations cover important lifecycle decisions, Trailmark deactivation, archives, withdrawals/end actions, assignment removal, repairs, Atlas unlink, Funds adjustment/undo, and related destructive paths. Confirmations preserve selected IDs/revisions or command arguments and re-run the original handler checks. Funds undo checks that the ledger head has not changed. Detailed exceptions are logged; ordinary responses explain recovery rather than exposing SQL/constraint errors. Routine workflow views show readable summaries and retain full exports for advanced inspection.

## Persistence and backend preservation

No tables, RPCs, policies, migrations, credentials or dependencies were added or changed. Conversation state uses the existing setup-draft JSON payload and `codex_save_draft` revision contract; a real SQL round-trip test verifies it. Resource creation preferences use the existing `additionalResources` field. `configuredResources` merges preferences by logical key and excludes disabled optional-module resources. Healthy stored Discord IDs remain authoritative.

All mutation paths still use the original services/repositories, audit, operation receipts and delivery recovery. No new gateway intents or message listeners were added; the existing legacy bridge Message Content usage is unchanged. Medals, Field Names and Runecloak were not reintroduced.

## Validation

- `npm install --no-audit --no-fund`: passed, dependencies up to date. An earlier install also used `--ignore-scripts`; the normal install was then run successfully.
- `npm test`: **108 passed, 0 failed, 0 skipped**, including all 60 prior regression tests and 48 UX tests.
- `npm run lint`: passed (TypeScript no-emit validation).
- `npm run build`: passed, including `runtime/deploy.ts`.
- `git diff --check`: passed.
- Command builders serialize; registered command routing, dashboard argument contracts, real handler entry points, confirmation routing, and component/message/option limits are covered.
- Setup tests cover the complete flow, accepted-value persistence, multiple tier roles, native inputs, ranks/edges/duties/assignments/modules/resources, review/apply, navigation, interruption, ownership/expiry/staleness, section editing and repair.
- New tests cover all feature dashboards, role/module changes, input validation, owner/guild boundaries, single-use confirmations, ledger drift, empty-page navigation, bounded searches beyond 250 records, the member hub, long summaries, optional-resource gating and repair permission inspection.
- Existing PGlite integration tests apply all eleven migrations and preserve member, Funds, advancement, Trailmark, Intel, Contact, bridge, workflow, optional-system and Atlas regressions. No live Supabase or Discord services were used.
- Text review found no TODO/FIXME/stub implementation or generic “accepted” acknowledgements. `placeholder` hits are real Discord component properties. Removed-feature names occur only in the pre-existing legacy-intake test proving those fields are ignored. Technical identifiers/JSON exports remain only where needed for advanced recovery or inspection.

## Remaining limits and deployment

- Live Discord staging is still required to verify client rendering, role hierarchy and the actual installation's permissions. Local tests use Discord fakes and actual database migrations.
- Dashboard entry points use `/feature panel`, because existing Discord subcommand trees cannot also behave as bare root commands. [Discord's official command specification](https://github.com/discord/discord-api-docs/blob/main/developers/interactions/application-commands.mdx) and actual Discord.js builder output informed this choice.
- A pre-existing organization namespace named `help` retains its guild command tree and member handlers. Use its dashboard's Help button for discovery; the guild tree shadows the global root. New setups reserve `help` for discovery. That legacy registration has 22 trees rather than the normal 23, since its namespace occupies the help name.
- UI-only argument/search sessions last 15 minutes and confirmations 10 minutes. They expire on restart or bounded-cache eviction and must be reopened. Setup drafts and production workflow records remain durable. Record selectors retain existing version/lifecycle checks; refresh always reloads current state.
- Staff-only member records were not opened to ordinary members. The organization namespace instead provides a member navigation hub, with Member Administration shown only when authorized.
- The Detailed Editor remains the path for advanced removals, fine-grained existing-entry/edge maintenance and extra managed-resource definitions. Guided creation and section editing do not remove these capabilities.
- Patrol exposes the existing automatic suggestion contract; no new user-authored suggestion backend was invented. Reference search is bounded and may need Continue Search for a large library. Offset-based browsing reflects live data and can shift when records change.
- Advanced bridge setup still needs a remote guild ID; uncertain-delivery recovery retains technical identifiers. Discord does not provide a remote-guild selector. Routine setup/record actions require no typed Discord IDs or JSON.
- The current single-writer-per-guild deployment and prior Atlas/legacy-bridge compatibility limits still apply. See [deployment and smoke tests](DEPLOYMENT.md), [Atlas compatibility](ATLAS_COMPATIBILITY.md), and [bridge compatibility](BRIDGE_COMPATIBILITY.md).

The pre-commit review scanned 87 tracked/nonignored files and found no credential patterns, environment files or generated-output paths to commit. Existing ignored `.env`, `dist/`, `node_modules/` and `supabase/.temp/` are left untouched and excluded. No implementation files are intentionally left uncommitted. The final working-tree status and resulting commit SHA are reported after the commit.
