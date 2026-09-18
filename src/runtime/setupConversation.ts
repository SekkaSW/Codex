import { permissionTiers } from '../domain.js';
import { configuredResources, type ResourceSpec } from '../resources.js';
import type { StoredSetupDraft } from '../setup.js';
import { validateRankGraph } from '../setup.js';
import { textModal } from './interactions.js';

type Draft = StoredSetupDraft;
export const setupSections = {
    identity: 'Organization', permissions: 'Permissions', ranks: 'Ranks', branches: 'Branches & progression',
    duties: 'Duties', groups: 'Assignments', modules: 'Modules', resources: 'Channels', integration: 'Confidentiality', atlas: 'Atlas',
};
const row = (...components: any[]) => ({ type: 1, components });
const option = (name: string, value: string) => ({ label: name.slice(0, 100), value });
export function beginConversation(d: Draft, step = 'identity'): void {
    d.editor ??= { section: 'identity', page: 0 };
    d.editor.conversation = { step, index: 0, history: [] };
    delete d.editor.selected;
}
export function conversationResources(d: Draft): ResourceSpec[] {
    return [
        { key: 'BOT_COMMANDS', name: 'Command destination', kind: 'CHANNEL', parent: 'CORE_CATEGORY' },
        { key: 'BOT_LOGS', name: 'Log destination', kind: 'CHANNEL', parent: 'CORE_CATEGORY', minimumTier: 'LEVEL_3' },
        ...configuredResources(d.config.modules ?? { atlas: false, supply: false, patrols: false, briefings: false }, d.organization!.additionalResources).filter(r => !['BOT_COMMANDS', 'BOT_LOGS'].includes(r.key)),
    ];
}
function current(d: Draft) { return d.editor!.conversation!; }
function move(d: Draft, step: string): void {
    const g = current(d);
    g.history.push({ step: g.step, index: g.index, ...(d.editor!.selected ? { selected: d.editor!.selected } : {}), ...(g.group ? { group: g.group } : {}), ...(g.branch ? { branch: g.branch } : {}) });
    // Navigation history is bounded; the section editor always remains available.
    g.history = g.history.slice(-100);
    g.step = step;
    d.editor!.page = 0;
}
function skipTo(d: Draft): string | undefined {
    const s = current(d).step;
    return ({ ranks: 'branches', branches: 'duties', duties: 'groups', groups: 'modules', 'rank-branch': 'rank-more', 'entry-role': 'entry-more' } as Record<string, string>)[s];
}
export function conversationView(d: Draft): any {
    const g = current(d), c = d.organization!, e = d.editor!, s = g.step;
    const id = (a: string) => `setup:${d.revision}:guide-${a}`;
    const button = (a: string, label: string, style = 2) => ({ type: 2, custom_id: id(a), label, style });
    const rows: any[] = [];
    const buttons = (...items: Array<[string, string]>) => rows.push(row(...items.map(([a, label]) => button(a, label))));
    const select = (items: Array<{ id: string; name: string }>, placeholder: string, multi = false) => {
        const page = Math.max(0, Math.min(e.page, Math.max(0, Math.ceil(items.length / 25) - 1)));
        const visible = items.slice(page * 25, page * 25 + 25);
        if (visible.length) rows.push(row({ type: 3, custom_id: id('answer'), placeholder, options: visible.map(x => option(x.name, x.id)), min_values: 1, max_values: multi ? visible.length : 1 }));
        if (items.length > 25) rows.push(row(...[...(page ? [button('previous', 'Previous')] : []), ...((page + 1) * 25 < items.length ? [button('next', 'Next')] : [])]));
    };
    const role = (multi = false) => rows.push(row({ type: 6, custom_id: id('answer'), placeholder: 'Choose a role', min_values: 1, max_values: multi ? 25 : 1 }));
    const text: Record<string, string> = {
        identity: 'Organization Name', namespace: 'What should the organization command namespace be?',
        ranks: 'Would you like to configure a rank?', 'rank-name': 'What is this rank called?', 'rank-role': 'Which Discord role belongs to this rank?',
        'rank-tier': 'Which permission tier describes this rank? This is metadata; access is controlled by your permission-role mappings.',
        'rank-branch': 'Should this rank be part of progression? Choose a branch, or Skip for a standalone rank. Explicit advancement edges are configured next.',
        'rank-more': 'Would you like to add another rank?', branches: 'Would you like to configure explicit rank progression?',
        'branch-name': 'What is this progression branch called?', 'edge-from': 'Select the rank that advances FROM.',
        'edge-to': 'Select one or more ranks it may advance TO. Add more on another page if needed.', 'edge-more': 'Would you like to add more progression?',
        duties: 'Would you like to configure Duties? Duties are independent of ranks.', 'duty-role': 'Choose an existing duty role.', 'duty-name': 'What friendly name should this duty use?', 'duty-more': 'Would you like to add another duty?',
        groups: 'Would you like to configure an assignment group?', 'group-name': 'Assignment Group Name', 'group-required': 'Must active members have an assignment in this group?',
        'group-multiple': 'Can a member belong to more than one entry in this group?', 'group-sync': 'Should entries in this group synchronize Discord roles?',
        'entry-name': 'What is this assignment entry called?', 'entry-role': 'Choose the Discord role for this entry.', 'entry-more': 'Would you like to add another entry?', 'group-more': 'Would you like to add another assignment group?',
        modules: 'Which optional modules should be enabled? Briefings publishes dispatches; Patrol suggests Trailmarks; Supply tracks contributions; Atlas links map access.',
        integration: 'What marker should keep reports local and prevent cross-server transfer?',
        'resource-name': 'What name should this resource use when it is first created? Existing resources keep their current name.',
        atlas: d.config.modules?.atlas ? 'Atlas is enabled. Members can link their account using /atlas panel. Map access follows Trailmark eligibility. This wizard needs no browser credentials.' : 'Atlas is disabled. Enable it in Modules whenever you need map integration.',
        sections: 'Edit Server Configuration — choose a section. Changes stay in your draft until Confirm Setup.',
    };
    let question = text[s] ?? 'Continue setup';
    if (['identity', 'namespace', 'rank-name', 'branch-name', 'duty-name', 'group-name', 'entry-name', 'resource-name', 'integration'].includes(s)) {
        buttons(['text', s === 'identity' ? 'Enter Organization Name' : s === 'namespace' ? 'Enter Namespace' : 'Enter value']);
        if (s === 'integration') buttons(['default', 'Use [CONFIDENTIAL]']);
    } else if (s === 'permissions') {
        question = `Select the role or roles that should have **${permissionTiers[g.index]}** permissions. Permission tiers control authorization and are separate from rank progression. Higher tiers include lower tiers.`;
        role(true); buttons(['continue', 'Done'], ['clear', 'Clear this tier']);
    } else if (['rank-role', 'duty-role', 'entry-role'].includes(s)) role();
    else if (s === 'rank-tier') select(permissionTiers.map(t => ({ id: t, name: t })), 'Choose a tier');
    else if (s === 'rank-branch' || s === 'branches') {
        select(c.branches, 'Choose a branch'); buttons(['new-branch', 'Add Branch']);
    } else if (s === 'edge-from') select(c.ranks, 'Choose the source rank');
    else if (s === 'edge-to') select(c.ranks.filter(r => r.id !== e.selected), 'Choose target ranks', true);
    else if (s === 'ranks') { select(c.ranks, 'Edit an existing rank'); buttons(['add', 'Add Rank'], ['continue', 'Done']); }
    else if (s === 'duties') { select(c.duties.map(x => ({ id: x.roleId, name: x.displayName })), 'Edit a duty'); buttons(['add', 'Add Duty'], ['continue', 'Done']); }
    else if (s === 'groups') { select(c.groups, 'Edit an assignment group'); buttons(['add', 'Add Group'], ['continue', 'Done']); }
    else if (['group-required', 'group-multiple', 'group-sync'].includes(s)) buttons(['yes', 'Yes'], ['no', 'No']);
    else if (s === 'modules') rows.push(row({ type: 3, custom_id: id('answer'), placeholder: 'Enabled modules', min_values: 0, max_values: 4, options: Object.entries({ briefings: 'Briefings', patrols: 'Patrol', supply: 'Supply', atlas: 'Atlas' }).map(([k, v]) => ({ ...option(v, k), default: !!d.config.modules?.[k as keyof typeof d.config.modules] })) }));
    else if (s === 'resources') {
        const spec = conversationResources(d)[g.index];
        question = spec ? `Where should **${spec.name}** be? ${c.resources.some(r => r.key === spec.key) ? 'A saved destination is already bound. Continue keeps its identity and layout.' : 'Choose an existing resource or create it with the suggested name at final confirmation.'}` : 'Resource choices are complete.';
        if (spec) rows.push(row({ type: 8, custom_id: id('answer'), placeholder: `Choose existing ${spec.kind.toLowerCase()}`, channel_types: [spec.kind === 'CATEGORY' ? 4 : spec.kind === 'FORUM' ? 15 : 0], min_values: 1, max_values: 1 }));
        buttons(['continue', spec && c.resources.some(r => r.key === spec.key) ? 'Keep Existing' : 'Create at Confirmation']);
        if (spec && !c.resources.some(r => r.key === spec.key)) buttons(['custom-name', 'Choose Creation Name']);
    } else if (s === 'rank-more') buttons(['add', 'Add Another'], ['continue', 'Done']);
    else if (s === 'duty-more') buttons(['add', 'Add Another'], ['continue', 'Done']);
    else if (s === 'entry-more') buttons(['add', 'Add Another'], ['continue', 'Done']);
    else if (s === 'group-more') buttons(['add', 'Add Another'], ['continue', 'Done']);
    else if (s === 'edge-more') buttons(['add', 'Add More Targets'], ['from', 'Choose Another Source'], ['continue', 'Done']);
    else if (s === 'sections') select(Object.entries(setupSections).map(([id, name]) => ({ id, name })), 'Edit Section');
    else buttons(['continue', 'Continue']);
    const nav = [button('back', 'Back'), ...(skipTo(d) ? [button('skip', 'Skip')] : []), button('review', 'Review'), button('sections', 'Edit Section'), { type: 2, custom_id: `setup:${d.revision}:cancel`, label: 'Cancel', style: 4 }];
    rows.push(row(...nav));
    return { content: `${g.notice ? `${g.notice}\n\n` : ''}**${question}**`.slice(0, 1900), components: rows, allowedMentions: { parse: [] } };
}

