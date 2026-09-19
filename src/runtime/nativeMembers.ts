import type { WorkflowRepositories } from './handlers/workflows.js';
import { authorize, roleAdapter } from './handlers/members.js';
import { AdministrationService, desiredMemberRoles, managedRoles, rosterRows } from '../administration.js';
import { replyText } from './interactions.js';
import { DurableSummary } from '../workflows.js';
import { DiscordDurablePublisher } from './intelligenceDiscord.js';
import { workflowDestination } from './handlers/workflows.js';
export async function handleNativeMember(i: any, store: WorkflowRepositories): Promise<boolean> {
    const action = i.options.getSubcommand();
    if (!['audit', 'assignments', 'inactive-review', 'sync-join-history', 'set-assignment', 'clear-assignment', 'sync-assignment-roles', 'retire-left'].includes(action))
        return false;
    await authorize(i, store);
    await i.deferReply({ ephemeral: true });
    const org = await store.organization(i.guildId), members = await store.members(i.guildId), service = new AdministrationService(store);
    if (action === 'inactive-review') {
        const days = i.options.getInteger('days') ?? 30, cutoff = Date.now() - days * 86400000;
        const rows = members.filter(m => !m.lastActiveAt || Date.parse(m.lastActiveAt) < cutoff);
        await i.editReply(replyText(rows.map(m => `${m.displayName}: ${m.lastActiveAt ?? 'No tracked activity'} (${m.status})`).join('\n') || 'No members meet the inactivity threshold.'));
        return true;
    }
    if (action === 'assignments') {
        const body = rosterRows(members, org).map(r => r.join(' | ')).join('\n');
        await new DurableSummary(store, new DiscordDurablePublisher(i.guild)).refresh(i.guildId, 'member-assignments', await workflowDestination(i, store, 'ROSTER'), body);
        await i.editReply(replyText('Configured rank, duty and assignment board refreshed.'));
        return true;
    }
    if (action === 'audit') {
        const live = await i.guild.members.fetch(), owned = managedRoles(org), lines = [];
        for (const m of members) {
            const member = live.get(m.memberId);
            if (!member) {
                lines.push(`${m.displayName}: absent from Discord (${m.status})`);
                continue;
            }
            const desired = desiredMemberRoles(m, org), missing = [...desired].filter(id => !member.roles.cache.has(id)), extra = [...owned].filter(id => member.roles.cache.has(id) && !desired.has(id));
            if (missing.length || extra.length)
                lines.push(`${m.displayName}: missing ${missing.join(', ') || 'none'}; extra ${extra.join(', ') || 'none'}`);
        }
        await i.editReply(replyText(lines.join('\n') || 'No configured role drift found.'));
        return true;
    }
    if (action === 'sync-join-history') {
        const selected = i.options.getChannel('channel', true);
        if (selected.guildId !== i.guildId || selected.type !== 0)
            throw new Error('Choose a local welcome text channel');
        const channel = await i.guild.channels.fetch(selected.id), dates = new Map<string, string>();
        let before: string | undefined, count = 0;
        while (count < 5000) {
            const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
            if (!batch.size)
                break;
            for (const m of batch.values())
                if (m.type === 7 && m.author?.id) {
                    const date = new Date(m.createdTimestamp).toISOString(), old = dates.get(m.author.id);
                    if (!old || date < old)
                        dates.set(m.author.id, date);
                }
            count += batch.size;
            before = batch.last().id;
            if (batch.size < 100)
                break;
        }
        let updated = 0;
        for (const m of members) {
            const joinedAt = dates.get(m.memberId);
            if (joinedAt && m.joinedAt !== joinedAt) {
                await service.change(m, { ...m, joinedAt }, org, i.user.id, 'MEMBER_JOIN_HISTORY_SYNC', 'Discord join message in ' + channel.id);
                updated++;
            }
        }
        await i.editReply(replyText(`Scanned ${count} messages; updated ${updated} known members from Discord join events.${count >= 5000 ? ' Scan limit reached; older messages were not examined.' : ''}`));
        return true;
    }
    if (action === 'sync-assignment-roles') {
        const live = await i.guild.members.fetch(), roles = await i.guild.roles.fetch();
        let changed = 0;
        for (const m of members) {
            const member = live.get(m.memberId);
            if (!member)
                continue;
            await service.change(m, { ...m }, org, i.user.id, 'MEMBER_ASSIGNMENT_ROLE_SYNC', 'Synchronize configured roles', roleAdapter(member, roles, desiredMemberRoles(m, org)));
            changed++;
        }
        await i.editReply(replyText(`Synchronized ${changed} members using existing configured roles.`));
        return true;
    }
    const memberId = i.options.getUser('user')?.id ?? i.options.getString('discord_user_id', true), before = await store.member(i.guildId, memberId);
    if (!before)
        throw new Error('Member is not in the persisted roster');
    let live;
    try {
        live = await i.guild.members.fetch(memberId);
    }
    catch (error) {
        if ((error as any).code !== 10007)
            throw error;
    }
    let after = structuredClone(before);
    if (action === 'retire-left') {
        if (live)
            throw new Error('Member is still in this server');
        after.status = 'RETIRED';
    }
    else if (action === 'set-assignment') {
        after = service.assignment(after, org, i.options.getString('assignment', true), false);
    }
    else {
        const selected = i.options.getString('assignment');
        if (!selected)
            throw new Error('Choose the configured assignment to clear');
        after = service.assignment(after, org, selected, true);
    }
    await service.change(before, after, org, i.user.id, action === 'retire-left' ? 'MEMBER_RETIRED' : 'MEMBER_ASSIGNMENT_CHANGED', action, live ? roleAdapter(live, await i.guild.roles.fetch(), desiredMemberRoles(after, org)) : undefined);
    await i.editReply(replyText('Member change saved and audited.'));
    return true;
}
