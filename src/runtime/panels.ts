import { disabledFeature } from './features.js';
import { PermissionFlagsBits } from 'discord.js';
import { satisfies, type Requirement, type ServerConfig } from '../domain.js';
import type { RuntimeRepositories } from './bot.js';
import { commandDefinitions } from './commands.js';
import { requireTier, textModal } from './interactions.js';
import { browse } from './browse.js';

const row = (...components: any[]) => ({ type: 1, components });
const button = (id: string, label: string, style = 2) => ({ type: 2, custom_id: id, label, style });
const modules: Record<string, keyof ServerConfig['modules']> = { atlas: 'atlas', supply: 'supply', briefing: 'briefings', patrol: 'patrols' };
const friendly: Record<string, string> = {
    panel: 'Request Access', eligible: 'Eligibility', status: 'Current Status', info: 'Member Information', 'set-balance': 'Adjust Balance', 'undo-last': 'Undo Last Change',
    'refresh-summary': 'Refresh Public Summary', 'set-member': 'Set Member Assignments', 'clear-member': 'Clear Member Assignments', 'sync-roles': 'Sync Assignment Roles',
    'looking-for': 'Looking for Mentor', 'withdraw-looking': 'Withdraw Mentor Request', 'set-hq': 'HQ Configuration', hq: 'Set HQ', 'set-atlas': 'Configure Atlas', 'clear-atlas': 'Clear Atlas Link',
    'link-report': 'Link Report Contacts', deliver: 'Deliver to HQ', 'topic-list': 'Topics', reports: 'Reports', ballots: 'Ballots', 'group-members': 'Group Contacts',
    'catchall-set': 'Choose Catch-all Channel', 'catchall-clear': 'Restore Default Catch-all', 'recover-delivery': 'Recover Delivery (Advanced)', 'retire-left': 'Retire Departed Members',
};
export function actionLabel(name: string): string { return friendly[name] ?? name.split('-').map(s => s[0]!.toUpperCase() + s.slice(1)).join(' '); }
function dashboardLabel(system: string, action: string): string {
    const labels: Record<string, string> = { 'trailmark:my-access': 'My Active Access', 'assignment:my-claimed': 'My Claimed Assignments', 'assignment:list': 'View Assignments', 'application:list': 'My Application', 'mentorship:info': 'Current Mentorship', 'strongbox:history': 'My History', 'vote:list': 'Browse Votes', 'vote:cast': 'Cast Vote', 'reference:list': 'Browse References', 'reference:search': 'Search References', 'briefing:history': 'Recent Briefings', 'patrol:suggest': 'Request Suggestion' };
    return labels[`${system}:${action}`] ?? actionLabel(action);
}

