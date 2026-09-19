# Setup selection confirmation fixes

This update supersedes the selection transitions in SERVER_SETUP_REFINEMENT.md. The six sections and existing private-thread/channel boundary remain.

Selections now follow Select → Review → Confirm & Next → next distinct question. Pending values are stored separately in the existing durable draft; only the reviewed value is copied to confirmed draft configuration. Final Confirm Setup still controls production configuration and duty-role provisioning. No UI migration is required.

Permissions replace exactly one level's role set. Roles mapped to another level produce a specific conflict instead of being moved silently. No Roles is explicit and reviewed. Change Selection restores the pending answer.

Rank role/tier controls share one question. New ranks have two unanswered inputs. Either order works; one selection updates the existing Discord message in place. Both open a combined review. A narrowly scoped prior prompt/revision accepts the second selector from the same displayed rank while its pending pair is incomplete. It is cleared on review, navigation and confirmation; old selectors cannot edit another rank. Local component serialization supplements the existing per-guild runtime queue and durable revision boundary. Existing ranks prefill only their own saved settings and offer Review These Settings without immediately opening review.

Progression reviews include branch/source/targets, including explicit endpoints. Optional Features confirms exactly its four keys and leaves Intelligence/Trailmarks untouched. Back never accepts pending input; resume restores partial pairs and reviews.

## Namespace investigation

The existing string “Send order or /order.” is helper text, not an exception. No exact failing live payload/error was supplied, so the reported live failure cannot be attributed to a particular cause. Actual message-routing tests accept order, /order and surrounding whitespace, and reject multiword input, double slash, reserved names and excess length without advancing. Success now says “Command set to /order in your setup draft.” Ownership, channel and expected-question fences remain.

## Simulated transcript (production message/component route)

Before: select Recruit roles → repeat Recruit question → Done. Select a rank role → repeated screen with Recruit default → select tier → repeated screen → Continue.

After (synthetic fixture roles):

- Bot: What is the name of the group? Owner: Example.
- Bot: What do you want your command to be? Owner: /order.
- Bot: Command set to /order in your setup draft. Recruit permissions.
- Owner selects Role 0 → review Role 0 → Confirm & Next → Member permissions.
- Owner selects Role 1 → review Role 1 → Confirm & Next → Advanced Member permissions.
- Owner selects Role 2 → review Role 2 → Confirm & Next → Advisors permissions.
- Owner selects Role 3 → review Role 3 → Confirm & Next → Leader permissions.
- Owner selects Role 4 → review Role 4 → Confirm & Next → bulk rank names.
- Owner: One, Two, Three → list review → Continue.
- Rank 1 One: role Role 0 → tier still unanswered; tier Recruit → combined review → Confirm & Next.
- Rank 2 Two: tier Member → role still unanswered; role Role 1 → combined review → Confirm & Next.
- Rank 3 Three: role Role 2 → tier Advanced Member → combined review → Confirm & Next.
- Branch Steel; starting One; next Two and Three → review Steel / One / Two, Three → Confirm & Next → Two.
- Two: This Is the Final Rank → endpoint review → Confirm & Next → Three.
- Three: This Is the Final Rank → endpoint review → Confirm & Next → Add Another Branch.
- Duties / Assignment Groups retain their separate established questions.
- Optional Features: Briefings and Atlas → review enabled Briefings, Atlas / not enabled Patrol, Supply → Confirm & Next → Channels.

No question confirmation creates duty roles or applies production configuration. Tests also exercise replacement, conflicts, explicit empty answers, fast paired selectors, three distinct rank pairs, stale confirmation/selector rejection and partial-pair resume. Local tests do not certify live Discord behavior; staging must repeat this transcript after bot restart.
