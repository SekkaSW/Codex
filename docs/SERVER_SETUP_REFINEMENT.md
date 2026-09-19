# Server setup refinement completion report

1. **Starting branch / HEAD:** main, f2bdc3565baf9c8fa5c2e3a764dcebde018b2e80. Completed prior work was preserved.
2. **Final branch / HEAD:** server-setup-refinement. The final SHA is the commit containing this report and is recorded in the task response; main remains at the starting SHA.
3. **Commit:** Refine conversational server setup. One focused local implementation commit.
4. **Six sections:** Group & Permissions → Ranks & Progression → Duties & Assignments → Optional Features → Channels → Review. Text questions accept literal owner messages; roles, channels, tiers and choices use native controls. Existing owner/admin, guild/channel, revision, expiry and private-conversation checks remain.
5. **Permission labels:** Recruit = BASELINE; Member = LEVEL_1; Advanced Member = LEVEL_2; Advisors = LEVEL_3; Leader = LEVEL_4. Multiple roles can map to each level. Rank tier metadata does not grant command permissions. Commands accept order or /order and retain reserved-name checks.
6. **Bulk ranks:** Comma-separated names are trimmed and deduplicated case-insensitively. Blank items are rejected. Limits are 100 names, 100 characters per name and 1,800 characters per message. Review/edit precedes applying the draft list. Each rank shows role and tier controls together. Existing matching names retain identities and role mappings; assigned-rank deletion remains protected by persistence validation.
7. **Progression:** Named branches or No Branches; choose a starting rank and multiple next ranks, continue through reachable ranks, or mark an endpoint. No Branches uses one general progression internally. Same-tier alternatives are supported. Cycles, self-links and dangling references remain invalid. Additional branches and paginated choices are supported.
8. **Duties:** A comma-separated list produces pending duty definitions. Only final confirmation creates Discord roles, with zero permissions, no hoist and no mentionability. Manage Roles and hierarchy are checked. Durable receipts record an attempt before creation and store the resulting role ID. Retries reuse IDs; uncertain outcomes require an exact bot audit-log match or explicit manual mapping, never a name-only duplicate. Manual duty mappings remain supported. Creation is audited, including deferred first-configuration audits. Assign/remove continues through the existing role ownership system. Discord side effects cannot be transactionally rolled back with SQL; a failure leaves receipts and a retryable draft.
9. **Assignment Groups:** Name → Required or Assigned as needed → Single or Multiple → comma-separated assignments → another group or continue. Existing groups can be selected and edited. Role synchronization stays in Detailed Editor.
10. **Optional Feature wording:**
    - Briefings — A place to provide briefings for missions, contracts, or optional assignments.
    - Patrol — A place to assign or propose patrols.
    - Supply — A place to organize supply contracts.
    - Atlas — A resource used to keep track of important locations through a third-party interactive map. Atlas locations must be added and maintained manually by authorized members.