/** UI visibility mirrors, but never replaces, the authorization in production handlers. */
export function panelRequirement(system: string, action: string, namespace?: string): Requirement | 'ANY' {
    if(system===namespace)return action==='briefing'?'LEVEL_1':['rank','notes'].includes(action)?'ADMIN':'LEVEL_3';
    if(system==='apprenticeship')system='mentorship';
    if(system==='promotion')system='advancement';
    if (system === 'funds') return ['deposit', 'spend', 'set-balance', 'undo-last', 'refresh-summary'].includes(action) ? 'LEVEL_2' : 'ANY';
    if (system === 'trailmark') return action === 'leave' ? 'ANY' : ['panel', 'list', 'report', 'my-access'].includes(action) ? 'BASELINE' : 'LEVEL_3';
    if (system === 'advancement') return action === 'setup' ? 'ADMIN' : ['open', 'close', 'approve', 'deny', 'status', 'refresh'].includes(action) ? 'LEVEL_3' : 'BASELINE';
    if (system === 'intel') return ['reports', 'deliver', 'link-report'].includes(action) ? 'BASELINE' : 'LEVEL_3';
    if (system === 'atlas') return 'BASELINE';
    if (system === 'alliance') return 'LEVEL_3';
    if(system===namespace&&action==='briefing')return 'LEVEL_1';
    if (system === 'roster' || system === namespace) return ['rank', 'notes'].includes(action) ? 'ADMIN' : 'LEVEL_3';
    if (['duty', 'contact', 'recruit'].includes(system)) return 'LEVEL_3';
    if (['supply', 'briefing', 'patrol', 'reference'].includes(system)) return ['create', 'setup', 'edit', 'send', 'redistribute', 'close', 'reopen', 'cancel', 'resolve'].includes(action) ? 'LEVEL_3' : system === 'briefing' ? 'LEVEL_1' : 'BASELINE';
    if (['strongbox', 'application', 'mentorship', 'assignment', 'vote'].includes(system)) return ['setup', 'review', 'process', 'reject', 'approve', 'deny', 'assign', 'close', 'cancel', 'audit', 'open', 'set-member', 'clear-member', 'sync-roles', 'create', 'refresh'].includes(action) ? 'LEVEL_3' : 'BASELINE';
    return 'ADMIN';
}
async function currentAccess(i: any, store: RuntimeRepositories): Promise<(need: Requirement | 'ANY') => boolean> {
    const member = await i.guild.members.fetch({ user: i.user.id, force: true }), roles = await i.guild.roles.fetch();
    const mappings = (await store.permissionRoles(i.guildId)).filter(p => p.guildId === i.guildId && roles.has(p.roleId));
    return need => need === 'ANY' || satisfies(member.roles.cache.keys(), need, mappings, member.permissions.has(PermissionFlagsBits.Administrator));
}
export async function availableActions(i: any, store: RuntimeRepositories, config: ServerConfig, system: string, access?: (need: Requirement | 'ANY') => boolean): Promise<any[]> {
    if (disabledFeature(config, system)) return [];
    if (modules[system] && !config.modules[modules[system]!]) return [];
    const can = access ?? await currentAccess(i, store);
    const command = (commandDefinitions(config.commandNamespace) as any[]).find(c => c.name === system);
    const actions = (command?.options ?? []).filter((o: any) => o.type === 1 && (o.name !== 'panel' || system === 'trailmark'));
    if (system === 'trailmark') actions.splice(1, 0, { name: 'my-access', description: 'My Active Access', options: [] });
    if (system === 'reference') actions.unshift({ name: 'search', options: [{ name: 'query', description: 'Search reference titles and contents', type: 3, required: true, max_length: 100 }] });
    if (system === 'assignment') actions.unshift({ name: 'my-claimed', options: [] });
    return actions.filter((a: any) => {
        const need = panelRequirement(system, a.name, config.commandNamespace);
        return can(need);
    }).sort((a: any, b: any) => Number(!['ANY', 'BASELINE', 'LEVEL_1'].includes(panelRequirement(system, a.name, config.commandNamespace))) - Number(!['ANY', 'BASELINE', 'LEVEL_1'].includes(panelRequirement(system, b.name, config.commandNamespace))));
}

