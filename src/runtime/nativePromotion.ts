import { DurableDelivery } from '../intelligence.js';
import type { WorkflowRepositories } from './handlers/workflows.js';
import { workflowDestination } from './handlers/workflows.js';
import { nativeCall } from './nativeWorkflows.js';
import { requireTier, replyText, interactionUuid } from './interactions.js';
import { AdvancementService } from '../field.js';
import { DurableSummary } from '../workflows.js';
import { DiscordDurablePublisher } from './intelligenceDiscord.js';
import { DiscordProvisioner } from './discordProvisioner.js';
export async function promotionBoard(i: any, store: WorkflowRepositories, id: string) {
    const r = await store.advancement<any>(i.guildId, 'get', i.user.id, id), ballots = await nativeCall(store, i.guildId, 'promotion-ballots', i.user.id, id), channelId = await workflowDestination(i, store, 'ADVANCEMENT');
    const body = `Promotion: <@${r.candidate_id}> → ${r.snapshot.organization.ranks.find((x: any) => x.id === r.to_rank_id)?.name ?? r.to_rank_id}\n${r.status}\n${r.reason ?? ''}\nYes ${r.yes}, No ${r.no}, Abstain ${ballots.filter((b: any) => b.selection === 'Abstain').length}`;
    const messageId = await new DurableSummary(store, new DiscordDurablePublisher(i.guild)).refresh(i.guildId, `promotion:${id}`, channelId, body), channel = await i.guild.channels.fetch(channelId), message = await channel.messages.fetch(messageId);
    await message.edit({ components: r.status === 'OPEN' ? [{ type: 1, components: ['yes', 'no', 'abstain'].map(v => ({ type: 2, style: v === 'yes' ? 3 : v === 'no' ? 4 : 2, label: v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Abstain', custom_id: `native:promotion:${id}:${v}` })) }] : [] });
    if (r.status === 'OPEN' && r.snapshot.mentions?.length) {
        const roles = r.snapshot.mentions as string[];
        const publisher = new DiscordDurablePublisher(i.guild);
        await new DurableDelivery(store, { recover: (destination, key) => publisher.recover(destination, key), async send(destination, key) { const c = await i.guild.channels.fetch(destination); return (await c.send({ content: roles.map(id => '<@&' + id + '>').join(' '), embeds: [{ description: 'A promotion ballot is ready.', footer: { text: 'codex-delivery:' + key } }], allowedMentions: { roles, parse: [] } })).id; } }).deliver(i.guildId, 'promotion-mentions:' + id, channelId, 'Promotion ballot');
    }
    if (r.status === 'OPEN' && !message.hasThread && typeof message.startThread === 'function')
        await message.startThread({ name: `Promotion discussion: ${r.candidate_id}`, autoArchiveDuration: 1440 });
}
export async function handleNativePromotion(i: any, store: WorkflowRepositories): Promise<boolean> {
    const p = i.customId?.split(':') ?? [], component = p[1] === 'promotion';
    if (!component && !['promotion', 'advancement'].includes(i.commandName))
        return false;
    const action = component ? p[3] : i.options.getSubcommand();
    if (component) {
        await i.deferReply({ ephemeral: true });
        const r = await store.advancement(i.guildId, 'get', i.user.id, p[2]);
        await requireTier(i, store, r.snapshot.settings.voter_tier, r.snapshot.organization.permissions);
        if (!['yes', 'no', 'abstain'].includes(action))
            throw new Error('Choose a ballot option');
        if (action === 'abstain')
            await nativeCall(store, i.guildId, 'promotion-abstain', i.user.id, r.id);
        else
            await store.advancement(i.guildId, 'vote', i.user.id, r.id, { approve: action === 'yes' });
        try {
            await promotionBoard(i, store, r.id);
            await i.editReply(replyText('Your ballot is saved.'));
        }
        catch {
            await i.editReply(replyText('Your ballot is saved; the promotion board needs refresh.'));
        }
        return true;
    }
    if (!['setup', 'status', 'eligible', 'open', 'ballots', 'refresh'].includes(action))
        return false;
    await requireTier(i, store, ['eligible', 'ballots'].includes(action) ? 'BASELINE' : action === 'setup' ? 'ADMIN' : 'LEVEL_3');
    await i.deferReply({ ephemeral: true });
    if (action === 'setup') {
        const channel = i.options.getChannel('channel', true);
        if (channel.type !== 0 || channel.guildId !== i.guildId)
            throw new Error('Choose a text channel in this server');
        const resource = { guildId: i.guildId, key: 'ADVANCEMENT' as const, discordId: channel.id, kind: 'CHANNEL' as const };
        await new DiscordProvisioner(i.guild, await store.permissionRoles(i.guildId)).restorePermissions(resource, { key: 'ADVANCEMENT', name: channel.name, kind: 'CHANNEL', minimumTier: 'LEVEL_1' });
        await store.put(resource);
        await i.editReply(replyText('Promotion channel saved. Existing ballot thresholds and permission snapshots are preserved.'));
        return true;
    }
    if (action === 'status') {
        const candidate = i.options.getUser('candidate', true);
        await nativeCall(store, i.guildId, 'promotion-progress', i.user.id, undefined, { candidate: candidate.id, progress: i.options.getString('progress', true) });
        await i.editReply(replyText('Candidate progress saved.'));
        return true;
    }
    if (action === 'eligible') {
        const progress = await nativeCall(store, i.guildId, 'promotion-progress-list', i.user.id), service = new AdvancementService(store), lines = [];
        for (const member of await store.members(i.guildId)) {
            const next = await service.eligible(i.guildId, member.memberId);
            if (next.length)
                lines.push(`${member.displayName}: ${next.map(r => r.name).join(', ')} — ${progress.find((p: any) => p.member_id === member.memberId)?.progress ?? 'clear'}`);
        }
        await i.editReply(replyText(lines.join('\n') || 'No eligible configured transitions.'));
        return true;
    }
    if (action === 'open') {
        const candidate = i.options.getUser('candidate', true), options = await new AdvancementService(store).eligible(i.guildId, candidate.id), target = i.options.getString('target_rank') ?? (options.length === 1 ? options[0]!.id : undefined);
        if (!target)
            throw new Error('Choose target_rank from the configured eligible transitions');
        if (!options.some(r => r.id === target))
            throw new Error('Candidate is not eligible for that configured transition');
        const mentions = ['mentions', 'mentions_2', 'mentions_3', 'mentions_4', 'mentions_5'].map(k => i.options.getRole(k)).filter(Boolean);
        for (const role of mentions)
            if (role.id === i.guildId || role.managed)
                throw new Error('Choose an ordinary role to mention');
        await workflowDestination(i, store, 'ADVANCEMENT');
        const record = await nativeCall(store, i.guildId, 'promotion-open', i.user.id, interactionUuid(i.id), { candidate_id: candidate.id, to_rank_id: target, reason: i.options.getString('reason'), mentions: mentions.map(r => r.id) });
        try {
            await promotionBoard(i, store, record.id);
            await i.editReply(replyText(`Promotion ${record.id} opened. Ballot and discussion are ready.`));
        }
        catch {
            await i.editReply(replyText(`Promotion ${record.id} saved; use /promotion refresh to recover its board.`));
        }
        return true;
    }
    const id = i.options.getString('vote', true), r = await store.advancement(i.guildId, 'get', i.user.id, id);
    await requireTier(i, store, r.snapshot.settings.voter_tier, r.snapshot.organization.permissions);
    if (action === 'refresh') {
        await promotionBoard(i, store, id);
        await i.editReply(replyText('Promotion board refreshed.'));
        return true;
    }
    const ballots = await nativeCall(store, i.guildId, 'promotion-ballots', i.user.id, id);
    await i.editReply(replyText(ballots.map((b: any) => `${b.voter}: ${b.selection}`).join('\n') || 'No ballots recorded.'));
    return true;
}
