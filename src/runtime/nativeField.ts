import type { WorkflowRepositories } from './handlers/workflows.js';
import { requireTier, interactionUuid, replyText, textModal } from './interactions.js';
import { requireFeature } from './features.js';
import { nativeCall, openNativeForm } from './nativeWorkflows.js';
import { TrailmarkLifecycle, AdvancementService } from '../field.js';
import { DiscordTrailmarkAccess } from './trailmarkAccess.js';
import { DurableDelivery } from '../intelligence.js';
import { DiscordDurablePublisher } from './intelligenceDiscord.js';
export async function handleNativeTrailmark(i: any, store: WorkflowRepositories): Promise<boolean> {
    const parts = i.customId?.split(':') ?? [];
    if (parts[0] === 'native' && parts[1] === 'access') {
        await requireFeature(store, i.guildId, 'trailmark');
        await requireTier(i, store, 'BASELINE');
        await i.deferReply({ ephemeral: true });
        const id = i.values?.[0];
        const t = await store.trailmark(i.guildId, 'get', i.user.id, id);
        if (!t.active)
            throw new Error('Trailmark is inactive');
        const result = await new TrailmarkLifecycle(store, new DiscordTrailmarkAccess(i.guild, store)).access(i.guildId, id, i.user.id);
        await i.editReply(replyText(`Temporary access granted to ${t.name}. Use /trailmark leave when finished.`));
        return true;
    }
    const formId = parts[0] === 'native' && parts[1] === 'trail-report' ? parts[2] : undefined;
    if (formId) {
        await requireFeature(store, i.guildId, 'trailmark');
        await requireTier(i, store, 'BASELINE');
        const form = await nativeCall(store, i.guildId, 'form-get', i.user.id, formId);
        if (form.system !== 'trail-report')
            throw new Error('Wrong report form');
        const t = await store.trailmark(i.guildId, 'get', i.user.id, form.input.trailmark);
        if (i.channelId !== t.channel_id)
            throw new Error('Return to the original Trailmark channel');
        const sessions = await store.trailmark<any[]>(i.guildId, 'sessions', i.user.id);
        if (!sessions.some(s => s.trailmark_id === t.id && s.state === 'ACTIVE' && Date.parse(s.expires_at) > Date.now()))
            throw new Error('Request access before reporting');
        await i.deferReply({ ephemeral: true });
        if (form.result) {
            await i.editReply(replyText(`Report ${form.result.id} is already saved.`));
            return true;
        }
        const body = [`${form.input.type} report`, ...['subject', 'location', 'summary', 'details', 'follow_up'].map(k => `${k}: ${i.fields.getTextInputValue(k)}`), `Participants: ${(form.input.participants ?? []).join(', ') || 'None'}`].join('\n');
        if (body.length > 6000)
            throw new Error('Combined report must be at most 6,000 characters');
        const report = await store.trailmark<any>(i.guildId, 'report', i.user.id, t.id, { id: form.id, body, interaction_id: i.id });
        if (form.input.contacts?.length)
            await store.intelligence(i.guildId, 'report-links', i.user.id, report.id, { ids: form.input.contacts });
        await nativeCall(store, i.guildId, 'form-complete', i.user.id, form.id, { id: report.id });
        try {
            await new DurableDelivery(store, new DiscordDurablePublisher(i.guild)).deliver(i.guildId, `local-report:${report.id}`, t.channel_id, body);
        }
        catch {
            await i.editReply(replyText(`Report ${report.id} saved; local Discord delivery needs recovery.`));
            return true;
        }
        await i.editReply(replyText(`Report ${report.id} saved locally; ${report.status === 'AT_HQ' ? 'at Headquarters' : 'pending Headquarters delivery'}.`));
        return true;
    }
    const paging = parts[0] === 'native' && parts[1] === 'access-page';
    if (i.commandName !== 'trailmark' && !paging)
        return false;
    const action = paging ? 'panel' : i.options.getSubcommand();
    if (action === 'leave')
        return false;
    await requireFeature(store, i.guildId, 'trailmark');
    await requireTier(i, store, ['panel', 'list', 'report'].includes(action) ? 'BASELINE' : 'LEVEL_3');
    const adapter = new DiscordTrailmarkAccess(i.guild, store);
    if (action === 'panel' || action === 'list') {
        await i.deferReply({ ephemeral: paging || action !== 'panel' });
        const all: any[] = [];
        for (let n = 0; n < 100; n++) {
            const rows = await store.trailmark<any[]>(i.guildId, 'list', i.user.id, undefined, { page: n });
            all.push(...rows);
            if (rows.length < 25)
                break;
        }
        const available = [];
        for (const t of all)
            if (t.active && await adapter.eligible(t, i.user.id))
                available.push(t);
        available.sort((a, b) => Number(!!b.detail?.pinned) - Number(!!a.detail?.pinned) || a.name.localeCompare(b.name));
        const page = paging ? Number(parts[2]) : 0;
        if (!Number.isInteger(page) || page < 0 || page > 99)
            throw new Error('Invalid access page');
        const slice = available.slice(page * 25, page * 25 + 25), components: any[] = [];
        if (action === 'panel' && slice.length)
            components.push({ type: 1, components: [{ type: 3, custom_id: 'native:access', placeholder: 'Request temporary Trailmark access', options: slice.map(t => ({ value: t.id, label: t.name.slice(0, 100) })) }] });
        const buttons = [];
        if (page)
            buttons.push({ type: 2, style: 2, label: 'Previous', custom_id: 'native:access-page:' + (page - 1) });
        if ((page + 1) * 25 < available.length)
            buttons.push({ type: 2, style: 2, label: 'Next', custom_id: 'native:access-page:' + (page + 1) });
        if (buttons.length)
            components.push({ type: 1, components: buttons });
        await i.editReply({ ...replyText('Trailmarks — page ' + (page + 1) + '\n' + (slice.map(t => t.name + ' — ' + t.description).join('\n') || 'No eligible active Trailmarks.')), components });
        return true;
    }
    if (action === 'report' && i.options.getString('type')) {
        const type = i.options.getString('type', true);
        if (!['General', 'Incident'].includes(type))
            throw new Error('Choose a report format');
        const sessions = await store.trailmark<any[]>(i.guildId, 'sessions', i.user.id);
        let trail: any;
        for (const s of sessions.filter(s => s.state === 'ACTIVE' && Date.parse(s.expires_at) > Date.now())) {
            const t = await store.trailmark(i.guildId, 'get', i.user.id, s.trailmark_id);
            if (t.active && t.channel_id === i.channelId)
                trail = t;
        }
        if (!trail)
            throw new Error('Run this command inside the Trailmark you currently have access to');
        const contacts = [...new Set(['contact', 'contact_2', 'contact_3'].map(k => i.options.getString(k)).filter(Boolean))];
        for (const id of contacts) {
            const c = await store.intelligence<any>(i.guildId, 'contact-get', i.user.id, id as string);
            if (!c.active)
                throw new Error('Selected contact is inactive');
        }
        const participants = [...new Set(['participant', 'participant_2', 'participant_3'].map(k => i.options.getUser(k)?.id).filter(Boolean))];
        for (const id of participants)
            await i.guild.members.fetch(id);
        const id = interactionUuid(i.id);
        await nativeCall(store, i.guildId, 'form-create', i.user.id, id, { system: 'trail-report', input: { trailmark: trail.id, type, contacts, participants } });
        await i.showModal(textModal(`native:trail-report:${id}`, `${type} report`, [{ id: 'subject', label: type === 'Incident' ? 'Incident title' : 'Report title', max: 100 }, { id: 'location', label: type === 'Incident' ? 'Exact location' : 'Location or area', max: 150, optional: true }, { id: 'summary', label: type === 'Incident' ? 'What happened?' : 'Summary', max: 1000, paragraph: true }, { id: 'details', label: type === 'Incident' ? 'Threat and current status' : 'Details and observations', max: 2000, paragraph: true, optional: true }, { id: 'follow_up', label: type === 'Incident' ? 'Actions taken or aid requested' : 'Follow-up, request, or commendation', max: 1000, paragraph: true, optional: true }]));
        return true;
    }
    if (['create', 'edit'].includes(action) && i.options.getString(action === 'create' ? 'name' : 'trailmark')) {
        const old = action === 'edit' ? await store.trailmark<any>(i.guildId, 'get', i.user.id, i.options.getString('trailmark', true)) : undefined, detail = { ...(old?.detail ?? {}) };
        const assignment = i.options.getString('assignment');
        if (assignment)
            detail.assignment = assignment;
        const screenshot = i.options.getAttachment('screenshot');
        if (screenshot)
            detail.screenshot = screenshot.url;
        if (i.options.getBoolean('clear_screenshot'))
            delete detail.screenshot;
        const pinned = i.options.getBoolean('pinned');
        if (pinned !== null)
            detail.pinned = pinned;
        const primary = i.options.getString('patrol_primary');
        if (primary)
            detail.patrol_primary = primary;
        if (i.options.getBoolean('clear_patrol_primary'))
            delete detail.patrol_primary;
        await i.deferReply({ ephemeral: true });
        let t = await nativeCall(store, i.guildId, 'trailmark-save', i.user.id, old?.id ?? interactionUuid(i.id), { name: i.options.getString('name') ?? old?.name, description: i.options.getString('location_description') ?? old?.description ?? '', revision: old?.revision, detail });
        const atlas = i.options.getString('atlas_location_id');
        if (atlas || i.options.getBoolean('clear_atlas'))
            t = await store.trailmark(i.guildId, 'atlas', i.user.id, t.id, { revision: t.revision, ...(atlas ? { atlas_id: atlas } : {}) });
        const ready = await adapter.ensure(t);
        await i.editReply(replyText(`${ready.name} saved: <#${ready.channel_id}>.`));
        return true;
    }
    if (action === 'set-atlas' && i.options.getString('trailmark')) {
        await i.deferReply({ ephemeral: true });
        const t = await store.trailmark(i.guildId, 'get', i.user.id, i.options.getString('trailmark', true));
        await store.trailmark(i.guildId, 'atlas', i.user.id, t.id, { revision: t.revision, atlas_id: i.options.getString('atlas_location_id', true) });
        await i.editReply(replyText('Atlas linkage saved.'));
        return true;
    }
    return false;
}
