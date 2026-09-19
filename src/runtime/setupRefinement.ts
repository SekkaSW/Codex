import { selectionView, answerSelection, type PendingSelection } from './setupSelections.js';
import { permissionLabels, permissionTiers, type PermissionTier } from '../domain.js';
import { configuredResources, desiredResources, type ResourceSpec } from '../resources.js';
import { validateRankGraph, type StoredSetupDraft } from '../setup.js';
import { genericCommandNames } from './commands.js';
export interface RefinementPoint {
    step: string;
    page: number;
    index: number;
    group?: string;
    branch?: string;
    source?: string;
    queue: string[];
    visited: string[];
    names?: string[];
    category?: string;
    disable?: 'intelligence' | 'trailmarks';
}
export interface Refinement extends RefinementPoint {
    pending?: PendingSelection;
    newRanks?: string[];
    history: RefinementPoint[];
    editing: boolean;
    notice?: string;
    disable?: 'intelligence' | 'trailmarks';
}
export const broadSections = { identity: 'Group & Permissions', 'rank-list': 'Ranks & Progression', 'duty-list': 'Duties & Assignments', features: 'Optional Features', 'command-channel': 'Channels', review: 'Review' };
export const featureDescriptions = { briefings: 'Briefings — A place to provide briefings for missions, contracts, or optional assignments.', patrols: 'Patrol — A place to assign or propose patrols.', supply: 'Supply — A place to organize supply contracts.', atlas: 'Atlas — A resource used to keep track of important locations through a third-party interactive map. Atlas locations must be added and maintained manually by authorized members.' };
const editAreas: Record<string, Array<[
    string,
    string
]>> = { identity: [['identity', 'Group name'], ['namespace', 'Command'], ['permissions', 'Permissions']], 'rank-list': [['rank-list', 'Ranks'], ['branches', 'Progression']], 'duty-list': [['duty-list', 'Duties'], ['groups', 'Assignment Groups']], 'command-channel': [['command-channel', 'Commands'], ['log-channel', 'Admin logs'], ['core', 'Core category'], ['organization', 'Organization category'], ['intelligence', 'Intelligence'], ['trailmarks', 'Trailmarks'], ['marker', 'Private reports']] };
const featureNames = { briefings: 'Briefings', patrols: 'Patrol', supply: 'Supply', atlas: 'Atlas' } as const;
const row = (...components: any[]) => ({ type: 1, components });
export function parseSetupList(value: string): string[] {
    if (value.length > 1800)
        throw new Error('Enter a list of at most 1,800 characters.');
    const parts = value.split(',').map(s => s.trim());
    if (parts.length > 100 || parts.some(s => !s || s.length > 100))
        throw new Error('Enter up to 100 names, each 1–100 characters, without blank items or a trailing comma.');
    return parts.filter((s, index) => parts.findIndex(x => x.toLowerCase() === s.toLowerCase()) === index);
}
export function beginRefinement(d: StoredSetupDraft, editing: boolean) { d.editor ??= { section: 'identity', page: 0 }; delete d.editor.conversation; delete d.editor.selected; d.editor.section = 'identity'; d.stage = 'identity'; if (d.messageConversation) delete d.messageConversation.textPrompt; if (editing && d.config.modules) {
    d.config.modules.intelligence ??= true;
    d.config.modules.trailmarks ??= true;
} d.editor.refinement = { step: editing ? 'sections' : 'identity', page: 0, index: 0, queue: [], visited: [], history: [], editing }; }
const f = (d: StoredSetupDraft) => d.editor!.refinement!;
function move(d: StoredSetupDraft, step: string, notice?: string) { const g = f(d), { history, editing, notice: old, ...point } = g; history.push(structuredClone(point)); g.history = history.slice(-100); g.step = step; g.page = 0; if (notice)
    g.notice = notice;
else
    delete g.notice; d.stage = step === 'review' ? 'preview' : 'identity'; d.editor!.section = step === 'review' ? 'preview' : 'identity'; }
export const refinementTextSteps = ['identity', 'namespace', 'rank-list', 'duty-list', 'group-name', 'entry-list', 'branch-name', 'marker', 'channel-name', 'category-list'];
export function setupTextLimit(d: StoredSetupDraft) { return d.editor?.refinement && ['rank-list', 'duty-list', 'entry-list', 'category-list'].includes(f(d).step) ? 1800 : 100; }
function categorySpecs(d: StoredSetupDraft, category: string): ResourceSpec[] { return desiredResources({ ...d.config.modules!, intelligence: true, trailmarks: true }).filter(x => x.parent === category && !['ATLAS', 'DISPATCH_DESK'].includes(x.key)).map(x => d.organization!.additionalResources.find(r => r.key === x.key) ?? x); }
export function refinementText(d: StoredSetupDraft): string | undefined {
    const g = f(d), c = d.organization!;
    switch (g.step) {
        case 'identity': return d.config.organizationName;
        case 'namespace': return d.config.commandNamespace;
        case 'marker': return d.config.confidentialityMarker;
        case 'rank-list': return (g.names ?? c.ranks.map(x => x.name)).join(', ') || undefined;
        case 'duty-list': return [...c.duties.map(x => x.displayName), ...(d.managedDuties ?? []).map(x => x.name)].join(', ') || undefined;
        case 'entry-list': return c.entries.filter(x => x.groupId === g.group).map(x => x.name).join(', ') || undefined;
        case 'group-name': return c.groups.find(x => x.id === g.group)?.name;
        case 'branch-name': return c.branches.find(x => x.id === g.branch)?.name;
        case 'channel-name': return c.additionalResources.find(x => x.key === (g.index === 0 ? 'BOT_COMMANDS' : 'BOT_LOGS'))?.name;
        case 'category-list': return categorySpecs(d, g.category!).map(x => x.name).join(', ');
    }
    return undefined;
}
function heading(s: string) { if (['identity', 'namespace', 'permissions'].includes(s))
    return '1. Group & Permissions'; if (/^(rank|branch|progress)/.test(s))
    return '2. Ranks & Progression'; if (/^(dut|group|entry)/.test(s))
    return '3. Duties & Assignments'; if (s === 'features')
    return '4. Optional Features'; return s === 'review' ? '6. Review' : '5. Channels'; }
