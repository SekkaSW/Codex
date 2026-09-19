# Production command and interaction inventory

All registered operations route to production handlers. The configured organization namespace is shown as {organization}. The routing regression test traverses every registered subcommand and asserts that its handler is reached. Feature tests then exercise real orchestration and PostgreSQL persistence with fake Discord boundaries.

| Namespace | Registered operations |
|---|---|
| /ping | (root) |
| /server | setup |
| /advancement | setup, eligible, status, open, close, approve, deny, ballots |
| /trailmark | panel, leave, list, sessions, create, edit, deactivate, set-atlas, clear-atlas, report, hq, repair, configure |
| /atlas | link, unlink, status |
| /roster | info, export, assignments, audit, inactive-review, sync-member, sync-all, sync-join-history, status, retire-left, note, notes, promote, rank |
| /recruit | invite, welcome |
| /funds | deposit, spend, set-balance, balance, history, undo-last, monthly, refresh-summary |
| /intel | set-hq, topic-add, topic-edit, topic-list, catchall-set, catchall-clear, refresh, repair-reporters, backfill, reports, deliver, link-report, recover-delivery |
| /strongbox | setup, submit, drop, history, review, process, reject |
| /reference | get, list, edit |
| /supply | create, log, undo-last, redistribute, status, contributors, refresh, close, reopen, cancel |
| /duty | assign, remove, list |
| /application | setup, apply, withdraw, list, review, approve, deny |
| /mentorship | looking-for, withdraw-looking, propose, sponsor, assign, end, info, requests |
| /contact | setup, repair, create, create-group, edit, list, link-member, unlink-member, archive, group-members |
| /vote | open, cast, close, audit, list |
| /briefing | setup, send, settings, history |
| /assignment | open, claim, close, cancel, set-member, clear-member, sync-roles, setup, unclaim, list |
| /patrol | suggest, list, resolve |
| /alliance | setup, sync, status, group-add, group-topics, group-remove, headquarters-remove, archive-category |
| /{organization} | info, export, assignments, audit, inactive-review, sync-member, sync-all, sync-join-history, status, retire-left, note, notes, promote, rank |

Every feature namespace in the table except `/ping` and `/server` also provides `panel`. `/help` is a new root command. There are **23 command trees and 175 registered operations**, including the configured organization namespace. All 155 previous operations are retained. `/trailmark panel` opens a dashboard; Request Access invokes its previous access selector.

## Dashboard usage

Use `/help` → choose a feature → choose an action. Dashboards show ten actions per page, with member actions before staff tools. Roles, users, channels, and configured choices use selectors; free text and numbers use single-question forms. Optional command arguments can be skipped. Existing record selectors remain paginated at 25 entries. Long workflow details are readable text with a full export available.

| Dashboard | Main member path | Additional authorized tools |
|---|---|---|
| Trailmark | Request Access, My Active Access, Leave, Report, Atlas Status when enabled | Create/edit/deactivate, HQ, access rules, Atlas configuration, repair, session export |
| Advancement | Eligibility, status, ballots | Open/close/approve/deny; Administrator ballot setup |
| Application | Apply, My Application, Withdraw | Configure, review, approve/deny |
| Mentorship | Looking for Mentor, Current Mentorship, Requests, Propose, End | Assign; Sponsor retains its existing member rule |
| Assignment | View Assignments, My Claimed Assignments, Claim/Unclaim | Open/close/cancel, setup, member assignment administration |
| Intel | Reports, Deliver to HQ, Link Report Contacts | Topics, catch-all, HQ, backfill/repair/recovery |
| Contacts | Staff-only under existing rules | Contact/group creation, views, links, archive, repair |
| Funds | Balance, history, monthly summary | LEVEL_2 deposit/spend/adjust/undo/summary refresh |
| Strongbox | Submit, My History | Review, process/reject, setup |
| Recruitment | Staff-only | Invite, Welcome, native user picker |
| Voting | Browse Votes, Cast Vote | Open, close, audit |
| Briefings | LEVEL_1 settings/history | LEVEL_3 send/setup |
| Supply | Status, contributors, log/undo under existing rules | Create, redistribute, lifecycle changes |
| Patrol | Request Suggestion, list | Resolve |
| Reference | Search References, browse/get | Edit |
| Atlas | Link, status, unlink with confirmation | Module configured through server setup |
| Organization | Navigation hub for available member workflows | Member Administration, rank/assignment/duty/notes tools under existing rules |
| Roster / Duty / Alliance | Existing staff access rules | All compatibility operations also available as dashboard actions |

