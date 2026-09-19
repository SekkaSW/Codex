# Native command usage

Native slash arguments supersede the earlier mandatory dashboard-first plan. Use /help for discovery; /feature panel remains an optional shortcut. Applications, reports, references, choice ballots and dispatches retain their meaningful forms. See WAYFINDER_COMMAND_PARITY.md for source contracts, policy exceptions and explicit compatibility gaps.

/organization below means the configured guild root, such as /order. /promotion aliases /advancement; /apprenticeship aliases /mentorship. Existing organization roots with those names take precedence. New setup reserves the aliases.

Permissions: BASELINE = Recruit, LEVEL_1 = Member, LEVEL_2 = Advanced Member, LEVEL_3 = Advisors, LEVEL_4 = Leader. Fresh authorization, record ownership, minimum rank and snapshotted ballot rules still apply. Autocomplete does not grant permission.

## Direct examples

- /supply log assignment:<order> item:<item> quantity:3 item_2:<second item> quantity_2:2 — atomic item contribution. Omit member to credit yourself; crediting someone else requires Advisors.
- /funds deposit member:@Member amount:100 note:Donation — actor and credited member stay separate.
- /promotion open candidate:@Member target_rank:<configured rank> reason:Ready — public ballot and discussion.
- /application apply position:<configured duty> — original application form.
- /vote open format:binary question:Proceed? — immediate Yes/No/Abstain ballot.
- /briefing send audience:individual recipient:@Member kind:ic — dispatch form. Collect via Check My Briefing or /organization briefing.
- /trailmark report type:Incident — run inside your active Trailmark conversation.

## Registered contract

! marks required inputs. This table documents runtime inputs; the independent source fixture is the parity baseline. Access is discovery guidance, with additional conditional checks in production handlers.