11. **Intelligence:** Existing guilds default enabled; new setups must choose explicitly. Disabling requires confirmation and preserves historical records and channels. Provisioning, repair, dashboard actions, direct handlers, legacy intake, background processing, bridge deliveries and domain RPCs honor the flag. Shared delivery receipts remain available for unrelated Funds/Briefings/workflow delivery.
12. **Trailmarks:** Existing guilds default enabled; new setups choose explicitly. Disabling requires confirmation and closes current temporary member access before saving the flag. Failed revocations remain retryable. Historical records, channels and staff permissions remain. Provisioning, repair, dashboard/handlers, SQL operations, patrol-dependent actions and Atlas Trailmark polling honor the flag. Cleanup handles up to 1,000 sessions per confirmation before requiring another confirmation.
13. **Channels & Categories:** Commands and Admin logs accept an existing channel or a new channel name. Core, private Organization and optional Intelligence categories offer recommendations, existing-category selection and custom comma-separated names. Custom names replace functional destinations in displayed order; omitted trailing names keep recommendations and extra names add text channels. Existing stored IDs preserve actual Discord channel identity/name. Detailed Editor supplies individual bindings. Promotions is the new creation label; Contacts remains a Forum. Disabling a feature also excludes its overrides and extra child channels from provisioning/repair.
14. **Confidentiality:** Intelligence off skips Private Reports. When enabled, setup explains the marker and recommends brackets; matching private reports retain the existing confidentiality and permission behavior.
15. **Atlas:** Optional resource setup requires no credentials. Atlas can remain linked with Trailmarks disabled; the review/status explicitly explains unavailable Trailmark-dependent access/drop/visit functionality. Map maintenance remains manual.
16. **Illustrative final review:**

    Group: Example Order; Command: /order

    Permissions: Recruit — Recruit role; Member — Member role; Advanced Member — Veteran role; Advisors — Council role; Leader — Leader role

    Ranks: Recruit — Recruit — Recruit role; Member — Member — Member role

    Progression: General progression: Recruit → Member

    Duties: Quartermaster (create role at confirmation)

    Assignment Groups: Companies — Required, Single; North, South

    Optional Features: Briefings on; Patrol off; Supply on; Atlas off

    Channels: Commands — create bot-commands; Admin logs — create admin-logs; Core and Organization recommendations; Intelligence off; Trailmarks off

    Actual review uses chosen names and role labels, includes enabled channel plans and conditional Private Reports/Atlas details, and offers a full text attachment for long configurations. It does not dump JSON or internal permission/resource keys.

17. **Edit / Repair:** Saved configurations open the six-section selector. Targeted submenus allow small edits without replaying setup. Back, resume, review, View Saved, Detailed Editor and Repair remain. Old drafts preserve values when upgraded and clear obsolete expected-answer metadata. Repair uses stored IDs and enabled resources; it does not delete disabled historical resources. View Saved excludes pending duty creations.
18. **Backend / schema:** Two feature keys extend server_modules. managed_duty_creations stores durable role receipts with guild/name and guild/role uniqueness, RLS and service-only access. New service-only helper/RPC/trigger functions gate operations and record creation audits. Existing RPC signatures, internal permission tiers and organization transactions remain.
19. **Migration:** migrations/012_server_setup_refinement.sql and its matching CLI-created supabase/migrations/20260919124748_server_setup_refinement.sql. Earlier migrations are unchanged. Tests apply all 12 from scratch, upgrade populated migration-011 data, compare canonical/timestamp histories, test RLS/grants and verify preserved historical data. No hosted migration was applied.
20. **Tests:** npm test: 221 passed, 0 failed, 0 cancelled, 0 skipped. The original 155 tests remain; 66 added tests cover the conversation, validation, retries, feature gates, cleanup, fresh migration and populated upgrade.
21. **Other validation:** npm install succeeded with dependencies up to date; npm run lint and npm run build passed. Git diff whitespace checks passed. Build output and dependency directories are ignored; commit review excludes environment files and credentials.
22. **Live staging still needed:** Apply migration 012 to a non-production Supabase project, restart a staging bot, and walk through new/existing setup in Discord. Verify private thread/fallback permissions, role hierarchy, real role-create audit recovery, Forum provisioning, feature disable/re-enable, member overwrite cleanup and multi-process scheduling assumptions. Automated tests use simulated Discord and local PGlite; no live Discord or hosted Supabase staging was performed. Continue using the existing per-guild single-writer runtime model.
23. **Slash commands:** No command definitions changed; this refinement requires migration 012 and a bot restart, not slash-command redeployment.
24. **Production data:** No production data was modified.
25. **External actions:** No push, merge or deployment was performed.
26. **Working tree:** Verified after the implementation commit and reported with its SHA in the task response. No requested changes are intentionally left uncommitted. Ignored local dependencies/build output remain outside Git.