Reference search inspects at most 250 records per interaction. Continue Search reaches later batches; selecting a result uses the existing Reference reader. My Claimed Assignments uses the same bounded browsing pattern. These filters add no database schema or business rules. Patrol requests the existing automatic suggestion; it does not introduce a new free-text suggestion backend.

Ordinary feature panels reload current permissions/module state. Argument forms expire after 15 minutes, confirmations after 10 minutes, and search sessions after 15 minutes; restarting the bot invalidates these UI-only sessions. Reopen `/help` to continue. Saved workflow records and seven-day setup drafts survive restarts. Stale setup controls explain how to run `/server setup` and Resume the saved draft. Other record revision conflicts explain how to reopen the feature.

Advanced bridge configuration still requests a remote guild ID because Discord provides no guild picker. Delivery recovery retains its technical identifiers. Setup and routine local record selection never require typing Discord IDs or JSON.

If an existing guild already uses `help` as its organization namespace, its guild-scoped tree and staff member commands are preserved. `/help panel` opens its organization hub, and the Help button opens discovery. New setups reserve that name. This legacy case has 22 trees because the namespace occupies the global help command name.

## Authorization and interaction dispatch

Discord Administrator overrides configured tiers where intended. Deleted configured roles fail closed. Configuration uses role/channel/user selectors rather than role names as authority.

| Custom-ID family | Runtime handler | Guard / lifecycle |
|---|---|---|
| setup: | SetupWizard | Owner, revision, expiry, Administrator, preview before provision |
| member: | handleMembers | Owner, LEVEL_3, current target/configuration, optimistic member version; rank correction requires Administrator |
| field: | handleField | Owner, record revisions, explicit progression, snapshotted voter rules, Trailmark eligibility and durable sessions |
| intel: | handleIntelligence | Owner; configuration/Contacts LEVEL_3; report author or staff link mutation; active HQ session for delivery |
| bridge: | handleBridge | Owner, LEVEL_3, configuration revision, reciprocal guild authorization / trusted legacy sender |
| flow: | handleWorkflows | Owner, staff mutations LEVEL_3, personal record checks, live poll eligibility, persisted lifecycle and duplicate constraints |
| optional: | handleOptional | Owner, current module flag, SQL module gate, staff mutations LEVEL_3; Briefing reads LEVEL_1 |
| ux: / uxform: | openPanel / handlePanel | Current live permissions, module checks, owner; input sessions also bind guild, expiry and revision |
| uxbrowse: | browse | Owner/guild/expiry, current BASELINE access, bounded read-only searches |
| uxconfirm: | handleConfirmation | Owner/guild/expiry, single use, original handler reauthorization and record checks; Funds undo also checks ledger head |

Setup uses actual owner message replies for free text, role/channel/entity selectors for identities, and buttons for navigation and confirmation. Field workflows use entity selectors, ballot buttons and forms. Intel uses Contact/group/topic/report selectors, member selectors and text modals. Bridge uses configured peer selectors and mapping forms. Organization workflows use duty/member/record/poll selectors and application/submission forms. Optional systems use campaign/reference selectors and text forms. Forum creation is a durable Discord side effect with a stored thread ID and receipt; no unhandled forum custom-ID family exists.

