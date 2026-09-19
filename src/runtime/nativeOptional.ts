import type { WorkflowRepositories } from './handlers/workflows.js';
import { nativeCall, sendTrackedDM } from './nativeWorkflows.js';
import { interactionUuid, requireTier, replyText, textModal } from './interactions.js';
import { DurableSummary } from '../workflows.js';
import { DiscordDurablePublisher } from './intelligenceDiscord.js';
import { DiscordTrailmarkAccess } from './trailmarkAccess.js';
const audiences = { apprentice_plus: 'BASELINE', ranger_plus: 'LEVEL_1', marshal_plus: 'LEVEL_3', captain_plus: 'LEVEL_4' } as const;
const rotations = new Map<string, number>();
export async function handleNativeOptional(i: any, store: WorkflowRepositories): Promise<boolean> {
    const parts = i.customId?.split(':') ?? [], config = await store.load(i.guildId);
    const collect = parts[1] === 'briefing-collect' || (i.commandName === config?.commandNamespace && i.options?.getSubcommand() === 'briefing');
    const form = parts[1] === 'briefing-form', system = collect || form ? 'briefing' : i.commandName;
    if (!['briefing', 'patrol'].includes(system))
        return false;
    if (!config?.modules[system === 'briefing' ? 'briefings' : 'patrols'])
        throw new Error('This optional module is disabled');
    const action = collect ? 'collect' : form ? 'submit' : i.options.getSubcommand();
    if (!['collect', 'submit', 'setup', 'send', 'settings', 'suggest'].includes(action))
        return false;
    await requireTier(i, store, ['setup', 'send', 'submit'].includes(action) ? 'LEVEL_3' : system === 'briefing' ? 'LEVEL_1' : 'BASELINE');
    if (system === 'patrol') {
        if (!config.modules.trailmarks)
            throw new Error('Trailmarks are disabled');
        await i.deferReply({ ephemeral: true });
        const org = await store.organization(i.guildId), member = await store.member(i.guildId, i.user.id);
        const assignment = i.options.getString('assignment') ?? member?.entryIds[0];
        if (assignment && !org.entries.some(e => e.id === assignment))
            throw new Error('Choose a configured assignment in this server');
        const marks = await nativeCall(store, i.guildId, 'patrol-locations', i.user.id, undefined, { assignment });
        const adapter = new DiscordTrailmarkAccess(i.guild, store);
        const eligible = [];
        for (const t of marks)
            if (await adapter.eligible(t, i.user.id))
                eligible.push(t);
        const key = `${i.guildId}:${i.user.id}:${assignment ?? ''}`, cursor = rotations.get(key) ?? 0;
        rotations.delete(key);
        rotations.set(key, cursor + 1);
        if (rotations.size > 1000)
            rotations.delete(rotations.keys().next().value!);
        const pool = eligible.slice(0, 6), route = pool.length ? Array.from({ length: Math.min(3, pool.length) }, (_, n) => pool[(cursor + n) % pool.length]) : [];
        await i.editReply(replyText(`Suggested patrol${assignment ? `: ${org.entries.find(e => e.id === assignment)!.name}` : ''}\n${route.map((t, n) => `${n + 1}. ${t.name} — ${t.last_visit ? 'last visited ' + t.last_visit : 'no recorded visit'}`).join('\n') || 'Take a circuit through your assigned area; no eligible Trailmarks are recorded here.'}\nFavor ground with older recorded activity. Adjust the route as needed and report what you observe. Request access through /trailmark panel.`));
        return true;
    }
    if (action === 'send') {
        const audience = i.options.getString('audience', true), recipient = i.options.getUser('recipient'), kind = i.options.getString('kind') ?? 'ic';
        if (![...Object.keys(audiences), 'individual'].includes(audience) || !['ic', 'ooc'].includes(kind))
            throw new Error('Choose a listed audience and dispatch kind');
        if ((audience === 'individual') !== Boolean(recipient))
            throw new Error('Select a recipient only for an individual dispatch');
        if (recipient) {
            await i.guild.members.fetch(recipient.id);
            const m = await store.member(i.guildId, recipient.id);
            if (!m || m.status !== 'ACTIVE')
                throw new Error('Choose an active organization member');
        }
        const id = interactionUuid(i.id);
        await nativeCall(store, i.guildId, 'form-create', i.user.id, id, { system: 'briefing', input: { audience, recipient: recipient?.id, kind } });
        await i.showModal(textModal(`native:briefing-form:${id}`, kind === 'ic' ? 'Write a Dispatch' : 'Write an OOC Note', [{ id: 'title', label: 'Heading', max: 150 }, { id: 'body', label: 'Dispatch text', max: 3000, paragraph: true }]));
        return true;
    }
    await i.deferReply({ ephemeral: true });
    if (action === 'submit') {
        const f = await nativeCall(store, i.guildId, 'form-get', i.user.id, parts[2]);
        if (f.system !== 'briefing')
            throw new Error('Wrong dispatch form');
        if (f.result) {
            await i.editReply(replyText('This dispatch was already saved.'));
            return true;
        }
        if (f.input.recipient) {
            await i.guild.members.fetch(f.input.recipient);
            if ((await store.member(i.guildId, f.input.recipient))?.status !== 'ACTIVE')
                throw new Error('Recipient is no longer active');
        }
        const result = await nativeCall(store, i.guildId, 'briefing-send', i.user.id, f.id, { ...f.input, title: i.fields.getTextInputValue('title'), body: i.fields.getTextInputValue('body') });
        await nativeCall(store, i.guildId, 'form-complete', i.user.id, f.id, result);
        await i.editReply(replyText('Dispatch saved for the selected audience’s next briefing.'));
        return true;
    }
    if (action === 'settings') {
        await nativeCall(store, i.guildId, 'briefing-preference', i.user.id, undefined, { dm_enabled: i.options.getBoolean('dm_enabled', true) });
        await i.editReply(replyText('Your briefing delivery preference is saved.'));
        return true;
    }
    if (action === 'setup') {
        const channel = i.options.getChannel('channel', true);
        if (channel.type !== 0 || channel.guildId !== i.guildId)
            throw new Error('Choose a text channel in this server');
        await store.put({ guildId: i.guildId, key: 'DISPATCH_DESK', discordId: channel.id, kind: 'CHANNEL' });
        const id = await new DurableSummary(store, new DiscordDurablePublisher(i.guild)).refresh(i.guildId, 'briefing-desk', channel.id, 'Dispatch Desk\nCollect your private briefing here.');
        const message = await (await i.guild.channels.fetch(channel.id)).messages.fetch(id);
        await message.edit({ components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Check My Briefing', custom_id: 'native:briefing-collect' }] }] });
        await i.editReply(replyText('Dispatch Desk is ready.'));
        return true;
    }
    const permitted: string[] = [];
    for (const [audience, tier] of Object.entries(audiences))
        try {
            await requireTier(i, store, tier);
            permitted.push(audience);
        }
        catch { }
    const inbox = await nativeCall(store, i.guildId, 'briefing-inbox', i.user.id, undefined, { audiences: permitted });
    if (!inbox.dispatches.length) {
        await i.editReply(replyText('No unread dispatches.'));
        return true;
    }
    const text = inbox.dispatches.map((d: any) => `${d.kind === 'ooc' ? 'OOC' : 'Dispatch'}: ${d.title}\n${d.body}`).join('\n\n');
    if (inbox.dm_enabled) {
        try {
            for (const d of inbox.dispatches)
                await sendTrackedDM(i, store, i.user, `briefing:${d.id}:${i.user.id}`, `${d.title}\n${d.body}`);
            await i.editReply(replyText(`Sent ${inbox.dispatches.length} dispatches by DM. Collect again for any remaining dispatches.`));
        }
        catch {
            await i.editReply({ content: 'DM delivery failed. Your briefing is attached privately.', files: [{ attachment: Buffer.from(text), name: 'briefing.txt' }], allowedMentions: { parse: [] } });
        }
    }
    else
        await i.editReply(text.length > 1900 ? { content: 'Your private briefing is attached.', files: [{ attachment: Buffer.from(text), name: 'briefing.txt' }] } : replyText(text));
    await nativeCall(store, i.guildId, 'briefing-read', i.user.id, undefined, { ids: inbox.dispatches.map((d: any) => d.id) });
    return true;
}
