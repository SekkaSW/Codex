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

22 command trees and 155 routed operations, including the organization namespace.

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

Setup uses role/channel/entity selectors, buttons and modals. Field workflows use entity selectors, ballot buttons and forms. Intel uses Contact/group/topic/report selectors, member selectors and text modals. Bridge uses configured peer selectors and mapping forms. Organization workflows use duty/member/record/poll selectors and application/submission forms. Optional systems use campaign/reference selectors and text forms. Forum creation is a durable Discord side effect with a stored thread ID and receipt; no unhandled forum custom-ID family exists.

Funds mutations require LEVEL_2; reads are available to server members through the configured command destination. Duties and member administration require LEVEL_3. Advancement setup requires Administrator, decisions require LEVEL_3 and ballots use the case snapshot. Trailmark leave remains available after loss of eligibility so access can be revoked. Unknown/stale slash registrations produce a clear error instead of success.