Funds mutations require LEVEL_2; reads are available to server members through the configured command destination. Duties and member administration require LEVEL_3. Advancement setup requires Administrator, decisions require LEVEL_3 and ballots use the case snapshot. Trailmark leave remains available after loss of eligibility so access can be revoked. Unknown/stale slash registrations produce a clear error instead of success.


## Setup message conversation

Organization name, namespace, confidentiality marker, rank/branch/duty/group/entry names, and managed-resource creation names use messages. Existing freeform edits in the Detailed Editor also ask for a message. Single-value answers are limited to 100 characters; comma-separated lists allow 1,800 characters and up to 100 nonblank names of 100 characters each (namespace: 1–32 lowercase letters, digits, underscores or hyphens, excluding reserved command names). No new description fields were added.

A private setup thread accepts the owner’s next message only while a text question is pending. The channel fallback requires a direct Discord Reply to the current question. Other users, bots/webhooks, old replies, other channels and ordinary chat are ignored. Buttons/selectors verify current Administrator permission and the owner, guild, prompt and revision too. Back displays retained values and Keep Current; Skip preserves optional sections. Invalid answers reissue the question. Cancel deletes the draft without applying it. Review and Confirm Setup are still required to apply configuration and provision resources.

Run /server setup after a restart and choose Resume. Accepted answers and the conversation binding remain in the seven-day durable draft. Old controls cannot overwrite the fresh prompt. Message Content Intent must be enabled; see DEPLOYMENT.md. Messages in the fallback channel are visible to its readers, so choose a suitable channel.


## Six-section server setup

1. **Group & Permissions:** group name; command with optional leading slash; native multi-role mappings for Recruit, Member, Advanced Member, Advisors and Leader. Permission levels are not ranks.
2. **Ranks & Progression:** comma-separated names → parsed-list confirmation → combined role/permission screen for each rank. Then choose/create a branch or No Branches, choose a starting rank and successive next-rank choices. Multiple alternatives and multiple branches are supported; “Ends Here” finishes a path.
3. **Duties & Assignments:** comma-separated duties (or Skip), with safe role creation at final confirmation. Assignment Groups ask name, required/as-needed membership, single/multiple assignments, then bulk entry names. Basic setup does not ask about role synchronization; Detailed Editor preserves it.
4. **Optional Features:** Briefings (mission/contract/assignment briefings), Patrol (assign or propose patrols), Supply (supply contracts), Atlas (manually maintained third-party map locations).
5. **Channels:** existing/new command and admin-log channels; recommended/custom Core and private Organization categories; optional Intelligence and Trailmarks. “Promotions” is the creation name for the existing advancement destination. Category customization names functional destinations in the displayed order, retains unspecified defaults and adds extra names as text channels. Contacts retains its Forum type. Healthy stored IDs keep names/layout. The private-report marker is asked only with Intelligence enabled; brackets are recommended. Atlas confirms provisioning without asking for browser credentials.
6. **Review:** human labels, role names, progression arrows, duties, assignments, feature states and channel names; long reviews use a readable text attachment. Back, Edit Section, Confirm Setup and Cancel remain available. No production changes occur before confirmation.

Edit Section offers targeted subsettings within these same six areas, so small edits do not require a full setup rerun. Existing guilds retain View Saved, Repair and Detailed Editor. Disabling Intelligence or Trailmarks asks for explicit confirmation and explains the effect, then requires final Confirm Setup. Historical records and healthy channels are retained. Trailmark temporary access is closed before the disabled flag is saved; failures can be retried. Repair excludes disabled-feature resources.

When Intelligence is disabled, Intel, Contacts and Alliance actions are unavailable. When Trailmarks is disabled, Trailmark and Trailmark-dependent Patrol actions are unavailable. Direct commands/components and SQL mutation boundaries enforce this as well as dashboard visibility. Atlas linking remains available, while status explains unavailable Trailmark integration. Existing subcommands and all unrelated dashboards retain their contracts.