| Command | Ordered inputs | Access |
| --- | --- | --- |
| /ping  |  | ADMIN |
| /help  |  | ADMIN |
| /server setup |  | ADMIN |
| /advancement setup | `channel!` | ADMIN |
| /advancement eligible |  | BASELINE |
| /advancement status | `candidate!`, `progress!` | LEVEL_3 |
| /advancement open | `candidate!`, `target_rank` (autocomplete), `reason`, `mentions`, `mentions_2`, `mentions_3`, `mentions_4`, `mentions_5` | LEVEL_3 |
| /advancement close | `vote!` (autocomplete) | LEVEL_3 |
| /advancement approve | `vote!` (autocomplete) | LEVEL_3 |
| /advancement deny | `vote!` (autocomplete) | LEVEL_3 |
| /advancement ballots | `vote!` (autocomplete) | BASELINE |
| /advancement panel |  | BASELINE |
| /advancement refresh | `vote!` (autocomplete) | LEVEL_3 |
| /trailmark panel |  | BASELINE |
| /trailmark leave |  | ANY |
| /trailmark list |  | BASELINE |
| /trailmark sessions |  | LEVEL_3 |
| /trailmark report | `type!`, `contact` (autocomplete), `contact_2` (autocomplete), `contact_3` (autocomplete), `participant`, `participant_2`, `participant_3` | BASELINE |
| /trailmark create | `name!`, `assignment!` (autocomplete), `location_description!`, `screenshot`, `atlas_location_id` | LEVEL_3 |
| /trailmark edit | `trailmark!` (autocomplete), `name`, `assignment` (autocomplete), `location_description`, `screenshot`, `clear_screenshot`, `atlas_location_id`, `clear_atlas`, `pinned`, `patrol_primary` (autocomplete), `clear_patrol_primary` | LEVEL_3 |
| /trailmark deactivate | `trailmark!` (autocomplete) | LEVEL_3 |
| /trailmark set-atlas | `trailmark!` (autocomplete), `atlas_location_id!` | LEVEL_3 |
| /trailmark clear-atlas | `trailmark!` (autocomplete) | LEVEL_3 |
| /trailmark hq |  | LEVEL_3 |
| /trailmark repair |  | LEVEL_3 |
| /trailmark configure |  | LEVEL_3 |
| /atlas link |  | BASELINE |
| /atlas panel |  | BASELINE |
| /atlas unlink |  | BASELINE |
| /atlas status |  | BASELINE |
| /roster export |  | LEVEL_3 |
| /roster panel |  | LEVEL_3 |
| /roster info | `member` | LEVEL_3 |
| /roster assignments | `member!` | LEVEL_3 |
| /roster audit | `member!` | LEVEL_3 |
| /roster inactive-review |  | LEVEL_3 |
| /roster sync-member | `member!`, `reason` | LEVEL_3 |
| /roster sync-all | `page` | LEVEL_3 |
| /roster sync-join-history | `member!`, `reason` | LEVEL_3 |
| /roster status | `member!`, `value!`, `reason` | LEVEL_3 |
| /roster retire-left | `page` | LEVEL_3 |
| /roster note | `member!`, `body!`, `visibility` | LEVEL_3 |
| /roster notes | `member!` | ADMIN |
| /roster promote | `member!` | LEVEL_3 |
| /roster rank | `member!` | ADMIN |
| /recruit invite |  | LEVEL_3 |
| /recruit welcome | `user!` | LEVEL_3 |
| /recruit panel |  | LEVEL_3 |
| /funds deposit | `member!`, `amount!`, `note` | LEVEL_2 |
| /funds spend | `amount!`, `note!`, `paid_to` | LEVEL_2 |
| /funds set-balance | `amount!`, `note` | LEVEL_2 |
| /funds refresh-summary |  | LEVEL_2 |
| /funds balance |  | ANY |
| /funds history | `member` | ANY |
| /funds undo-last |  | LEVEL_2 |
| /funds monthly | `year!`, `month!` | ANY |
| /funds panel |  | ANY |
| /intel set-hq | `trailmark!` (autocomplete) | LEVEL_3 |
| /intel topic-add | `name!`, `keywords!`, `channel` | LEVEL_3 |
| /intel topic-edit | `topic!` (autocomplete), `keywords!`, `append` | LEVEL_3 |
| /intel topic-list |  | LEVEL_3 |
| /intel catchall-set | `topic` (autocomplete), `name`, `channel` | LEVEL_3 |
| /intel catchall-clear |  | LEVEL_3 |
| /intel refresh | `topic!` (autocomplete) | LEVEL_3 |
| /intel repair-reporters | `topic` (autocomplete) | LEVEL_3 |
| /intel backfill | `topic` (autocomplete), `mode`, `after`, `limit_per_trailmark` | LEVEL_3 |
| /intel panel |  | LEVEL_3 |
| /intel reports |  | BASELINE |
| /intel deliver |  | BASELINE |
| /intel link-report |  | BASELINE |
| /intel recover-delivery | `key!`, `message!` | LEVEL_3 |
| /strongbox drop | `message!`, `attachment` | BASELINE |
| /strongbox setup |  | LEVEL_3 |
| /strongbox panel |  | BASELINE |
| /strongbox submit |  | BASELINE |
| /strongbox history |  | BASELINE |
| /strongbox review |  | LEVEL_3 |
| /strongbox process |  | LEVEL_3 |
| /strongbox reject |  | LEVEL_3 |
| /reference add | `title!`, `category!`, `source-url!`, `authority`, `context`, `confidentiality`, `posted-at`, `attachment-links`, `supersedes` | BASELINE |
| /reference view | `id!` | BASELINE |
| /reference panel |  | BASELINE |
| /reference get |  | BASELINE |
| /reference list |  | BASELINE |
| /reference edit |  | LEVEL_3 |
| /supply panel |  | BASELINE |
| /supply create | `name!`, `client!`, `sale_price!`, `member_rate!`, `item_1!`, `quota_1!`, `item_2`, `quota_2`, `item_3`, `quota_3`, `item_4`, `quota_4`, `organizer`, `notes` | LEVEL_3 |
| /supply log | `assignment!` (autocomplete), `item!` (autocomplete), `quantity!`, `item_2` (autocomplete), `quantity_2`, `item_3` (autocomplete), `quantity_3`, `item_4` (autocomplete), `quantity_4`, `member`, `note` | BASELINE |
| /supply undo-last | `assignment!` (autocomplete), `member` | BASELINE |
| /supply redistribute | `assignment!` (autocomplete), `source_id!`, `before!`, `method!`, `reason` | LEVEL_3 |
| /supply status | `assignment!` (autocomplete) | BASELINE |
| /supply contributors | `assignment!` (autocomplete) | BASELINE |
| /supply refresh | `assignment!` (autocomplete) | BASELINE |
| /supply close | `assignment!` (autocomplete) | LEVEL_3 |
| /supply reopen | `assignment!` (autocomplete) | LEVEL_3 |
| /supply cancel | `assignment!` (autocomplete) | LEVEL_3 |
| /duty assign | `member!`, `duty!` (autocomplete) | LEVEL_3 |
| /duty remove | `member!`, `duty!` (autocomplete), `reason` | LEVEL_3 |
| /duty list | `duty` (autocomplete) | LEVEL_3 |
| /duty setup |  | LEVEL_3 |
| /duty panel |  | LEVEL_3 |
| /application apply | `position!` (autocomplete) | BASELINE |
| /application withdraw | `application!` (autocomplete) | BASELINE |
| /application list |  | BASELINE |
| /application setup | `channel!` | LEVEL_3 |
| /application panel |  | BASELINE |
| /application review |  | LEVEL_3 |
| /application approve |  | LEVEL_3 |
| /application deny |  | LEVEL_3 |
| /mentorship looking-for | `type!`, `note` | BASELINE |
| /mentorship withdraw-looking |  | BASELINE |
| /mentorship propose | `member!` | BASELINE |
| /mentorship sponsor | `recruit!`, `reason!` | BASELINE |
| /mentorship assign | `mentor!`, `apprentice!` | LEVEL_3 |
| /mentorship end | `member`, `reason` | BASELINE |
| /mentorship info | `member` | BASELINE |
| /mentorship requests |  | BASELINE |
| /mentorship panel |  | BASELINE |
| /contact setup | `category` | LEVEL_3 |
| /contact create | `name!`, `race!`, `sex!`, `occupation!`, `assignment!` (autocomplete), `faction`, `usual_locations`, `commentary`, `high_priority` | LEVEL_1 |
| /contact create-group | `name!`, `category!`, `assignment!` (autocomplete), `estimated_size`, `identifying_features`, `weapons_capabilities`, `tactics`, `usual_locations`, `faction`, `commentary`, `high_priority` | LEVEL_1 |
| /contact edit | `contact!` (autocomplete), `name`, `race`, `sex`, `occupation`, `assignment` (autocomplete), `faction`, `usual_locations`, `commentary`, `group_category`, `estimated_size`, `identifying_features`, `weapons_capabilities`, `tactics`, `high_priority` | LEVEL_3 |
| /contact list | `type`, `assignment` (autocomplete), `occupation`, `group_category`, `high_priority` | LEVEL_3 |
| /contact link-member | `group!` (autocomplete), `person!` (autocomplete) | LEVEL_3 |
| /contact unlink-member | `group!` (autocomplete), `person!` (autocomplete) | LEVEL_3 |
| /contact archive | `contact!` (autocomplete), `reason` | LEVEL_3 |
| /contact panel |  | Available actions: Member creation; Advisors administration |
| /contact repair | `page` | LEVEL_3 |
| /contact group-members |  | LEVEL_3 |
| /vote open | `format`, `question`, `context` | LEVEL_3 |
| /vote close | `vote!` (autocomplete) | LEVEL_3 |
| /vote audit | `vote!` (autocomplete) | LEVEL_3 |
| /vote panel |  | BASELINE |
| /vote cast |  | BASELINE |
| /vote list |  | BASELINE |
| /briefing setup | `channel!` | LEVEL_3 |
| /briefing send | `audience!`, `recipient`, `kind` | LEVEL_3 |
| /briefing settings | `dm_enabled!` | LEVEL_1 |
| /briefing panel |  | LEVEL_1 |
| /briefing history |  | LEVEL_1 |
| /assignment setup | `forum!` | LEVEL_3 |
| /assignment create | `minimum_rank` (autocomplete), `assignment` (autocomplete) | LEVEL_3 |
| /assignment panel |  | BASELINE |
| /assignment open |  | LEVEL_3 |
| /assignment claim |  | BASELINE |
| /assignment close |  | LEVEL_3 |
| /assignment cancel |  | LEVEL_3 |
| /assignment set-member | `member!` | LEVEL_3 |
| /assignment clear-member | `member!` | LEVEL_3 |
| /assignment sync-roles | `member!` | LEVEL_3 |
| /assignment unclaim |  | BASELINE |
| /assignment list |  | BASELINE |
| /patrol suggest | `assignment` (autocomplete) | BASELINE |
| /patrol panel |  | BASELINE |
| /patrol list |  | BASELINE |
| /patrol resolve |  | LEVEL_3 |
| /alliance panel |  | LEVEL_3 |
| /alliance setup | `name!`, `remote!`, `protocol!`, `intake`, `sender` | LEVEL_3 |
| /alliance sync |  | LEVEL_3 |
| /alliance status |  | LEVEL_3 |
| /alliance group-add |  | LEVEL_3 |
| /alliance group-topics |  | LEVEL_3 |
| /alliance group-remove |  | LEVEL_3 |
| /alliance headquarters-remove |  | LEVEL_3 |
| /alliance archive-category | `category!` | LEVEL_3 |
| /organization info | `user` | LEVEL_3 |
| /organization briefing |  | LEVEL_1 |
| /organization assignments |  | LEVEL_3 |
| /organization audit |  | LEVEL_3 |
| /organization inactive-review | `days` | LEVEL_3 |
| /organization sync-member | `user` | LEVEL_3 |
| /organization sync-all |  | LEVEL_3 |
| /organization sync-join-history | `channel!` | LEVEL_3 |
| /organization status | `user!`, `status!` | LEVEL_3 |
| /organization retire-left | `discord_user_id!` | LEVEL_3 |
| /organization clear-assignment | `discord_user_id!`, `assignment!` (autocomplete) | LEVEL_3 |
| /organization set-assignment | `user!`, `assignment!` (autocomplete) | LEVEL_3 |
| /organization sync-assignment-roles |  | LEVEL_3 |
| /organization note | `user!`, `note!`, `append` | LEVEL_3 |
| /organization promote | `user!`, `rank!` (autocomplete), `reason` | LEVEL_3 |
| /organization panel |  | LEVEL_3 |
| /organization export |  | LEVEL_3 |
| /organization notes | `member!` | ADMIN |
| /organization rank | `member!` | ADMIN |
| /promotion setup | `channel!` | ADMIN |
| /promotion eligible |  | BASELINE |
| /promotion status | `candidate!`, `progress!` | LEVEL_3 |
| /promotion open | `candidate!`, `target_rank` (autocomplete), `reason`, `mentions`, `mentions_2`, `mentions_3`, `mentions_4`, `mentions_5` | LEVEL_3 |
| /promotion close | `vote!` (autocomplete) | LEVEL_3 |
| /promotion approve | `vote!` (autocomplete) | LEVEL_3 |
| /promotion deny | `vote!` (autocomplete) | LEVEL_3 |
| /promotion ballots | `vote!` (autocomplete) | BASELINE |
| /promotion panel |  | BASELINE |
| /promotion refresh | `vote!` (autocomplete) | LEVEL_3 |
| /apprenticeship looking-for | `type!`, `note` | BASELINE |
| /apprenticeship withdraw-looking |  | BASELINE |
| /apprenticeship propose | `member!` | BASELINE |
| /apprenticeship sponsor | `recruit!`, `reason!` | BASELINE |
| /apprenticeship assign | `mentor!`, `apprentice!` | LEVEL_3 |
| /apprenticeship end | `member`, `reason` | BASELINE |
| /apprenticeship info | `member` | BASELINE |
| /apprenticeship requests |  | BASELINE |

Reference add/view require Advisors; Leader-labeled references require Leader. Supply management and other-member credits require Advisors. Briefing access remains Member+. Contact individual/group creation requires Member; Contact administration and member administration remain Advisors. Alliance keeps its reciprocal bridge contract. Native historical Intel backfill scans persisted records, not unrecognized legacy Discord messages. Old scalar Supply and shared reference records remain available separately. See DEPLOYMENT.md before migration/registration.