interface PanelSession {
    guild: string; owner: string; system: string; action: string; expires: number; revision: number;
    options: any[]; values: Record<string, any>; index: number;
}
// UI-only input collection. Nothing mutates until a real handler executes. Expired/restarted
// sessions offer Refresh; durable workflows remain in their existing repositories.
const sessions = new Map<string, PanelSession>();
function putSession(session: PanelSession): string {
    for (const [key, value] of sessions) if (value.expires <= Date.now()) sessions.delete(key);
    if (sessions.size >= 5000) sessions.delete(sessions.keys().next().value!);
    const key = crypto.randomUUID(); sessions.set(key, session); return key;
}
export function projectInteraction(i: any, overrides: Record<string, any>): any {
    return new Proxy(i, { get(target, key) { if (typeof key === 'string' && key in overrides) return overrides[key]; const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value; } });
}
export function commandInteraction(i: any, system: string, action: string, values: Record<string, any>): any {
    const get = (name: string, required = false) => { const value = values[name]; if (required && value == null) throw new Error(`Choose ${name} before continuing.`); return value ?? null; };
    return projectInteraction(i, { commandName: system, customId: undefined, values: undefined, isChatInputCommand: () => true, isButton: () => false, isAnySelectMenu: () => false, isStringSelectMenu: () => false, isModalSubmit: () => false,
        options: { getSubcommand: () => action, getString: get, getInteger: get, getNumber: get, getBoolean: get, getUser: get, getRole: get, getChannel: get } });
}
async function respond(i: any, payload: any): Promise<void> { if (i.deferred) await i.editReply({ ...payload, allowedMentions: { parse: [] } }); else await i.reply({ ...payload, ephemeral: true, allowedMentions: { parse: [] } }); }
export async function openPanel(i: any, store: RuntimeRepositories, system: string, page = 0): Promise<void> {
    await i.deferReply({ ephemeral: true });
    const config = await store.load(i.guildId);
    if (!config) { await respond(i, { content: 'An administrator needs to run /server setup before Codex features are available.' }); return; }
    const access = await currentAccess(i, store);
    const base = `ux:${i.user.id}`, components: any[] = [];
    if (system === '$help' || (system === 'help' && config.commandNamespace !== 'help')) {
        const features: any[] = [];
        for (const c of commandDefinitions(config.commandNamespace) as any[]) if (c.options?.some((s: any) => s.name === 'panel') && (c.name === config.commandNamespace || (await availableActions(i, store, config, c.name, access)).length)) features.push({ label: c.name === config.commandNamespace ? config.organizationName.slice(0, 100) : actionLabel(c.name), value: c.name });
        if (features.length) components.push(row({ type: 3, custom_id: `${base}:open`, placeholder: 'Choose a feature', options: features.slice(0, 25) }));
        if (i.memberPermissions?.has(PermissionFlagsBits.Administrator)) components.push(row(button(`${base}:setup`, 'Server Setup')));
        await respond(i, { content: `**Your Codex guide**\nType a slash command to choose an action and enter its arguments directly. Discord shows required inputs and available choices.\n${features.map(f=>'`/'+f.value+'`').join(' · ')}\nApplications, ballots, reports and dispatches retain their specialized forms or controls. The menu below offers optional shortcuts.`, components }); return;
    }
    const disabled = disabledFeature(config, system); if (disabled) throw new Error(disabled);
    const actions = await availableActions(i, store, config, system, access);
    if (system === config.commandNamespace && page === 0) {
        const destinations = ['trailmark', 'advancement', 'application', 'mentorship', 'assignment', 'atlas'];
        const links: any[] = [];
        for (const destination of destinations) if ((await availableActions(i, store, config, destination, access)).length) links.push(button(`${base}:page:${destination}:0`, actionLabel(destination)));
        for (let n = 0; n < links.length; n += 5) components.push(row(...links.slice(n, n + 5)));
        components.push(row(...(actions.length ? [button(`${base}:page:${system}:1`, 'Member Administration')] : []), button(`${base}:help`, 'Help')));
        await respond(i, { content: `**${config.organizationName}**\nYour organization hub: choose a feature to view your access, applications, mentorship or assignments.${actions.length ? '\nStaff member records are available under Member Administration.' : '\nPersonal member records, rank details and notes remain staff-only under this server’s existing authorization rules.'}`, components }); return;
    }
    if (!actions.length) { await respond(i, { content: 'This feature is disabled or you do not have access. Ask a server administrator, or open /help.', components: [row(button(`${base}:help`, 'Open Help'))] }); return; }
    const offset = system === config.commandNamespace ? 1 : 0;
    const p = Math.max(0, Math.min(page - offset, Math.ceil(actions.length / 10) - 1));
    for (let n = p * 10; n < Math.min(actions.length, (p + 1) * 10); n += 5) components.push(row(...actions.slice(n, Math.min(n + 5, (p + 1) * 10)).map(a => button(`${base}:action:${system}:${a.name}`, dashboardLabel(system, a.name)))));
    components.push(row(...(p + offset ? [button(`${base}:page:${system}:${p + offset - 1}`, 'Previous')] : []), ...((p + 1) * 10 < actions.length ? [button(`${base}:page:${system}:${p + offset + 1}`, 'Next')] : []), button(`${base}:page:${system}:${p + offset}`, 'Refresh'), button(`${base}:help`, 'Help')));
    if (system === 'trailmark' && config.modules.atlas && (await availableActions(i, store, config, 'atlas', access)).length) components.push(row(button(`${base}:action:atlas:status`, 'Atlas Status')));
    await respond(i, { content: `**${system === config.commandNamespace ? config.organizationName : actionLabel(system)}**\nChoose an action.${actions.length > 10 ? ` Page ${p + 1} of ${Math.ceil(actions.length / 10)}.` : ''}${system === config.commandNamespace || system === 'roster' ? '\nMember records and notes retain their staff access rules.' : ''}`, components });
}
function formView(key: string, s: PanelSession): any {
    const option = s.options[s.index], id = (a: string) => `uxform:${key}:${s.revision}:${a}`;
    if (!option) return { content: `Ready to **${actionLabel(s.action)}**. Continue opens the action with your selected values.`, components: [row(button(id('run'), 'Continue', 1), button(id('back'), 'Back'), button(id('cancel'), 'Cancel'))] };
    const components: any[] = [];
    if ([6, 7, 8].includes(option.type)) components.push(row({ type: option.type === 6 ? 5 : option.type === 7 ? 8 : 6, custom_id: id('answer'), placeholder: option.description.slice(0, 150), min_values: 1, max_values: 1, ...(option.channel_types ? { channel_types: option.channel_types } : {}) }));
    else if (option.choices?.length) components.push(row({ type: 3, custom_id: id('answer'), placeholder: option.description.slice(0, 150), options: option.choices.map((v: any) => ({ label: v.name, value: String(v.value) })) }));
    else components.push(row(button(id('text'), 'Enter Value', 1)));
    components.push(row(button(id('back'), 'Back'), ...(!option.required ? [button(id('skip'), 'Skip')] : []), button(id('cancel'), 'Cancel')));
    return { content: `**${actionLabel(s.action)}**\n${option.description}${option.required ? '' : ' (optional)'}`, components };
}
export async function handlePanel(i: any, store: RuntimeRepositories, dispatch: (i: any) => Promise<void>, setup: () => Promise<void>): Promise<void> {
    const execute = async (next: any) => {
        if (next.commandName === 'reference' && next.options.getSubcommand() === 'search') return browse(next, store, 'reference', next.options.getString('query', true));
        if (next.commandName === 'assignment' && next.options.getSubcommand() === 'my-claimed') return browse(next, store, 'assignment');
        return dispatch(next);
    };
    const p = i.customId.split(':');
    if (p[0] === 'ux') {
        if (p[1] !== i.user.id) throw new Error('Open /help to use your own panel.');
        if (p[2] === 'help') return openPanel(i, store, '$help');
        if (p[2] === 'setup') { await requireTier(i, store, 'ADMIN'); return setup(); }
        if (p[2] === 'open' || p[2] === 'page') return openPanel(i, store, p[2] === 'open' ? i.values[0] : p[3], Number(p[4] ?? 0));
        const config = await store.load(i.guildId);
        if (!config) throw new Error('Ask an administrator to run /server setup.');
        const action = (await availableActions(i, store, config, p[3])).find(a => a.name === p[4]);
        if (!action) throw new Error('This action is no longer available. Open /help to refresh your permissions and modules.');
        if (p[4] === 'my-access') {
            const rows = await store.trailmark<any[]>(i.guildId, 'sessions', i.user.id);
            await respond(i, { content: rows.length ? rows.map(s => `Access ${s.state.toLowerCase()} until <t:${Math.floor(Date.parse(s.expires_at) / 1000)}:R>.`).join('\n').slice(0, 1800) : 'You have no active Trailmark access.', components: [row(button(`ux:${i.user.id}:action:trailmark:leave`, 'Leave Trailmark'))] }); return;
        }
        if (!(action.options?.length)) return execute(commandInteraction(i, p[3], p[4], {}));
        const session: PanelSession = { guild: i.guildId, owner: i.user.id, system: p[3], action: p[4], options: action.options, values: {}, index: 0, revision: 0, expires: Date.now() + 15 * 60000 };
        const key = putSession(session); await respond(i, formView(key, session)); return;
    }
    const s = sessions.get(p[1]);
    if (!s || s.expires <= Date.now() || s.revision !== Number(p[2])) { await respond(i, { content: 'This input panel is outdated or expired. Open a fresh dashboard to continue.', components: [row(button(`ux:${i.user.id}:help`, 'Open New Panel'))] }); return; }
    if (s.guild !== i.guildId || s.owner !== i.user.id) throw new Error('Open /help to use your own panel.');
    const config = await store.load(i.guildId);
    if (!config || !(await availableActions(i, store, config, s.system)).some(a => a.name === s.action)) throw new Error('This action is no longer available. Open /help to refresh.');
    const action = p[3], o = s.options[s.index];
    if (action === 'cancel') { sessions.delete(p[1]); await respond(i, { content: 'Action cancelled. No changes were made.' }); return; }
    if (action === 'run') { if (o) throw new Error('Complete the questions first.'); sessions.delete(p[1]); return execute(commandInteraction(i, s.system, s.action, s.values)); }
    if (action === 'text') { await i.showModal(textModal(`uxform:${p[1]}:${s.revision}:answer`, actionLabel(s.action), [{ id: 'value', label: o.description, max: o.max_length ?? 500 }])); return; }
    if (action === 'back') s.index = Math.max(0, s.index - 1);
    else if (action === 'skip') { if (!o || o.required) throw new Error('This question needs an answer.'); delete s.values[o.name]; s.index++; }
    else if (action === 'answer') {
        let value: any = i.isModalSubmit() ? i.fields.getTextInputValue('value').trim() : i.values[0];
        if ([4, 10].includes(o.type)) { value = Number(value); if (!Number.isFinite(value) || (o.type === 4 && !Number.isSafeInteger(value)) || (o.min_value != null && value < o.min_value) || (o.max_value != null && value > o.max_value)) throw new Error('Enter a number within the allowed range.'); }
        if (o.choices && !o.choices.some((v: any) => v.value === value)) throw new Error('Choose a listed option.');
        if (o.type === 6) value = await i.client.users.fetch(value);
        if (o.type === 7) { value = await i.guild.channels.fetch(value); if (!value || (o.channel_types && !o.channel_types.includes(value.type))) throw new Error('Choose an available channel of the requested type.'); }
        if (o.type === 8) { value = await i.guild.roles.fetch(value); if (!value) throw new Error('That role no longer exists. Choose another role.'); }
        if (typeof value === 'string' && (!value || value.length > (o.max_length ?? 6000))) throw new Error('Enter a non-empty value within the length limit.');
        s.values[o.name] = value; s.index++;
    } else throw new Error('This panel is outdated. Open /help to continue.');
    s.revision++; await respond(i, formView(p[1], s));
}
