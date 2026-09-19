// Reviewed command metadata from Wayfinder 1bf7606; behavior uses Codex services only.
// The independent source inventory lives under test/fixtures, never imported at runtime.
export const nativeContracts = [
  {
    "name": "application",
    "description": "Apply for organization duties or leadership consideration.",
    "options": [
      {
        "type": 1,
        "name": "apply",
        "description": "Open a organization duty or leadership application.",
        "options": [
          {
            "type": 3,
            "name": "position",
            "description": "Position you are applying for.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "withdraw",
        "description": "Withdraw one of your pending applications.",
        "options": [
          {
            "type": 3,
            "name": "application",
            "description": "Your pending application.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "list",
        "description": "Advisors+: list pending organization applications you can review."
      },
      {
        "type": 1,
        "name": "setup",
        "description": "Commander: configure private leadership application review channels.",
        "options": [
          {
            "type": 7,
            "name": "channel",
            "description": "Private application review channel (Advisors)",
            "required": true,
            "channel_types": [
              0
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "apprenticeship",
    "description": "Find, establish, and manage Member apprenticeships.",
    "options": [
      {
        "type": 1,
        "name": "looking-for",
        "description": "Post a notice that you are looking for a mentor or Recruit.",
        "options": [
          {
            "type": 3,
            "name": "type",
            "description": "What you are looking for.",
            "required": true,
            "choices": [
              {
                "name": "A mentor",
                "value": "Mentor"
              },
              {
                "name": "An apprentice",
                "value": "Apprentice"
              }
            ]
          },
          {
            "type": 3,
            "name": "note",
            "description": "Optional preferences or introduction.",
            "max_length": 1500
          }
        ]
      },
      {
        "type": 1,
        "name": "withdraw-looking",
        "description": "Remove your apprenticeship matching request."
      },
      {
        "type": 1,
        "name": "propose",
        "description": "Propose a pairing between an existing Member and Recruit.",
        "options": [
          {
            "type": 6,
            "name": "member",
            "description": "The proposed mentor or Recruit.",
            "required": true
          }
        ]
      },
      {
        "type": 1,
        "name": "sponsor",
        "description": "Sponsor a new Discord member as your Recruit for Advisors review.",
        "options": [
          {
            "type": 6,
            "name": "recruit",
            "description": "The new recruit already in the Discord.",
            "required": true
          },
          {
            "type": 3,
            "name": "reason",
            "description": "Why they would make a good Member.",
            "required": true,
            "max_length": 2000
          }
        ]
      },
      {
        "type": 1,
        "name": "assign",
        "description": "Advisors+: directly pair an existing Member and Recruit.",
        "options": [
          {
            "type": 6,
            "name": "mentor",
            "description": "Member or higher who will mentor.",
            "required": true
          },
          {
            "type": 6,
            "name": "apprentice",
            "description": "Existing Recruit.",
            "required": true
          }
        ]
      },
      {
        "type": 1,
        "name": "end",
        "description": "End your apprenticeship, or Advisors+: end another pairing.",
        "options": [
          {
            "type": 6,
            "name": "member",
            "description": "A participant in the pairing. Leave blank for your own."
          },
          {
            "type": 3,
            "name": "reason",
            "description": "Optional reason.",
            "max_length": 1000
          }
        ]
      },
      {
        "type": 1,
        "name": "info",
        "description": "Show a current apprenticeship.",
        "options": [
          {
            "type": 6,
            "name": "member",
            "description": "Participant to inspect. Leave blank for yourself."
          }
        ]
      },
      {
        "type": 1,
        "name": "requests",
        "description": "Advisors+: list matching requests and current pairings."
      }
    ]
  },
  {
    "name": "assignment",
    "description": "Create and manage organization assignments.",
    "options": [
      {
        "type": 1,
        "name": "setup",
        "description": "Advisors+: connect Codex to the Assignments Forum.",
        "options": [
          {
            "type": 7,
            "name": "forum",
            "description": "The existing Assignments Forum channel.",
            "channel_types": [
              15
            ],
            "required": true
          }
        ]
      },
      {
        "type": 1,
        "name": "create",
        "description": "Member+: post a new assignment to the organization board.",
        "options": [
          {
            "type": 3,
            "name": "minimum_rank",
            "description": "Choose who may join. The default is Recruit+.",
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "assignment",
            "description": "Primary Hold, if the assignment is regional.",
            "autocomplete": true
          }
        ]
      }
    ]
  },
  {
    "name": "atlas",
    "description": "Connect the Field Atlas to your Member Trailmarks.",
    "options": [
      {
        "type": 1,
        "name": "link",
        "description": "Create a temporary code to link your Atlas device to Discord."
      }
    ]
  },
  {
    "name": "briefing",
    "description": "Collect your briefing or send a Headquarters dispatch.",
    "options": [
      {
        "type": 1,
        "name": "setup",
        "description": "Advisors+: place the Dispatch Desk in a channel.",
        "options": [
          {
            "type": 7,
            "name": "channel",
            "description": "The channel where members collect their briefings.",
            "channel_types": [
              0
            ],
            "required": true
          }
        ]
      },
      {
        "type": 1,
        "name": "send",
        "description": "Advisors+: send a dispatch or short OOC note.",
        "options": [
          {
            "type": 3,
            "name": "audience",
            "description": "Who receives this in their next briefing.",
            "required": true,
            "choices": [
              {
                "name": "All organization Members",
                "value": "apprentice_plus"
              },
              {
                "name": "Member+",
                "value": "ranger_plus"
              },
              {
                "name": "Advisors+",
                "value": "marshal_plus"
              },
              {
                "name": "Leader+",
                "value": "captain_plus"
              },
              {
                "name": "One organization Member",
                "value": "individual"
              }
            ]
          },
          {
            "type": 6,
            "name": "recipient",
            "description": "Choose a member when the audience is One organization Member."
          },
          {
            "type": 3,
            "name": "kind",
            "description": "Send an in-character dispatch or a short OOC note.",
            "choices": [
              {
                "name": "In-character dispatch",
                "value": "ic"
              },
              {
                "name": "OOC note",
                "value": "ooc"
              }
            ]
          }
        ]
      },
      {
        "type": 1,
        "name": "settings",
        "description": "Choose whether Codex sends your briefing by DM.",
        "options": [
          {
            "type": 5,
            "name": "dm_enabled",
            "description": "Turn this off to read briefings in the private reply instead.",
            "required": true
          }
        ]
      }
    ]
  },
  {
    "name": "contact",
    "description": "Maintain the organization contact records.",
    "options": [
      {
        "type": 1,
        "name": "setup",
        "description": "Advisors+: create or repair the Contacts Forum.",
        "options": [
          {
            "type": 7,
            "name": "category",
            "description": "Optional category for the Contacts Forum.",
            "channel_types": [
              4
            ]
          }
        ]
      },
      {
        "type": 1,
        "name": "create",
        "description": "Recruit+: create a record for an individual contact.",
        "options": [
          {
            "type": 3,
            "name": "name",
            "description": "The contact's name.",
            "required": true,
            "max_length": 100
          },
          {
            "type": 3,
            "name": "race",
            "description": "The contact's race.",
            "required": true,
            "max_length": 100
          },
          {
            "type": 3,
            "name": "sex",
            "description": "The contact's sex.",
            "required": true,
            "max_length": 100
          },
          {
            "type": 3,
            "name": "occupation",
            "description": "Occupation, such as Alchemist or Merchant.",
            "required": true,
            "max_length": 100
          },
          {
            "type": 3,
            "name": "assignment",
            "description": "Primary Hold or region.",
            "required": true,
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "faction",
            "description": "Faction or organization.",
            "max_length": 150
          },
          {
            "type": 3,
            "name": "usual_locations",
            "description": "Places where this person is usually found.",
            "max_length": 500
          },
          {
            "type": 3,
            "name": "commentary",
            "description": "Additional notes about the contact.",
            "max_length": 1500
          },
          {
            "type": 5,
            "name": "high_priority",
            "description": "Mark important contacts such as leaders or high-ranking officials."
          }
        ]
      },
      {
        "type": 1,
        "name": "create-group",
        "description": "Recruit+: create a record for a known group.",
        "options": [
          {
            "type": 3,
            "name": "name",
            "description": "The group's known name.",
            "required": true,
            "max_length": 100
          },
          {
            "type": 3,
            "name": "category",
            "description": "What kind of group this is.",
            "required": true
          },
          {
            "type": 3,
            "name": "assignment",
            "description": "Primary Hold or region.",
            "required": true,
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "estimated_size",
            "description": "Estimated numbers or strength.",
            "max_length": 200
          },
          {
            "type": 3,
            "name": "identifying_features",
            "description": "Clothing, symbols, appearance, or other identifying signs.",
            "max_length": 700
          },
          {
            "type": 3,
            "name": "weapons_capabilities",
            "description": "Known weapons, magic, creatures, or other capabilities.",
            "max_length": 700
          },
          {
            "type": 3,
            "name": "tactics",
            "description": "Known tactics, behavior, or patterns.",
            "max_length": 700
          },
          {
            "type": 3,
            "name": "usual_locations",
            "description": "Territory, camps, routes, or usual locations.",
            "max_length": 500
          },
          {
            "type": 3,
            "name": "faction",
            "description": "Larger faction or known affiliation.",
            "max_length": 150
          },
          {
            "type": 3,
            "name": "commentary",
            "description": "Additional intelligence or notes.",
            "max_length": 1500
          },
          {
            "type": 5,
            "name": "high_priority",
            "description": "Mark a particularly important or dangerous group."
          }
        ]
      },
      {
        "type": 1,
        "name": "edit",
        "description": "Recruit+: edit a person or group record.",
        "options": [
          {
            "type": 3,
            "name": "contact",
            "description": "Person or group to edit.",
            "required": true,
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "name",
            "description": "Replace the record's name.",
            "max_length": 100
          },
          {
            "type": 3,
            "name": "race",
            "description": "Replace the contact's race.",
            "max_length": 100
          },
          {
            "type": 3,
            "name": "sex",
            "description": "Replace the contact's sex.",
            "max_length": 100
          },
          {
            "type": 3,
            "name": "occupation",
            "description": "Replace the occupation.",
            "max_length": 100
          },
          {
            "type": 3,
            "name": "assignment",
            "description": "Replace the primary Hold or region.",
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "faction",
            "description": "Replace the faction or organization.",
            "max_length": 150
          },
          {
            "type": 3,
            "name": "usual_locations",
            "description": "Replace usual locations.",
            "max_length": 500
          },
          {
            "type": 3,
            "name": "commentary",
            "description": "Replace the commentary.",
            "max_length": 1500
          },
          {
            "type": 3,
            "name": "group_category",
            "description": "Group records only: replace the category."
          },
          {
            "type": 3,
            "name": "estimated_size",
            "description": "Group records only: replace estimated size.",
            "max_length": 200
          },
          {
            "type": 3,
            "name": "identifying_features",
            "description": "Group records only: replace identifying signs.",
            "max_length": 700
          },
          {
            "type": 3,
            "name": "weapons_capabilities",
            "description": "Group records only: replace arms or capabilities.",
            "max_length": 700
          },
          {
            "type": 3,
            "name": "tactics",
            "description": "Group records only: replace tactics or behavior.",
            "max_length": 700
          },
          {
            "type": 5,
            "name": "high_priority",
            "description": "Set whether this is a high-priority contact."
          }
        ]
      },
      {
        "type": 1,
        "name": "list",
        "description": "List active people and groups, optionally filtered.",
        "options": [
          {
            "type": 3,
            "name": "type",
            "description": "Only people or groups.",
            "choices": [
              {
                "name": "People",
                "value": "Person"
              },
              {
                "name": "Groups",
                "value": "Group"
              }
            ]
          },
          {
            "type": 3,
            "name": "assignment",
            "description": "Only contacts in this Hold or region.",
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "occupation",
            "description": "Only contacts with this occupation.",
            "max_length": 100
          },
          {
            "type": 3,
            "name": "group_category",
            "description": "Only groups in this category."
          },
          {
            "type": 5,
            "name": "high_priority",
            "description": "Only show high-priority contacts."
          }
        ]
      },
      {
        "type": 1,
        "name": "link-member",
        "description": "Recruit+: link a person contact as a known member of a group.",
        "options": [
          {
            "type": 3,
            "name": "group",
            "description": "Group contact record.",
            "required": true,
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "person",
            "description": "Person contact record to add as a member.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "unlink-member",
        "description": "Recruit+: remove a person's membership link from a group.",
        "options": [
          {
            "type": 3,
            "name": "group",
            "description": "Group contact record.",
            "required": true,
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "person",
            "description": "Person contact record to unlink.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "archive",
        "description": "Advisors+: archive a contact without deleting its history.",
        "options": [
          {
            "type": 3,
            "name": "contact",
            "description": "Contact to archive.",
            "required": true,
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "reason",
            "description": "Why the contact is being archived.",
            "max_length": 500
          }
        ]
      }
    ]
  },
  {
    "name": "duty",
    "description": "Manage active organization duties. Use /application apply to volunteer.",
    "options": [
      {
        "type": 1,
        "name": "assign",
        "description": "Advisors+: directly assign a organization duty.",
        "options": [
          {
            "type": 6,
            "name": "member",
            "description": "Member receiving the duty.",
            "required": true
          },
          {
            "type": 3,
            "name": "duty",
            "description": "Duty to assign.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "remove",
        "description": "Advisors+: remove a organization duty.",
        "options": [
          {
            "type": 6,
            "name": "member",
            "description": "Member losing the duty.",
            "required": true
          },
          {
            "type": 3,
            "name": "duty",
            "description": "Duty to remove.",
            "required": true,
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "reason",
            "description": "Optional removal reason.",
            "max_length": 500
          }
        ]
      },
      {
        "type": 1,
        "name": "list",
        "description": "List current organization duty holders.",
        "options": [
          {
            "type": 3,
            "name": "duty",
            "description": "Limit the list to one duty.",
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "setup",
        "description": "Advisors+: create or repair organization duty roles."
      }
    ]
  },
  {
    "name": "funds",
    "description": "organization fund transaction logging.",
    "options": [
      {
        "type": 1,
        "name": "deposit",
        "description": "Record a organization fund donation.",
        "options": [
          {
            "type": 6,
            "name": "member",
            "description": "Member who donated.",
            "required": true
          },
          {
            "type": 4,
            "name": "amount",
            "description": "Amount in Septims.",
            "required": true,
            "min_value": 1
          },
          {
            "type": 3,
            "name": "note",
            "description": "Optional note."
          }
        ]
      },
      {
        "type": 1,
        "name": "spend",
        "description": "Record organization fund spending.",
        "options": [
          {
            "type": 4,
            "name": "amount",
            "description": "Amount in Septims.",
            "required": true,
            "min_value": 1
          },
          {
            "type": 3,
            "name": "note",
            "description": "What the funds were spent on.",
            "required": true
          },
          {
            "type": 6,
            "name": "paid_to",
            "description": "Optional member who received the funds."
          }
        ]
      },
      {
        "type": 1,
        "name": "set-balance",
        "description": "Set the current organization fund total with a balancing adjustment.",
        "options": [
          {
            "type": 4,
            "name": "amount",
            "description": "Current total in Septims.",
            "required": true,
            "min_value": 0
          },
          {
            "type": 3,
            "name": "note",
            "description": "Adjustment note."
          }
        ]
      },
      {
        "type": 1,
        "name": "refresh-summary",
        "description": "Move the organization fund summary to the bottom."
      },
      {
        "type": 1,
        "name": "balance",
        "description": "Show the current organization fund balance."
      },
      {
        "type": 1,
        "name": "history",
        "description": "Show recent organization fund transactions.",
        "options": [
          {
            "type": 6,
            "name": "member",
            "description": "Filter to one member."
          }
        ]
      },
      {
        "type": 1,
        "name": "undo-last",
        "description": "Undo the latest organization fund transaction."
      },
      {
        "type": 1,
        "name": "monthly",
        "description": "Show a monthly organization fund summary.",
        "options": [
          {
            "type": 4,
            "name": "year",
            "description": "Year.",
            "required": true,
            "min_value": 2020
          },
          {
            "type": 4,
            "name": "month",
            "description": "Month number.",
            "required": true,
            "min_value": 1,
            "max_value": 12
          }
        ]
      }
    ]
  },
  {
    "name": "intel",
    "description": "Trailmark intelligence bulletins.",
    "options": [
      {
        "type": 1,
        "name": "set-hq",
        "description": "Set the Trailmark used as the HQ delivery point.",
        "options": [
          {
            "type": 3,
            "name": "trailmark",
            "description": "HQ Trailmark.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "topic-add",
        "description": "Create an intel topic and report bulletin.",
        "options": [
          {
            "type": 3,
            "name": "name",
            "description": "Topic name.",
            "required": true,
            "max_length": 80
          },
          {
            "type": 3,
            "name": "keywords",
            "description": "Comma-separated keywords, such as vampire,vampires.",
            "required": true,
            "max_length": 500
          },
          {
            "type": 7,
            "name": "channel",
            "description": "Existing report channel. If omitted, Codex creates one in Intel.",
            "channel_types": [
              0,
              5
            ]
          }
        ]
      },
      {
        "type": 1,
        "name": "topic-edit",
        "description": "Add or replace keywords for an existing intel topic.",
        "options": [
          {
            "type": 3,
            "name": "topic",
            "description": "Intel topic to update.",
            "required": true,
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "keywords",
            "description": "Comma-separated keywords to add or use as the replacement list.",
            "required": true,
            "max_length": 500
          },
          {
            "type": 5,
            "name": "append",
            "description": "Append to existing keywords. Defaults to yes."
          }
        ]
      },
      {
        "type": 1,
        "name": "topic-list",
        "description": "List intel topics and HQ setup."
      },
      {
        "type": 1,
        "name": "catchall-set",
        "description": "Set or create the fallback topic for uncategorized delivered reports.",
        "options": [
          {
            "type": 3,
            "name": "topic",
            "description": "Existing intel topic to use as the catchall.",
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "name",
            "description": "Name for a new catchall topic if topic is omitted.",
            "max_length": 80
          },
          {
            "type": 7,
            "name": "channel",
            "description": "Existing report channel for a new catchall topic. If omitted, Codex creates one.",
            "channel_types": [
              0,
              5
            ]
          }
        ]
      },
      {
        "type": 1,
        "name": "catchall-clear",
        "description": "Disable future uncategorized intel capture."
      },
      {
        "type": 1,
        "name": "refresh",
        "description": "Rebuild a topic bulletin from delivered reports.",
        "options": [
          {
            "type": 3,
            "name": "topic",
            "description": "Intel topic to rebuild.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "repair-reporters",
        "description": "Repair existing report embeds and reporter names in place without reposting messages.",
        "options": [
          {
            "type": 3,
            "name": "topic",
            "description": "Topic to repair. Omit to repair all topics.",
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "backfill",
        "description": "Scan old Trailmark messages into intel topics.",
        "options": [
          {
            "type": 3,
            "name": "topic",
            "description": "Topic to backfill. Omit for all topics.",
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "mode",
            "description": "How to handle historical delivery.",
            "choices": [
              {
                "name": "Historical delivery",
                "value": "historical-delivery"
              },
              {
                "name": "Pending only",
                "value": "pending-only"
              }
            ]
          },
          {
            "type": 3,
            "name": "after",
            "description": "Only scan messages on or after YYYY-MM-DD."
          },
          {
            "type": 4,
            "name": "limit_per_trailmark",
            "description": "Maximum messages to scan per Trailmark.",
            "min_value": 1,
            "max_value": 5000
          }
        ]
      }
    ]
  },
  {
    "name": "patrol",
    "description": "Ask Codex for a patrol route.",
    "options": [
      {
        "type": 1,
        "name": "suggest",
        "description": "Cycle through patrol ideas favoring less-recently visited Trailmarks.",
        "options": [
          {
            "type": 3,
            "name": "assignment",
            "description": "Choose a Hold or leave blank for your assigned Hold.",
            "autocomplete": true
          }
        ]
      }
    ]
  },
  {
    "name": "ping",
    "description": "Check whether the Codex bot is awake."
  },
  {
    "name": "promotion",
    "description": "Promotion eligibility and voting.",
    "options": [
      {
        "type": 1,
        "name": "setup",
        "description": "Advisors+: configure the Member-only promotion channel.",
        "options": [
          {
            "type": 7,
            "name": "channel",
            "description": "Channel where promotion votes and discussion threads are posted.",
            "required": true,
            "channel_types": [
              0
            ]
          }
        ]
      },
      {
        "type": 1,
        "name": "eligible",
        "description": "Show promotion readiness, field-trial, and hold statuses."
      },
      {
        "type": 1,
        "name": "status",
        "description": "Set an Recruit's promotion progress.",
        "options": [
          {
            "type": 6,
            "name": "candidate",
            "description": "Recruit.",
            "required": true
          },
          {
            "type": 3,
            "name": "progress",
            "description": "Current promotion progress.",
            "required": true,
            "choices": [
              {
                "name": "In Field Trial",
                "value": "field_trial"
              },
              {
                "name": "On Hold",
                "value": "on_hold"
              },
              {
                "name": "Clear status",
                "value": "clear"
              }
            ]
          }
        ]
      },
      {
        "type": 1,
        "name": "open",
        "description": "Open a promotion vote.",
        "options": [
          {
            "type": 6,
            "name": "candidate",
            "description": "Candidate.",
            "required": true
          },
          {
            "type": 3,
            "name": "target_rank",
            "description": "Target rank.",
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "reason",
            "description": "Optional reason or context."
          },
          {
            "type": 8,
            "name": "mentions",
            "description": "Optional role to mention on the vote post."
          },
          {
            "type": 8,
            "name": "mentions_2",
            "description": "Optional additional role to mention."
          },
          {
            "type": 8,
            "name": "mentions_3",
            "description": "Optional additional role to mention."
          },
          {
            "type": 8,
            "name": "mentions_4",
            "description": "Optional additional role to mention."
          },
          {
            "type": 8,
            "name": "mentions_5",
            "description": "Optional additional role to mention."
          }
        ]
      },
      {
        "type": 1,
        "name": "close",
        "description": "Close a promotion vote and show results.",
        "options": [
          {
            "type": 3,
            "name": "vote",
            "description": "Open vote ID.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "approve",
        "description": "Approve a vote and promote the candidate.",
        "options": [
          {
            "type": 3,
            "name": "vote",
            "description": "Open or closed vote ID.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "deny",
        "description": "Deny a promotion vote.",
        "options": [
          {
            "type": 3,
            "name": "vote",
            "description": "Open or closed vote ID.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "ballots",
        "description": "Show who voted Yes, No, or Abstain on a promotion vote.",
        "options": [
          {
            "type": 3,
            "name": "vote",
            "description": "Vote ID.",
            "required": true,
            "autocomplete": true
          }
        ]
      }
    ]
  },
  {
    "name": "ranger",
    "description": "Roster and organization member tools.",
    "options": [
      {
        "type": 1,
        "name": "info",
        "description": "Show a Member roster entry.",
        "options": [
          {
            "type": 6,
            "name": "user",
            "description": "Member to inspect."
          }
        ]
      },
      {
        "type": 1,
        "name": "briefing",
        "description": "Collect dispatches waiting for you at Headquarters."
      },
      {
        "type": 1,
        "name": "assignments",
        "description": "Post Member leadership and hold assignments."
      },
      {
        "type": 1,
        "name": "audit",
        "description": "Check roster and Discord role drift."
      },
      {
        "type": 1,
        "name": "inactive-review",
        "description": "Show members with old or missing tracked activity.",
        "options": [
          {
            "type": 4,
            "name": "days",
            "description": "Activity age threshold.",
            "min_value": 1,
            "max_value": 365
          }
        ]
      },
      {
        "type": 1,
        "name": "sync-member",
        "description": "Refresh one member from Discord roles and display name.",
        "options": [
          {
            "type": 6,
            "name": "user",
            "description": "Member to sync."
          }
        ]
      },
      {
        "type": 1,
        "name": "sync-all",
        "description": "Sync all members with Member rank roles."
      },
      {
        "type": 1,
        "name": "sync-join-history",
        "description": "Advisors+: sync exact organization entry times from a welcome channel.",
        "options": [
          {
            "type": 7,
            "name": "channel",
            "description": "Channel containing Discord member-join messages.",
            "channel_types": [
              0
            ],
            "required": true
          }
        ]
      },
      {
        "type": 1,
        "name": "status",
        "description": "Set a Member status.",
        "options": [
          {
            "type": 6,
            "name": "user",
            "description": "Member to update.",
            "required": true
          },
          {
            "type": 3,
            "name": "status",
            "description": "New status.",
            "required": true
          }
        ]
      },
      {
        "type": 1,
        "name": "retire-left",
        "description": "Mark a roster entry Retired after the Discord user has left.",
        "options": [
          {
            "type": 3,
            "name": "discord_user_id",
            "description": "Discord user ID from the roster.",
            "required": true,
            "min_length": 17,
            "max_length": 20
          }
        ]
      },
      {
        "type": 1,
        "name": "clear-assignment",
        "description": "Leader+: remove a Hold Warden appointment, including for departed members.",
        "options": [
          {
            "type": 3,
            "name": "discord_user_id",
            "description": "Discord user ID from the roster.",
            "required": true,
            "min_length": 17,
            "max_length": 20
          }
        ]
      },
      {
        "type": 1,
        "name": "set-assignment",
        "description": "Leader+: appoint a Hold Warden as the Member of that Hold.",
        "options": [
          {
            "type": 6,
            "name": "user",
            "description": "Member to appoint.",
            "required": true
          },
          {
            "type": 3,
            "name": "assignment",
            "description": "Hold they will represent and coordinate.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "sync-assignment-roles",
        "description": "Create and sync assigned hold roles for the current roster."
      },
      {
        "type": 1,
        "name": "note",
        "description": "Set or append roster notes.",
        "options": [
          {
            "type": 6,
            "name": "user",
            "description": "Member to update.",
            "required": true
          },
          {
            "type": 3,
            "name": "note",
            "description": "Note text.",
            "required": true
          },
          {
            "type": 5,
            "name": "append",
            "description": "Append instead of replacing notes."
          }
        ]
      },
      {
        "type": 1,
        "name": "promote",
        "description": "Manually promote or assign a main Member rank.",
        "options": [
          {
            "type": 6,
            "name": "user",
            "description": "Member to promote.",
            "required": true
          },
          {
            "type": 3,
            "name": "rank",
            "description": "Target main rank.",
            "required": true,
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "reason",
            "description": "Reason for rank history."
          }
        ]
      }
    ]
  },
  {
    "name": "recruit",
    "description": "Recruitment support.",
    "options": [
      {
        "type": 1,
        "name": "invite",
        "description": "Create an onboarding invite."
      },
      {
        "type": 1,
        "name": "welcome",
        "description": "Send a recruit onboarding checklist.",
        "options": [
          {
            "type": 6,
            "name": "user",
            "description": "Recruit to welcome.",
            "required": true
          }
        ]
      }
    ]
  },
  {
    "name": "reference",
    "description": "Privately archive external rules, rulings and evidence (Advisors+).",
    "options": [
      {
        "type": 1,
        "name": "add",
        "description": "Open a private form to preserve verbatim source material.",
        "options": [
          {
            "type": 3,
            "name": "title",
            "description": "Short reference title.",
            "required": true,
            "max_length": 150
          },
          {
            "type": 3,
            "name": "category",
            "description": "Type of source.",
            "required": true
          },
          {
            "type": 3,
            "name": "source-url",
            "description": "Original message, ticket, document or image link.",
            "required": true,
            "max_length": 2000
          },
          {
            "type": 3,
            "name": "authority",
            "description": "Your classification, not automatic verification. Default: unverified."
          },
          {
            "type": 3,
            "name": "context",
            "description": "IC/OOC context, if known."
          },
          {
            "type": 3,
            "name": "confidentiality",
            "description": "Handling label; archive remains private. Default: marshal_plus."
          },
          {
            "type": 3,
            "name": "posted-at",
            "description": "Original timestamp with timezone, e.g. 2026-09-07T18:30:00Z. Omit if unknown."
          },
          {
            "type": 3,
            "name": "attachment-links",
            "description": "Supporting http(s) links, separated by whitespace.",
            "max_length": 2000
          },
          {
            "type": 3,
            "name": "supersedes",
            "description": "ID of an earlier reference this replaces (the original is preserved)."
          }
        ]
      },
      {
        "type": 1,
        "name": "view",
        "description": "Retrieve a private reference by ID.",
        "options": [
          {
            "type": 3,
            "name": "id",
            "description": "Full archived reference ID.",
            "required": true
          }
        ]
      }
    ]
  },
  {
    "name": "roster",
    "description": "Roster exports.",
    "options": [
      {
        "type": 1,
        "name": "export",
        "description": "Export the Member roster as CSV."
      }
    ]
  },
  {
    "name": "strongbox",
    "description": "Leave private reports for Advisors or higher.",
    "options": [
      {
        "type": 1,
        "name": "drop",
        "description": "Leave a private message in the HQ Strongbox.",
        "options": [
          {
            "type": 3,
            "name": "message",
            "description": "Message for Advisors or higher.",
            "required": true,
            "max_length": 4000
          },
          {
            "type": 11,
            "name": "attachment",
            "description": "Optional supporting image or file."
          }
        ]
      },
      {
        "type": 1,
        "name": "setup",
        "description": "Create or repair the Advisors+ HQ Strongbox channel."
      }
    ]
  },
  {
    "name": "trailmark",
    "description": "Trailmark cache access and administration.",
    "options": [
      {
        "type": 1,
        "name": "panel",
        "description": "Post a Trailmark access panel."
      },
      {
        "type": 1,
        "name": "leave",
        "description": "Leave your current Trailmark."
      },
      {
        "type": 1,
        "name": "list",
        "description": "List active Trailmarks."
      },
      {
        "type": 1,
        "name": "sessions",
        "description": "Show active Trailmark access sessions."
      },
      {
        "type": 1,
        "name": "report",
        "description": "Open a standardized report form for the Trailmark you are visiting.",
        "options": [
          {
            "type": 3,
            "name": "type",
            "description": "Report format.",
            "required": true,
            "choices": [
              {
                "name": "General report",
                "value": "General"
              },
              {
                "name": "Incident report",
                "value": "Incident"
              }
            ]
          },
          {
            "type": 3,
            "name": "contact",
            "description": "Optional person or group involved.",
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "contact_2",
            "description": "Optional additional person or group.",
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "contact_3",
            "description": "Optional additional person or group.",
            "autocomplete": true
          },
          {
            "type": 6,
            "name": "participant",
            "description": "Another Member who participated."
          },
          {
            "type": 6,
            "name": "participant_2",
            "description": "Another participating Member."
          },
          {
            "type": 6,
            "name": "participant_3",
            "description": "Another participating Member."
          }
        ]
      },
      {
        "type": 1,
        "name": "create",
        "description": "Create a private Trailmark channel.",
        "options": [
          {
            "type": 3,
            "name": "name",
            "description": "Trailmark name.",
            "required": true
          },
          {
            "type": 3,
            "name": "assignment",
            "description": "Hold or range.",
            "required": true,
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "location_description",
            "description": "In-character location description.",
            "required": true
          },
          {
            "type": 11,
            "name": "screenshot",
            "description": "Optional location screenshot."
          },
          {
            "type": 3,
            "name": "atlas_location_id",
            "description": "Optional future Atlas location UUID."
          }
        ]
      },
      {
        "type": 1,
        "name": "edit",
        "description": "Edit an existing Trailmark.",
        "options": [
          {
            "type": 3,
            "name": "trailmark",
            "description": "Trailmark to edit.",
            "required": true,
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "name",
            "description": "New Trailmark name."
          },
          {
            "type": 3,
            "name": "assignment",
            "description": "New hold or range.",
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "location_description",
            "description": "New in-character location description.",
            "max_length": 4000
          },
          {
            "type": 11,
            "name": "screenshot",
            "description": "Replace the location screenshot."
          },
          {
            "type": 5,
            "name": "clear_screenshot",
            "description": "Remove the current screenshot."
          },
          {
            "type": 3,
            "name": "atlas_location_id",
            "description": "Set or replace the Atlas location UUID."
          },
          {
            "type": 5,
            "name": "clear_atlas",
            "description": "Remove the Atlas location UUID."
          },
          {
            "type": 5,
            "name": "pinned",
            "description": "Pin or unpin this Trailmark at the top of the panel."
          },
          {
            "type": 3,
            "name": "patrol_primary",
            "description": "Primary Trailmark this one shares patrol activity with.",
            "autocomplete": true
          },
          {
            "type": 5,
            "name": "clear_patrol_primary",
            "description": "Stop sharing patrol activity with another Trailmark."
          }
        ]
      },
      {
        "type": 1,
        "name": "deactivate",
        "description": "Deactivate a Trailmark without deleting channel history.",
        "options": [
          {
            "type": 3,
            "name": "trailmark",
            "description": "Trailmark to deactivate.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "set-atlas",
        "description": "Set or replace a Trailmark Atlas location UUID.",
        "options": [
          {
            "type": 3,
            "name": "trailmark",
            "description": "Trailmark to update.",
            "required": true,
            "autocomplete": true
          },
          {
            "type": 3,
            "name": "atlas_location_id",
            "description": "Atlas location UUID.",
            "required": true
          }
        ]
      },
      {
        "type": 1,
        "name": "clear-atlas",
        "description": "Remove a Trailmark Atlas location UUID.",
        "options": [
          {
            "type": 3,
            "name": "trailmark",
            "description": "Trailmark to update.",
            "required": true,
            "autocomplete": true
          }
        ]
      }
    ]
  },
  {
    "name": "vote",
    "description": "Open, close, or audit a channel vote.",
    "options": [
      {
        "type": 1,
        "name": "open",
        "description": "Open an auditable binary or multiple-choice vote in this channel.",
        "options": [
          {
            "type": 3,
            "name": "format",
            "description": "Use a standard vote or open a form for multiple choices.",
            "choices": [
              {
                "name": "Yes / No / Abstain",
                "value": "binary"
              },
              {
                "name": "Multiple choice",
                "value": "choice"
              }
            ]
          },
          {
            "type": 3,
            "name": "question",
            "description": "The issue being decided. Multiple-choice votes can enter this in the form.",
            "max_length": 300
          },
          {
            "type": 3,
            "name": "context",
            "description": "Optional background or terms for the vote.",
            "max_length": 1000
          }
        ]
      },
      {
        "type": 1,
        "name": "close",
        "description": "Close a vote in this channel and preserve its final tally.",
        "options": [
          {
            "type": 3,
            "name": "vote",
            "description": "Vote ID.",
            "required": true,
            "autocomplete": true
          }
        ]
      },
      {
        "type": 1,
        "name": "audit",
        "description": "Privately export every ballot cast in a channel vote.",
        "options": [
          {
            "type": 3,
            "name": "vote",
            "description": "Vote ID.",
            "required": true,
            "autocomplete": true
          }
        ]
      }
    ]
  }
] as const;
