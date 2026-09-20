import { audienceName } from './userCopy.js';
/** Curated display copy. Keys and native input contracts are deliberately left intact. */
const descriptions: Record<string, Record<string, string>> = {
 mentorship:{propose:'Propose yourself as mentor to the selected member.',sponsor:'Save a mentorship sponsorship for private Advisors review.',assign:'Advisors+: pair a mentor and apprentice directly.'},
 roster:{info:'View a member’s roster record.',assignments:'View a member’s configured assignments.',audit:'Export a member’s administration audit.', 'inactive-review':'List roster members whose status is not Active.','sync-member':'Save a member’s current Discord name and membership state.','sync-all':'Synchronize a page of known and newly discovered members.','sync-join-history':'Save a member’s current Discord join date.',status:'Change a member’s saved status and synchronize configured roles.','retire-left':'Retire a page of roster members already marked Left.',note:'Append an authored note to a member’s record.',notes:'Export authored notes; Discord Administrator required.',promote:'Choose an eligible next rank from the configured progression.',rank:'Initialize or correct a rank; Discord Administrator required.',export:'Export the roster as CSV.'},
 organization:{'sync-member':'Save a member’s current Discord name and membership state.','sync-all':'Synchronize known members and import members with configured roles.','sync-join-history':'Inspect up to 5,000 welcome messages for known members’ join dates.',assignments:'Refresh the board of configured ranks, duties and member assignments.','set-assignment':'Advisors+: assign a configured entry to a member.','clear-assignment':'Advisors+: remove a configured member assignment.','sync-assignment-roles':'Synchronize existing configured roles for the current roster.',note:'Append an authored roster note; existing notes are preserved.',promote:'Promote an active member along a configured progression edge.'},
 advancement:{setup:'Discord Administrator: configure the promotion channel.',status:'Save a candidate’s promotion progress.',close:'Close voting and show results; this does not approve a promotion.',approve:'Approve an eligible case and apply the candidate’s promotion.'},
 funds:{deposit:'Advanced Member+: record an organization fund donation.',spend:'Advanced Member+: record organization spending.','set-balance':'Advanced Member+: record an adjustment to the target balance.','undo-last':'Advanced Member+: reverse the latest unreversed ledger entry.','refresh-summary':'Advanced Member+: refresh the existing summary from the saved ledger.',monthly:'Summarize a UTC calendar month.'},
 intel:{'topic-list':'List configured topics in classification order.','catchall-clear':'Restore the managed catch-all destination for uncategorized reports.',refresh:'Rebuild a topic bulletin from saved reports delivered to HQ.','repair-reporters':'Repair recognized bot report embeds in place; missing deliveries are reported.',backfill:'Retry saved reports awaiting delivery; does not import old Discord messages.',reports:'Browse saved reports available to you.',deliver:'Select a report for HQ delivery while you have active HQ access.','link-report':'Select a saved report and change its Contact links.','recover-delivery':'Bind an uncertain delivery to its original bot message after verification.'},
 contact:{edit:'Advisors+: edit an individual or group Contact.',list:'Advisors+: list people and groups, including archived records.','link-member':'Advisors+: add a person Contact to an existing group.','unlink-member':'Advisors+: remove a person Contact from an existing group.',repair:'Advisors+: repair Contacts resources and a page of individual Contact threads.','group-members':'Advisors+: select an existing group and change its Contact links.'},
 duty:{assign:'Advisors+: assign a configured duty to a member.',remove:'Advisors+: remove a configured duty from a member.',setup:'Show where to configure duties; new roles require final setup confirmation.'},
 application:{apply:'Open an application for a configured duty.',list:'Browse your applications.',setup:'Advisors+: configure the private application review channel.',review:'Advisors+: browse applications for review.',approve:'Advisors+: approve a selected application.',deny:'Advisors+: deny a selected application.'},
 strongbox:{setup:'Verify the configured private review and public receipt destinations.',submit:'Open a private Strongbox submission form.',history:'Browse your submissions and recover their delivery.',review:'Advisors+: browse private submissions.',process:'Advisors+: mark a selected submission processed.',reject:'Advisors+: mark a selected submission rejected.'},
 assignment:{create:'Advisors+: open a form to create a board task.',open:'Advisors+: open the compatibility form for a board task.',claim:'Select a board task to join.',unclaim:'Select a board task to leave.',close:'Advisors+: mark a board task complete.',cancel:'Advisors+: cancel a board task.',list:'Browse saved board tasks.','set-member':'Advisors+: choose a configured assignment for a roster member.','clear-member':'Advisors+: remove a configured assignment from a roster member.','sync-roles':'Advisors+: synchronize a member’s configured Discord roles.'},
 reference:{get:'Select a shared reference entry to read.',list:'Browse shared reference entries.',edit:'Advisors+: create or update a shared reference by lookup key.'},
 vote:{cast:'Select an open poll and cast your ballot.',list:'Browse saved polls and results.'},
 patrol:{suggest:'Suggest a route through eligible Trailmarks; no assignment is created.',list:'Browse saved compatibility patrol suggestions.',resolve:'Advisors+: resolve a saved compatibility patrol suggestion.'},
 briefing:{history:'Browse saved briefings available to your audience.'},
 atlas:{link:'Create a ten-minute code to link your trusted Atlas account.',unlink:'Unlink your Atlas identity and cancel pending requests.',status:'View your Atlas link status and Trailmark dependencies.'},
 alliance:{setup:'Configure an authorized cross-server bridge or trusted legacy intake.',sync:'Retry queued transfers that are allowed by both servers.',status:'Inspect bridges, topic mappings and delivery counts.','group-add':'Add or update a group of bridge topic mappings.','group-topics':'Edit a bridge’s local-to-remote topic mappings.','group-remove':'Remove a topic mapping group; keep the bridge and report history.','headquarters-remove':'Disable a bridge; keep its private channel and report history.','archive-category':'Retain a legacy category and restrict it to staff.'},
 trailmark:{hq:'Select the Trailmark used as Headquarters.',repair:'Select a Trailmark whose Discord channel needs repair.',configure:'Select a Trailmark to edit its access level or session duration.'}
};
export function applyCommandCopy(definitions: any[], namespace?: string): any[] {
 for(const c of definitions){
  const system=c.name===namespace?'organization':c.name==='promotion'?'advancement':c.name==='apprenticeship'?'mentorship':c.name;
  if(system==='atlas')c.description='Link your Atlas account and inspect map-access status.';
  if(system==='funds')c.description='Organization fund transactions and summaries.';
  if(system==='trailmark')c.description='Temporary Trailmark access, reports and administration.';
  for(const s of c.options??[]){
   if(s.type!==1)continue;
   if(descriptions[system]?.[s.name])s.description=descriptions[system]![s.name];
   if(s.name==='panel'&&system!=='trailmark')s.description='Open optional shortcuts for your available actions.';
   for(const o of s.options??[]){
    if(system==='funds'&&o.name==='amount')o.description=s.name==='set-balance'?'Target balance in your organization’s currency.':'Positive whole-number amount in your organization’s currency.';
    if(system==='funds'&&o.name==='month')o.description='UTC calendar month, 1–12.';
    if(system==='contact'&&o.name==='assignment')o.description=s.name==='list'?'Filter by a configured member assignment.':'Configured assignment associated with this Contact.';
    if(system==='trailmark'&&o.name==='assignment')o.description='Configured assignment associated with this Trailmark.';
    if(system==='trailmark'&&o.name==='atlas_location_id')o.description='Identifier of an existing Atlas location; does not create a map location.';
    if(system==='assignment'&&o.name==='assignment')o.description='Optional configured member assignment associated with this board task.';
    if(system==='patrol'&&o.name==='assignment')o.description='Configured assignment; defaults to your first saved assignment.';
    if(system==='organization'&&o.name==='assignment')o.description='Configured member assignment.';
    if(system==='organization'&&o.name==='append')o.description='Omit or choose true. Replacing authored notes is not supported.';
    if(system==='mentorship'&&s.name==='propose'&&o.name==='member')o.description='Member you propose to mentor.';
    if(system==='organization'&&o.name==='rank')o.description='Eligible next rank from configured progression.';
    if(system==='reference'&&o.name==='confidentiality')o.description='Handling label; archive access remains restricted. Default: Advisors+.';
    if(system==='intel'&&s.name==='backfill')o.description=({after:'Only saved reports captured on or after YYYY-MM-DD.',limit_per_trailmark:'Maximum saved reports to examine per Trailmark (1–5,000).',mode:'Saved-report retry mode; historical Discord import is unavailable.',topic:'Filter saved report retries to a topic; omit for all topics.'} as Record<string,string>)[o.name]??o.description;
    if(system==='supply'&&/^(item|quantity|quota)(?:_[1-4])?$/.test(o.name)){
     const n=o.name.match(/_(\d)$/)?.[1]??'1',kind=o.name.startsWith('item')?'Item':o.name.startsWith('quota')?'Quota':'Quantity';
     o.description=kind==='Item'?`Item ${n}; supply its matching ${s.name==='create'?'quota':'quantity'}.`:`${kind} for item ${n}; whole number 1–1,000,000,000. Supply both together.`;
    }
    if(system==='briefing'&&o.name==='audience')for(const choice of o.choices??[])choice.name=choice.value==='apprentice_plus'?'Recruit+ audience (collection requires Member+)':audienceName(choice.value);
   }
  }
 }
 return definitions;
}