/** Edits only the existing durable draft; production is changed by SetupWizard.confirm. */
export async function answerConversation(d: Draft, action: string, i: any): Promise<'modal' | 'save'> {
    const g = current(d), c = d.organization!, e = d.editor!, s = g.step;
    const value = i.values?.[0], answer = i.isModalSubmit() ? i.fields.getTextInputValue('name').trim() : value;
    const next = (step: string, notice?: string) => { move(d, step); if (notice) g.notice = notice; else delete g.notice; };
    if (action === 'text') {
        const existing = s === 'identity' ? d.config.organizationName : s === 'namespace' ? d.config.commandNamespace : s === 'integration' ? d.config.confidentialityMarker : s === 'duty-name' ? c.duties.find(x => x.roleId === e.selected)?.displayName : undefined;
        await i.showModal(textModal(`setup:${d.revision}:guide-answer`, s === 'identity' ? 'Organization Name' : s === 'namespace' ? 'Command Namespace' : 'Setup', [{ id: 'name', label: s === 'integration' ? 'Confidentiality marker' : 'Name', max: s === 'namespace' ? 32 : 100, ...(existing ? { value: existing } : {}) }]));
        return 'modal';
    }
    if (action === 'back') {
        const previous = g.history.pop();
        if (previous) { g.step = previous.step; g.index = previous.index; if (previous.group) g.group = previous.group; else delete g.group; if (previous.branch) g.branch = previous.branch; else delete g.branch; if (previous.selected) e.selected = previous.selected; else delete e.selected; e.page = 0; }
        g.notice = 'Previous question. Your saved answers are retained until you replace them.';
        return 'save';
    }
    if (action === 'sections') { next('sections'); return 'save'; }
    if (action === 'review') { move(d, g.step); e.section = 'preview'; d.stage = 'preview'; return 'save'; }
    if (action === 'previous' || action === 'next') { e.page = Math.max(0, e.page + (action === 'next' ? 1 : -1)); return 'save'; }
    if (action === 'skip') { const target = skipTo(d); if (!target) throw new Error('This question needs an answer before continuing.'); next(target, 'Optional question skipped. Existing settings are retained.'); return 'save'; }
    if (s === 'sections') { if (!(value in setupSections)) throw new Error('Choose a listed section.'); g.index = 0; delete e.selected; next(value); return 'save'; }
    if (action === 'new-branch') { next('branch-name'); return 'save'; }
    if (action === 'custom-name' && s === 'resources') { next('resource-name'); return 'save'; }
    if (s === 'identity' || s === 'namespace' || s.endsWith('-name') || s === 'integration') {
        const name = action === 'default' && s === 'integration' ? '[CONFIDENTIAL]' : answer;
        if (typeof name !== 'string' || !name.trim() || name.length > 100) throw new Error('Enter a name between 1 and 100 characters.');
        if (s === 'identity') { d.config.organizationName = name; next('namespace', `Organization Name set to **${name}**.`); }
        else if (s === 'namespace') {
            if (!/^[a-z0-9_-]{1,32}$/.test(name) || ((await import('./commands.js')).genericCommandNames.includes(name as any) && !(name === 'help' && d.config.commandNamespace === 'help'))) throw new Error('Choose 1–32 lowercase letters, digits, hyphens or underscores, without using a core command name.');
            d.config.commandNamespace = name; g.index = 0; next('permissions', `Command namespace set to **/${name}**.`);
        } else if (s === 'integration') { d.config.confidentialityMarker = name; next('atlas', `Confidentiality marker set to **${name}**.`); }
        else if (s === 'resource-name') {
            const spec = conversationResources(d)[g.index]!;
            c.additionalResources = c.additionalResources.filter(r => r.key !== spec.key);
            c.additionalResources.push({ ...spec, name });
            next('resources', `Creation name set to **${name}**. Continue to keep this choice.`);
        } else if (s === 'rank-name') {
            let rank = c.ranks.find(r => r.id === e.selected);
            if (!rank) { rank = { id: crypto.randomUUID(), guildId: d.guildId, name, tier: 'BASELINE' }; c.ranks.push(rank); }
            rank.name = name; e.selected = rank.id; next('rank-role', `Rank name set to **${name}**.`);
        } else if (s === 'branch-name') {
            let branch = c.branches.find(b => b.name === name);
            if (!branch) { branch = { id: crypto.randomUUID(), name }; c.branches.push(branch); }
            g.branch = branch.id; next(g.history.some(h => h.step === 'rank-branch') && g.history.at(-1)?.step === 'rank-branch' ? 'rank-more' : 'edge-from', `Branch **${name}** saved. Explicit edges determine progression.`);
        } else if (s === 'duty-name') { c.duties.find(x => x.roleId === e.selected)!.displayName = name; next('duty-more', `Duty **${name}** saved.`); }
        else if (s === 'group-name') {
            let group = c.groups.find(x => x.id === g.group);
            if (!group) { group = { id: crypto.randomUUID(), guildId: d.guildId, name, multiple: false, required: false }; c.groups.push(group); }
            group.name = name; g.group = group.id; next('group-required', `Assignment group **${name}** saved.`);
        } else if (s === 'entry-name') {
            let entry = c.entries.find(x => x.id === e.selected && x.groupId === g.group);
            if (!entry) { entry = { id: crypto.randomUUID(), groupId: g.group!, name }; c.entries.push(entry); }
            entry.name = name; e.selected = entry.id; next(g.sync ? 'entry-role' : 'entry-more', `Entry **${name}** saved.`);
        }
    } else if (s === 'permissions') {
        const tier = permissionTiers[g.index]!;
        if (action === 'clear') { c.permissions = c.permissions.filter(p => p.tier !== tier); g.notice = `${tier} role mappings cleared in this draft.`; }
        else if (action === 'continue') { if (g.index < 4) { move(d, 'permissions'); g.index++; } else next('ranks'); }
        else {
            const roles = await i.guild.roles.fetch();
            if (i.values.some((id: string) => id === d.guildId || !roles.has(id))) throw new Error('That role no longer exists or is @everyone. Choose another role.');
            c.permissions = c.permissions.filter(p => !i.values.includes(p.roleId));
            c.permissions.push(...i.values.map((roleId: string) => ({ guildId: d.guildId, roleId, tier })));
            g.notice = `${tier} roles set to **${c.permissions.filter(p => p.tier === tier).map(p => roles.get(p.roleId)?.name ?? 'Missing role').join(', ')}**. Choose more roles, or Done.`;
        }
    } else if (['rank-role', 'duty-role', 'entry-role'].includes(s)) {
        const role = await i.guild.roles.fetch(value);
        if (!role || role.id === d.guildId || !role.editable) throw new Error('Choose an assignable role below the bot role.');
        if (s === 'rank-role') { c.ranks.find(r => r.id === e.selected)!.roleId = value; next('rank-tier', `Rank role set to **${role.name}**.`); }
        else if (s === 'duty-role') { if (!c.duties.some(x => x.roleId === value)) c.duties.push({ guildId: d.guildId, roleId: value, displayName: role.name }); e.selected = value; next('duty-name', `Duty role set to **${role.name}**.`); }
        else { c.entries.find(x => x.id === e.selected)!.roleId = value; next('entry-more', `Entry role set to **${role.name}**.`); }
    } else if (s === 'rank-tier') { if (!permissionTiers.includes(value)) throw new Error('Choose a listed permission tier.'); c.ranks.find(r => r.id === e.selected)!.tier = value; next('rank-branch', `Rank tier set to **${value}**.`); }
    else if (s === 'rank-branch' || s === 'branches') { if (!c.branches.some(b => b.id === value)) throw new Error('Choose an existing branch.'); g.branch = value; next(s === 'rank-branch' ? 'rank-more' : 'edge-from', `Branch **${c.branches.find(b => b.id === value)!.name}** selected. Progression is defined by edges.`); }
    else if (s === 'edge-from') { if (!c.ranks.some(r => r.id === value)) throw new Error('Choose an existing rank.'); e.selected = value; next('edge-to'); }
    else if (s === 'edge-to') {
        if (i.values.some((id: string) => id === e.selected || !c.ranks.some(r => r.id === id))) throw new Error('Choose a different existing rank.');
        for (const id of i.values) if (!c.edges.some(x => x.branchId === g.branch && x.fromRankId === e.selected && x.toRankId === id)) c.edges.push({ guildId: d.guildId, branchId: g.branch!, fromRankId: e.selected!, toRankId: id });
        validateRankGraph(c.ranks.map(r => r.id), c.edges);
        next('edge-more', `Progression saved: **${c.ranks.find(r => r.id === e.selected)!.name} → ${i.values.map((id: string) => c.ranks.find(r => r.id === id)!.name).join(' / ')}**.`);
    } else if (s.startsWith('group-') && ['group-required', 'group-multiple', 'group-sync'].includes(s)) {
        const group = c.groups.find(x => x.id === g.group)!;
        if (s === 'group-required') { group.required = action === 'yes'; next('group-multiple', `Membership is **${group.required ? 'required' : 'optional'}**.`); }
        else if (s === 'group-multiple') { group.multiple = action === 'yes'; next('group-sync', `Membership is **${group.multiple ? 'multiple' : 'single'}**.`); }
        else { g.sync = action === 'yes'; if (!g.sync) for (const entry of c.entries.filter(x => x.groupId === g.group)) delete entry.roleId; delete e.selected; next('entry-name', `Role synchronization ${g.sync ? 'enabled' : 'disabled'} in this draft.`); }
    } else if (s === 'modules') {
        d.config.modules = { briefings: i.values.includes('briefings'), patrols: i.values.includes('patrols'), supply: i.values.includes('supply'), atlas: i.values.includes('atlas') };
        g.index = 0; next('resources', `Enabled modules: **${i.values.join(', ') || 'none'}**.`);
    } else if (s === 'resources') {
        const spec = conversationResources(d)[g.index];
        if (spec && ['BOT_COMMANDS', 'BOT_LOGS'].includes(spec.key) && !c.additionalResources.some(r => r.key === spec.key)) c.additionalResources.push({ ...spec, name: spec.key === 'BOT_COMMANDS' ? 'bot-commands' : 'bot-logs' });
        if (spec && value) {
            const channel = await i.guild.channels.fetch(value);
            if (!channel || channel.type !== (spec.kind === 'CATEGORY' ? 4 : spec.kind === 'FORUM' ? 15 : 0)) throw new Error('That destination is unavailable. Choose another resource of the correct type.');
            if (c.resources.some(r => r.discordId === value && r.key !== spec.key)) throw new Error('That destination already serves another managed resource. Choose a different channel.');
            c.resources = c.resources.filter(r => r.key !== spec.key); c.resources.push({ guildId: d.guildId, key: spec.key, discordId: value, kind: spec.kind });
            d.resourceSelections = [...new Set([...(d.resourceSelections ?? []), spec.key])];
        }
        const notice = `${spec?.name ?? 'Resources'} ${value ? `set to <#${value}>` : 'kept for final confirmation'}.`;
        if (g.index + 1 < conversationResources(d).length) { move(d, 'resources'); g.index++; g.notice = notice; } else next('integration', notice);
    } else if (s === 'atlas') { move(d, 'atlas'); e.section = 'preview'; d.stage = 'preview'; }
    else {
        const add = action === 'add';
        const transitions: Record<string, string> = { ranks: 'branches', 'rank-more': 'branches', duties: 'groups', 'duty-more': 'groups', groups: 'modules', 'group-more': 'modules', 'entry-more': 'group-more', 'edge-more': 'duties' };
        if (value && ['ranks', 'duties', 'groups'].includes(s)) {
            if (s === 'groups') { g.group = value; next('group-name'); }
            else { e.selected = value; next(s === 'ranks' ? 'rank-name' : 'duty-name'); }
        } else if (add) {
            if (s === 'groups' || s === 'group-more') delete g.group;
            if (s !== 'edge-more') delete e.selected;
            next(s.startsWith('rank') ? 'rank-name' : s.startsWith('dut') ? 'duty-role' : s.startsWith('group') ? 'group-name' : s === 'edge-more' ? 'edge-to' : 'entry-name');
        } else if (s === 'edge-more' && action === 'from') next('edge-from');
        else if (transitions[s]) next(transitions[s]);
        else throw new Error('This question changed. Resume setup to continue.');
    }
    return 'save';
}