export function refinementSummary(d: StoredSetupDraft): string {
    const c = d.organization!, config = d.config, name = (id: string) => d.roleNames?.[id] ?? `Discord role <@&${id}>`, rank = (id: string) => c.ranks.find(x => x.id === id)?.name ?? 'Missing rank';
    const enabled = (key: 'intelligence' | 'trailmarks') => config.modules?.[key] !== false;
    const lines = ['# Review Your Setup', '', '**Group**', config.organizationName ?? 'Not set', `Command: /${config.commandNamespace ?? 'not-set'}`, '', '**Permissions**', ...permissionTiers.map(t => `${permissionLabels[t]} — ${c.permissions.filter(x => x.tier === t).map(x => name(x.roleId)).join(', ') || 'No roles selected'}`), '', '**Ranks**', ...c.ranks.map(r => `${r.name} — ${permissionLabels[r.tier]} — ${r.roleId ? name(r.roleId) : 'Choose a role'}`), '', '**Branches / Progression**'];
    for (const b of c.branches) {
        const edges = c.edges.filter(e => e.branchId === b.id);
        for (const id of new Set(edges.map(e => e.fromRankId)))
            lines.push(`${b.name}: ${rank(id)} → ${edges.filter(e => e.fromRankId === id).map(e => rank(e.toRankId)).join(' / ')}`);
    }
    lines.push('', '**Duties**', [...c.duties.map(x => x.displayName), ...(d.managedDuties ?? []).filter(x => !c.duties.some(r => r.displayName.toLowerCase() === x.name.toLowerCase())).map(x => `${x.name} (create role at confirmation)`)].join(', ') || 'None', '', '**Assignment Groups**', ...c.groups.map(g => `${g.name} — ${g.required ? 'Required' : 'Assigned as needed'}, ${g.multiple ? 'Multiple' : 'Single'}\n${c.entries.filter(e => e.groupId === g.id).map(e => e.name).join(', ') || 'No assignments'}`), '', '**Optional Features**', ...Object.entries(featureNames).map(([key, label]) => `${config.modules?.[key as keyof typeof featureNames] ? '✓' : '✗'} ${label}`), '', '**Channels & Categories**');
    const specs = configuredResources(config.modules!, c.additionalResources);
    for (const [key, label] of [['CORE_CATEGORY', 'Core'], ['ORGANIZATION_CATEGORY', 'Organization'], ['INTELLIGENCE_CATEGORY', 'Intelligence']]) {
        if (key === 'INTELLIGENCE_CATEGORY' && !enabled('intelligence'))
            continue;
        lines.push(`${label}: ${specs.filter(s => s.parent === key).map(s => `${s.name}${s.kind === 'FORUM' ? ' (Forum)' : ''}${c.resources.some(r => r.key === s.key) ? ' (existing)' : ''}`).join(', ')}`);
    }
    lines.push(`Intelligence: ${enabled('intelligence') ? 'Enabled' : 'Disabled'}`, `Trailmarks: ${enabled('trailmarks') ? 'Enabled' : 'Disabled'}`);
    for (const [key, label] of [['BOT_COMMANDS', 'Commands'], ['BOT_LOGS', 'Admin logs']])
        lines.push(`${label}: ${c.resources.find(r => r.key === key) ? `<#${c.resources.find(r => r.key === key)!.discordId}>` : c.additionalResources.find(r => r.key === key)?.name ?? 'Not chosen'}`);
    if (enabled('intelligence'))
        lines.push('', '**Private Reports**', config.confidentialityMarker ?? '[CONFIDENTIAL]');
    lines.push('', '**Atlas**', config.modules?.atlas ? `Enabled${enabled('trailmarks') ? '' : ' — Trailmark-dependent access and polling disabled'}` : 'Disabled', '', 'Only Confirm Setup applies these changes. Disabling features stops their commands and workers; historical records and channels are retained. Disabling Trailmarks closes temporary member access at confirmation.');
    return lines.join('\n');
}
export function refinementView(d: StoredSetupDraft): any {
    const selection = selectionView(d); if (selection) return selection;
    const g = f(d), c = d.organization!, s = g.step, id = (a: string) => `setup:${d.revision}:refine-${a}`, button = (a: string, label: string, style = 2) => ({ type: 2, custom_id: id(a), label, style });
    const rows: any[] = [], buttons = (...items: [
        string,
        string
    ][]) => rows.push(row(...items.map(([a, label]) => button(a, label))));
    const select = (items: Array<{
        id: string;
        name: string;
    }>, action = 'answer', multi = false) => { const page = Math.min(g.page, Math.max(0, Math.ceil(items.length / 25) - 1)), visible = items.slice(page * 25, page * 25 + 25); if (visible.length)
        rows.push(row({ type: 3, custom_id: id(action), placeholder: multi ? 'Choose one or more' : 'Choose an option', min_values: 1, max_values: multi ? visible.length : 1, options: visible.map(x => ({ label: x.name.slice(0, 100), value: x.id })) })); if (items.length > 25)
        buttons(...[...(page ? [['previous', 'Previous'] as [
                    string,
                    string
                ]] : []), ...((page + 1) * 25 < items.length ? [['next', 'Next'] as [
                    string,
                    string
                ]] : [])]); };
    const role = (multi = false) => rows.push(row({ type: 6, custom_id: id('role'), placeholder: 'Choose Discord role(s)', min_values: 1, max_values: multi ? 25 : 1 }));
    const channel = (type: number) => rows.push(row({ type: 8, custom_id: id('channel'), placeholder: 'Choose an existing channel/category', channel_types: [type], min_values: 1, max_values: 1 }));
    let text = '';
    if (s === 'sections') {
        text = 'Edit Server Configuration — choose a section. Changes stay in your draft.';
        select(Object.entries(broadSections).map(([id, name]) => ({ id, name })), 'section');
        rows.push(row(...[['view', 'View Saved'], ['repair', 'Repair'], ['advanced', 'Detailed Editor']].map(([a, label]) => ({ type: 2, custom_id: `setup:${d.revision}:${a}`, label, style: 2 }))));
    }
    else if (s === 'edit-area') {
        text = 'Choose what you would like to edit.';
        select(editAreas[g.category!]!.filter(([key]) => key !== 'marker' || d.config.modules?.intelligence !== false).map(([id, name]) => ({ id, name })), 'edit-target');
    }
    else if (s === 'identity')
        text = 'What is the name of the group you are setting up?';
    else if (s === 'namespace')
        text = 'What do you want your command to be?\nFor example: /ranger for the Ranger Corps. Send order or /order.';
    else if (s === 'permissions') {
        text = `${g.index === 0 ? 'Permission levels are not ranks. They are broad categories that determine what members can access and manage in Codex.\n\n' : ''}${permissionLabels[permissionTiers[g.index]!]}\nWhich Discord role(s) belong at this permission level? This is not a rank; it is a category for members.`;
        role(true);
        buttons(['continue', 'Done'], ['clear', 'Clear this level']);
    }
    else if (s === 'rank-list')
        text = 'Please name your ranks, separated by commas.\nExample: Aspirant, Acolyte, Guardian, Spinner. Matching names retain existing roles and identities.';
    else if (s === 'rank-list-review') {
        text = `Ranks: ${(g.names ?? []).join(', ')}\nContinue to choose a role and permission level for each. Removing names removes their draft definitions; assigned ranks cannot be removed at confirmation.`;
        buttons(['continue', 'Continue'], ['edit-list', 'Edit List']);
    }
    else if (s === 'rank-config') {
        const r = c.ranks[g.index];
        text = `${r?.name ?? 'Rank'} — ${g.index + 1} of ${c.ranks.length}\nRole: ${r?.roleId ? d.roleNames?.[r.roleId] ?? `<@&${r.roleId}>` : 'Choose a role'}\nPermission Level: ${permissionLabels[r?.tier ?? 'BASELINE']}\nChoose both below, then Continue. Rank labels describe ranks; access still follows Group & Permissions mappings.`;
        role();
        select(permissionTiers.map(t => ({ id: t, name: permissionLabels[t] })), 'tier');
        buttons(['continue', 'Continue']);
    }
    else if (s === 'branches') {
        text = 'Would you like to choose or create a branch?\nBranches are useful for groups with multiple progression paths, such as a clergy with separate Steel and Cloth branches.';
        select(c.branches, 'branch');
        buttons(['new-branch', 'Create Branch'], ['no-branches', 'No Branches']);
    }
    else if (s === 'branch-name')
        text = 'What would you like to call this branch?';
    else if (s === 'progress-start') {
        const name = c.branches.find(b => b.id === g.branch)?.name;
        text = name && name !== 'General progression' ? `What is the beginning rank for ${name}?` : 'What is the progression of ranks? Choose the starting rank.';
        select(c.ranks);
    }
    else if (s === 'progress-next') {
        text = `What rank(s) can ${c.ranks.find(r => r.id === g.source)?.name} advance to?\nChoose one or more next ranks, including alternatives at the same permission level. Continue follows selected paths; Ends Here marks the end.\nSelected: ${c.edges.filter(e => e.branchId === g.branch && e.fromRankId === g.source).map(e => c.ranks.find(r => r.id === e.toRankId)?.name).join(', ') || 'None'}`;
        select(c.ranks.filter(r => r.id !== g.source), 'answer', true);
        buttons(['continue', 'Continue'], ['end', 'Ends Here']);
    }
    else if (s === 'branch-more') {
        text = 'Would you like to create another branch?';
        buttons(['new-branch', 'Add Another Branch'], ['continue', 'Done']);
    }
    else if (s === 'duty-list') {
        text = 'What duties would you like to add, if any?\nPlease separate multiple duties with commas. Example: Loremaster, Quartermaster, Recruiter, Ambassador. Codex creates new duty roles only at final confirmation; existing mapped duties are retained.';
        buttons(['skip', 'Skip']);
    }
    else if (s === 'duty-review') {
        text = `Duties: ${[...c.duties.map(x => x.displayName), ...(d.managedDuties ?? []).map(x => x.name)].join(', ') || 'None'}`;
        buttons(['continue', 'Continue'], ['edit-list', 'Edit List']);
    }
    else if (s === 'groups') {
        text = 'Do you want Assignment Groups?\nAssignment Groups let you track members assigned to Holds, Temples, districts, ships, chapters, territories, or other locations/groups.';
        select(c.groups, 'group');
        buttons(['yes', 'Yes'], ['no', 'No']);
    }
    else if (s === 'group-name')
        text = 'What is the name of this Assignment Group?';
    else if (s === 'group-required') {
        text = 'Is this required for all members, or assigned specifically when needed?';
        buttons(['yes', 'Required for all members'], ['no', 'Assigned as needed']);
    }
    else if (s === 'group-multiple') {
        text = 'Can one member have multiple assignments in this group?';
        buttons(['yes', 'Yes'], ['no', 'No']);
    }
    else if (s === 'entry-list')
        text = 'List all assignments under this group, separated by commas.\nExample: Whiterun, Falkreath, Morthal, Winterhold, Riften. Role synchronization is available in Detailed Editor.';
    else if (s === 'group-more') {
        text = 'Would you like to add another Assignment Group?';
        buttons(['yes', 'Add Another'], ['continue', 'Done']);
    }
    else if (s === 'features') {
        text = 'Which optional features would you like to enable?\n\n' + Object.values(featureDescriptions).join('\n\n');
        rows.push(row({ type: 3, custom_id: id('features'), placeholder: 'Optional Features', min_values: 0, max_values: 4, options: Object.entries(featureNames).map(([value, label]) => ({ value, label, default: !!d.config.modules?.[value as keyof typeof featureNames] })) }));
        buttons(['continue', 'Continue']);
    }
    else if (s === 'command-channel' || s === 'log-channel') {
        text = s === 'command-channel' ? 'Where should the bot accept commands?' : 'Where should logged bot activity go for admins to review?';
        channel(0);
        buttons(['create', 'Create a new channel']);
        if (c.resources.some(r => r.key === (s === 'command-channel' ? 'BOT_COMMANDS' : 'BOT_LOGS')))
            buttons(['continue', 'Keep Existing']);
    }
    else if (s === 'channel-name')
        text = `What should the ${g.index === 0 ? 'command' : 'admin log'} channel be called?`;
    else if (['core', 'organization', 'intel-channels'].includes(s)) {
        const category = s === 'core' ? 'CORE_CATEGORY' : s === 'organization' ? 'ORGANIZATION_CATEGORY' : 'INTELLIGENCE_CATEGORY';
        text = `What channels should be in your ${s === 'core' ? 'Core' : s === 'organization' ? 'private Organization' : 'Intelligence'} category?\nRecommended: ${categorySpecs(d, category).map(x => `${x.name}${x.kind === 'FORUM' ? ' (Forum)' : ''}`).join(', ')}.\nYou may also choose an existing category. Healthy stored channels keep their names and positions.`;
        channel(4);
        buttons(['recommended', 'Use Recommended'], ['customize', 'Customize']);
    }
    else if (s === 'category-list')
        text = `Enter channel names separated by commas, in this order: ${categorySpecs(d, g.category!).map(x => `${x.name}${x.kind === 'FORUM' ? ' (Forum)' : ''}`).join(', ')}.\nNames customize these functional destinations in order. Fewer names retain the remaining defaults; extra names create additional text channels.`;
    else if (s === 'intelligence') {
        text = 'Would you like an Intelligence category?\nThis can organize reports, Contacts, and intelligence topics.';
        buttons(['yes', 'Yes'], ['no', 'No']);
    }
    else if (s === 'trailmarks') {
        text = 'Would you like to enable the Trailmark system?\nTrailmarks are private location channels with temporary member access, reports, and optional Atlas integration.';
        buttons(['yes', 'Yes'], ['no', 'No']);
    }
    else if (s === 'disable') {
        text = `Disable ${g.disable === 'intelligence' ? 'Intelligence' : 'Trailmarks'}? Its commands and background processing will stop. Historical records and Discord resources will remain. Disabling Trailmarks will close current temporary member access at final confirmation. Staff and other permanent channel permissions remain unchanged.`;
        buttons(['disable-confirm', 'Confirm Disable'], ['disable-cancel', 'Keep Enabled']);
    }
    else if (s === 'marker')
        text = "What should identify a report as something that is for your organization's eyes only?\nExample: [CONFIDENTIAL]. Using brackets like [CONFIDENTIAL] is recommended so the marker is easy to recognize.";
    else if (s === 'atlas') {
        text = d.config.modules?.atlas ? 'Atlas enabled. Codex will create the Atlas channel and enable Atlas integration for this group. Locations are maintained manually by authorized members.' + (d.config.modules.trailmarks === false ? ' Trailmarks are disabled, so their Atlas access and polling features are unavailable.' : '') : 'Atlas is disabled.';
        buttons(['continue', 'Review']);
    }
    else if (s === 'review') {
        const full = refinementSummary(d);
        return { content: full.length <= 1900 ? full : '# Review Your Setup\nThe complete human-readable review is attached. Only Confirm Setup applies changes. Disabling features retains historical records and channels.', files: [{ attachment: Buffer.from(full), name: 'setup-review.txt' }], components: [row(button('back', 'Back'), button('sections', 'Edit Section'), { type: 2, custom_id: `setup:${d.revision}:confirm`, label: 'Confirm Setup', style: 3 }, { type: 2, custom_id: `setup:${d.revision}:cancel`, label: 'Cancel', style: 4 })], allowedMentions: { parse: [] } };
    }
    if (refinementTextSteps.includes(s))
        buttons(['text', 'Reply with text']);
    rows.push(row(button('back', 'Back'), button('review', 'Review'), button('sections', 'Edit Section'), { type: 2, custom_id: `setup:${d.revision}:cancel`, label: 'Cancel', style: 4 }));
    return { content: `**${s === 'sections' ? 'Six-section setup' : heading(s)}**\n${g.notice ? g.notice + '\n\n' : ''}${text}`.slice(0, 1900), components: rows, allowedMentions: { parse: [] } };
}
export async function answerRefinement(d: StoredSetupDraft, action: string, i: any): Promise<void> {
    const g = f(d), c = d.organization!, s = g.step, values: string[] = i.values ?? [], value = values[0], answer = i.isModalSubmit() ? String(i.fields.getTextInputValue('name')).trim() : undefined, next = (step: string, notice?: string) => move(d, step, notice);
    if (await answerSelection(d, action, i)) return;
    if (action === 'back') {
        delete g.pending;
        const point = g.history.pop();
        delete g.disable;
        if (point)
            Object.assign(g, point);
        d.stage = g.step === 'review' ? 'preview' : 'identity';
        d.editor!.section = g.step === 'review' ? 'preview' : 'identity';
        g.notice = 'Your saved answers are retained. Replace a value or Keep Current.';
        return;
    }
    if (action === 'sections') {
        delete g.pending;
        next('sections');
        return;
    }
    if (action === 'review') {
        delete g.pending;
        next('review');
        return;
    }
    if (action === 'previous' || action === 'next') {
        g.page = Math.max(0, g.page + (action === 'next' ? 1 : -1));
        return;
    }
    if (action === 'section' && s === 'sections') {
        if (!value || !Object.hasOwn(broadSections, value))
            throw new Error('Choose a listed section.');
        g.index = 0;
        delete g.group;
        if (editAreas[value]) {
            g.category = value;
            next('edit-area');
        }
        else
            next(value);
        return;
    }
    if (s === 'edit-area' && action === 'edit-target') {
        if (!editAreas[g.category!]?.some(([key]) => key === value) || value === 'marker' && d.config.modules?.intelligence === false)
            throw new Error('Choose a listed setting.');
        g.index = 0;
        next(value!);
        return;
    }
    if (['identity', 'namespace', 'marker', 'branch-name', 'group-name', 'channel-name'].includes(s)) {
        if (action !== 'answer' || !answer || answer.length > 100)
            throw new Error('Enter 1–100 characters.');
        if (s === 'identity') {
            d.config.organizationName = answer;
            next('namespace', `Group name set to **${answer}**.`);
        }
        if (s === 'namespace') {
            const name = answer.replace(/^\//, '');
            if (!/^[a-z0-9_-]{1,32}$/.test(name) || (genericCommandNames.includes(name as any) && !(name === 'help' && d.config.commandNamespace === 'help')))
                throw new Error('Choose a lowercase command of 1–32 letters, digits, hyphens or underscores. This name must not conflict with a core command.');
            d.config.commandNamespace = name;
            g.index = 0;
            next('permissions', `Command set to /${name} in your setup draft.`);
        }
        if (s === 'marker') {
            d.config.confidentialityMarker = answer;
            next('atlas', `Private-report marker set to **${answer}**.`);
        }
        if (s === 'branch-name') {
            let b = c.branches.find(b => b.id === g.branch);
            if (c.branches.some(x => x.id !== b?.id && x.name.toLowerCase() === answer.toLowerCase()))
                throw new Error('Choose a unique branch name.');
            if (!b) {
                b = { id: crypto.randomUUID(), name: answer };
                c.branches.push(b);
            }
            b.name = answer;
            g.branch = b.id;
            next('progress-start', `Branch **${answer}** saved.`);
        }
        if (s === 'group-name') {
            let group = c.groups.find(x => x.id === g.group);
            if (c.groups.some(x => x.id !== group?.id && x.name.toLowerCase() === answer.toLowerCase()))
                throw new Error('Choose a unique Assignment Group name.');
            if (!group) {
                group = { id: crypto.randomUUID(), guildId: d.guildId, name: answer, multiple: false, required: false };
                c.groups.push(group);
            }
            group.name = answer;
            g.group = group.id;
            next('group-required', `Assignment Group created as **${answer}**.`);
        }
        if (s === 'channel-name') {
            const key = g.index === 0 ? 'BOT_COMMANDS' : 'BOT_LOGS';
            c.additionalResources = c.additionalResources.filter(x => x.key !== key);
            c.additionalResources.push({ key, name: answer, kind: 'CHANNEL', parent: 'CORE_CATEGORY', ...(g.index === 1 ? { minimumTier: 'LEVEL_3' as const } : {}) });
            c.resources = c.resources.filter(x => x.key !== key);
            d.resourceSelections = [...new Set([...(d.resourceSelections ?? []), key])];
            next(g.index === 0 ? 'log-channel' : 'core', `Channel creation name set to **${answer}**.`);
        }
        return;
    }
    if (s === 'permissions') {
        const tier = permissionTiers[g.index]!;
        if (action === 'continue') {
            if (g.index < 4) {
                next('permissions');
                g.index++;
            }
            else
                next('rank-list');
        }
        else if (action === 'clear') {
            c.permissions = c.permissions.filter(x => x.tier !== tier);
            g.notice = `${permissionLabels[tier]} roles cleared in the draft.`;
        }
        else if (action === 'role') {
            const roles = await i.guild.roles.fetch();
            if (!values.length || values.some(id => id === d.guildId || !roles.has(id)))
                throw new Error('Choose existing roles other than @everyone.');
            c.permissions = c.permissions.filter(x => !values.includes(x.roleId));
            c.permissions.push(...values.map(roleId => ({ guildId: d.guildId, roleId, tier })));
            d.roleNames ??= {};
            for (const id of values)
                d.roleNames[id] = roles.get(id).name;
            g.notice = `${permissionLabels[tier]} roles set to **${c.permissions.filter(x => x.tier === tier).map(x => d.roleNames?.[x.roleId] ?? 'Role').join(', ')}**.`;
        }
        else
            throw new Error('Choose roles or Done.');
        return;
    }
    if (['rank-list', 'duty-list', 'entry-list', 'category-list'].includes(s)) {
        if (s === 'duty-list' && action === 'skip') {
            next('groups', 'Existing duties retained.');
            return;
        }
        if (action !== 'answer' || !answer)
            throw new Error('Reply with comma-separated names.');
        const names = parseSetupList(answer);
        if (s === 'rank-list') {
            g.names = names;
            next('rank-list-review', `Parsed ${names.length} ranks.`);
        }
        if (s === 'duty-list') {
            d.managedDuties = names.filter(name => !c.duties.some(x => x.displayName.toLowerCase() === name.toLowerCase())).map(name => ({ id: d.managedDuties?.find(x => x.name.toLowerCase() === name.toLowerCase())?.id ?? crypto.randomUUID(), name }));
            next('duty-review', 'Duty list saved in the draft.');
        }
        if (s === 'entry-list') {
            const existing = c.entries.filter(x => x.groupId === g.group);
            c.entries = [...c.entries.filter(x => x.groupId !== g.group), ...names.map(name => ({ ...existing.find(x => x.name.toLowerCase() === name.toLowerCase()), id: existing.find(x => x.name.toLowerCase() === name.toLowerCase())?.id ?? crypto.randomUUID(), groupId: g.group!, name }))];
            next('group-more', `Assignments saved: **${names.join(', ')}**.`);
        }
        if (s === 'category-list') {
            const specs = categorySpecs(d, g.category!);
            names.forEach((name, index) => { const spec: ResourceSpec = specs[index] ?? { key: `EXTRA:${crypto.randomUUID()}`, kind: 'CHANNEL', name, parent: g.category as NonNullable<ResourceSpec['parent']>, ...(g.category === 'ORGANIZATION_CATEGORY' ? { minimumTier: 'LEVEL_1' as const } : {}) }; const extra = c.additionalResources.find(x => x.parent === g.category && x.name.toLowerCase() === name.toLowerCase() && x.key.startsWith('EXTRA:')); const chosen = index < specs.length ? spec : extra ?? spec; c.additionalResources = c.additionalResources.filter(x => x.key !== chosen.key); c.additionalResources.push({ ...chosen, name }); });
            next(g.category === 'CORE_CATEGORY' ? 'organization' : g.category === 'ORGANIZATION_CATEGORY' ? 'intelligence' : 'trailmarks', `Channel names saved: **${names.join(', ')}**.`);
        }
        return;
    }
    if (s === 'rank-list-review') {
        if (action === 'edit-list') {
            next('rank-list');
            return;
        }
        if (action !== 'continue')
            throw new Error('Choose Continue or Edit List.');
        const previousRankIds = new Set(c.ranks.map(r => r.id));
        c.ranks = g.names!.map(name => ({ ...c.ranks.find(x => x.name.toLowerCase() === name.toLowerCase()), id: c.ranks.find(x => x.name.toLowerCase() === name.toLowerCase())?.id ?? crypto.randomUUID(), guildId: d.guildId, name, tier: c.ranks.find(x => x.name.toLowerCase() === name.toLowerCase())?.tier ?? 'BASELINE' }));
        g.newRanks = [...(g.newRanks ?? []), ...c.ranks.filter(r => !previousRankIds.has(r.id)).map(r => r.id)];
        c.edges = c.edges.filter(e => c.ranks.some(r => r.id === e.fromRankId) && c.ranks.some(r => r.id === e.toRankId));
        g.index = 0;
        next('rank-config');
        return;
    }
    if (s === 'rank-config') {
        const rank = c.ranks[g.index]!;
        if (action === 'role') {
            const role = await i.guild.roles.fetch(value);
            if (!role || role.id === d.guildId || !role.editable)
                throw new Error('Choose an assignable role below the bot role.');
            rank.roleId = role.id;
            d.roleNames ??= {};
            d.roleNames[role.id] = role.name;
        }
        else if (action === 'tier') {
            if (!permissionTiers.includes(value as PermissionTier))
                throw new Error('Choose a listed permission level.');
            rank.tier = value as PermissionTier;
        }
        else if (action === 'continue') {
            if (!rank.roleId)
                throw new Error('Choose a role for this rank first.');
            const notice = `${rank.name} set to:\nRole: **${d.roleNames?.[rank.roleId] ?? 'Selected role'}**\nPermission Level: **${permissionLabels[rank.tier]}**`;
            if (g.index + 1 < c.ranks.length) {
                next('rank-config', notice);
                g.index++;
            }
            else
                next('branches', notice);
        }
        else
            throw new Error('Choose the rank role and permission level.');
        return;
    }
    if ((s === 'branches' || s === 'branch-more') && action === 'new-branch') {
        next('branch-name');
        delete g.branch;
        return;
    }
    if (s === 'branches') {
        if (action === 'branch') {
            if (!c.branches.some(x => x.id === value))
                throw new Error('Choose a branch.');
            g.branch = value!;
            next('progress-start');
        }
        else if (action === 'no-branches') {
            let b = c.branches.find(x => x.name === 'General progression');
            if (!b) {
                b = { id: crypto.randomUUID(), name: 'General progression' };
                c.branches.push(b);
            }
            g.branch = b.id;
            next('progress-start');
        }
        else
            throw new Error('Choose or create a branch, or No Branches.');
        return;
    }
    if (s === 'progress-start') {
        if (!c.ranks.some(x => x.id === value))
            throw new Error('Choose a starting rank.');
        g.source = value!;
        g.queue = [];
        g.visited = [];
        next('progress-next');
        return;
    }
    if (s === 'progress-next') {
        if (action === 'answer') {
            const pageIds = c.ranks.filter(x => x.id !== g.source).slice(g.page * 25, g.page * 25 + 25).map(x => x.id);
            if (!values.length || values.some(id => !pageIds.includes(id)))
                throw new Error('Choose other ranks on this page.');
            const edges = [...c.edges.filter(e => e.branchId !== g.branch || e.fromRankId !== g.source || !pageIds.includes(e.toRankId)), ...values.map(toRankId => ({ guildId: d.guildId, branchId: g.branch!, fromRankId: g.source!, toRankId }))];
            try {
                validateRankGraph(c.ranks.map(x => x.id), edges);
            }
            catch {
                throw new Error('Choose a progression that does not loop back to an earlier rank.');
            }
            c.edges = edges;
            g.notice = 'Next ranks saved. Continue when ready.';
            return;
        }
        if (action !== 'continue' && action !== 'end')
            throw new Error('Choose next ranks, Continue, or Ends Here.');
        if (action === 'end')
            c.edges = c.edges.filter(e => e.branchId !== g.branch || e.fromRankId !== g.source);
        const targets = c.edges.filter(e => e.branchId === g.branch && e.fromRankId === g.source).map(e => e.toRankId);
        if (action === 'continue' && !targets.length)
            throw new Error('Choose a next rank, or Ends Here.');
        g.visited = [...new Set([...g.visited, g.source!])];
        g.queue = [...new Set([...targets, ...g.queue])].filter(id => !g.visited.includes(id));
        const source = g.queue.shift();
        if (source) {
            next('progress-next');
            g.source = source;
        }
        else
            next(c.branches.find(x => x.id === g.branch)?.name === 'General progression' ? 'duty-list' : 'branch-more', 'Progression saved.');
        return;
    }
    if (s === 'branch-more' && action === 'continue') {
        next('duty-list');
        return;
    }
    if (s === 'duty-review') {
        if (!['edit-list', 'continue'].includes(action))
            throw new Error('Choose Continue or Edit List.');
        next(action === 'edit-list' ? 'duty-list' : 'groups');
        return;
    }
    if (s === 'groups' || s === 'group-more') {
        if (action === 'group') {
            if (!c.groups.some(x => x.id === value))
                throw new Error('Choose a group.');
            g.group = value!;
            next('group-name');
        }
        else if (action === 'yes') {
            next('group-name');
            delete g.group;
        }
        else if (action === 'no' || action === 'continue')
            next('features', 'Existing Assignment Groups retained.');
        else
            throw new Error('Choose Yes, No, or an existing group.');
        return;
    }
    if (s === 'group-required' || s === 'group-multiple') {
        if (!['yes', 'no'].includes(action))
            throw new Error('Choose a listed option.');
        const group = c.groups.find(x => x.id === g.group)!;
        if (s === 'group-required') {
            group.required = action === 'yes';
            next('group-multiple');
        }
        else {
            group.multiple = action === 'yes';
            next('entry-list');
        }
        return;
    }
    if (s === 'features') {
        if (action === 'features') {
            if (values.some(v => !Object.hasOwn(featureNames, v)))
                throw new Error('Choose listed optional features.');
            d.config.modules = { ...d.config.modules!, briefings: values.includes('briefings'), patrols: values.includes('patrols'), supply: values.includes('supply'), atlas: values.includes('atlas') };
            g.notice = `Enabled: ${values.map(v => featureNames[v as keyof typeof featureNames]).join(', ') || 'None'}.`;
        }
        else if (action === 'continue')
            next('command-channel');
        else
            throw new Error('Choose features or Continue.');
        return;
    }
    if (s === 'command-channel' || s === 'log-channel') {
        const key = s === 'command-channel' ? 'BOT_COMMANDS' : 'BOT_LOGS';
        g.index = s === 'command-channel' ? 0 : 1;
        if (action === 'create') {
            next('channel-name');
            return;
        }
        if (action === 'channel')
            await bindChannel(d, i, value, key, 'CHANNEL');
        else if (action !== 'continue' || !c.resources.some(x => x.key === key))
            throw new Error('Choose an existing channel or create a new one.');
        next(s === 'command-channel' ? 'log-channel' : 'core', 'Channel choice saved.');
        return;
    }
    if (['core', 'organization', 'intel-channels'].includes(s)) {
        g.category = s === 'core' ? 'CORE_CATEGORY' : s === 'organization' ? 'ORGANIZATION_CATEGORY' : 'INTELLIGENCE_CATEGORY';
        if (action === 'channel') {
            await bindChannel(d, i, value, g.category as ResourceSpec['key'], 'CATEGORY');
            g.notice = 'Existing category selected.';
        }
        else if (action === 'customize')
            next('category-list');
        else if (action === 'recommended')
            next(s === 'core' ? 'organization' : s === 'organization' ? 'intelligence' : 'trailmarks');
        else
            throw new Error('Choose recommended channels or customize.');
        return;
    }
    if (s === 'intelligence' || s === 'trailmarks') {
        if (!['yes', 'no'].includes(action))
            throw new Error('Choose Yes or No.');
        if (action === 'no' && g.editing && d.config.modules![s] !== false) {
            g.disable = s;
            next('disable');
            return;
        }
        d.config.modules![s] = action === 'yes';
        next(s === 'intelligence' ? (action === 'yes' ? 'intel-channels' : 'trailmarks') : (d.config.modules!.intelligence !== false ? 'marker' : 'atlas'));
        return;
    }
    if (s === 'disable') {
        if (!['disable-confirm', 'disable-cancel'].includes(action) || !g.disable)
            throw new Error('Confirm disabling or keep enabled.');
        const feature = g.disable;
        d.config.modules![feature] = action !== 'disable-confirm';
        delete g.disable;
        next(feature === 'intelligence' ? (d.config.modules!.intelligence ? 'intel-channels' : 'trailmarks') : (d.config.modules!.intelligence !== false ? 'marker' : 'atlas'));
        return;
    }
    if (s === 'atlas' && action === 'continue') {
        next('review');
        return;
    }
    throw new Error('This setup question changed. Resume setup.');
}
async function bindChannel(d: StoredSetupDraft, i: any, value: string | undefined, key: ResourceSpec['key'], kind: ResourceSpec['kind']) { const channel = value ? await i.guild.channels.fetch(value) : undefined; if (!channel || channel.type !== (kind === 'CATEGORY' ? 4 : kind === 'FORUM' ? 15 : 0))
    throw new Error('Choose an existing destination of the requested type.'); const c = d.organization!; if (c.resources.some(r => r.discordId === value && r.key !== key))
    throw new Error('Choose a destination not already assigned to another purpose.'); c.resources = c.resources.filter(r => r.key !== key); c.resources.push({ guildId: d.guildId, key, discordId: channel.id, kind }); d.resourceSelections = [...new Set([...(d.resourceSelections ?? []), key])]; }
export function humanSetupCopy(text: string): string { for (const [key, label] of Object.entries(permissionLabels))
    text = text.replaceAll(key, label); return text.replace(/Optional Modules/g, 'Optional Features').replace(/modules/gi, 'features').replace(/Managed Resources/g, 'Channels & Categories'); }
