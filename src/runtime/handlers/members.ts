import { PermissionFlagsBits } from 'discord.js';
import { AdministrationService, desiredMemberRoles, managedRoles, rosterCsv, rosterRows, type AdministrationStore, type MemberState, type OrganizationConfig, type RoleMember } from '../../administration.js';
import { advancementOptions, satisfies, type PermissionRole } from '../../domain.js';
export interface MemberRepositories extends AdministrationStore {
    permissionRoles(guildId: string): Promise<PermissionRole[]>;
}
export async function authorize(i: any, store: MemberRepositories): Promise<void> {
    const actor = await i.guild.members.fetch(i.user.id);
    const roles = await i.guild.roles.fetch();
    const mappings = (await store.permissionRoles(i.guildId)).filter(x => roles.has(x.roleId));
    if (!satisfies(actor.roles.cache.keys(), 'LEVEL_3', mappings, actor.permissions.has(PermissionFlagsBits.Administrator)))
        throw new Error('LEVEL_3 or Discord Administrator permission required');
}
async function discordMember(guild: any, id: string): Promise<any | undefined> {
    try {
        return await guild.members.fetch({ user: id, force: true });
    }
    catch (error) {
        if ((error as {
            code?: number;
        }).code === 10007)
            return undefined;
        throw error;
    }
}
function roleAdapter(member: any, roles: any, desired: Set<string>): RoleMember {
    for (const id of desired)
        if (!roles.has(id))
            throw new Error(`Configured role ${id} was deleted; update configuration before syncing`);
    return { roles: new Set<string>(member.roles.cache.keys()), async add(id) { await member.roles.add(id, 'Codex member administration'); }, async remove(id) { if (roles.has(id))
            await member.roles.remove(id, 'Codex member administration'); } };
}
export async function handleMembers(i: any, store: MemberRepositories): Promise<void> {
    if (i.customId)
        await i.deferUpdate();
    else
        await i.deferReply({ ephemeral: true });
    await authorize(i, store);
    const c = await store.organization(i.guildId), service = new AdministrationService(store);
    const component = Boolean(i.customId), parts: string[] = component ? i.customId.split(':') : [];
    if (component && parts[1] !== i.user.id)
        throw new Error('Only the administrator who opened this panel may use it');
    const sub = component ? parts[2]! : i.options.getSubcommand();
    const memberId = component ? parts[3]! : i.options.getUser('member')?.id;
    if (['info', 'export', 'inactive-review'].includes(sub) && !memberId) {
        let rows = await store.members(i.guildId);
        if (sub === 'inactive-review')
            rows = rows.filter(m => m.status !== 'ACTIVE');
        const rendered = rosterRows(rows, c);
        await i.editReply({ content: rendered.slice(1, 11).map(r => r.join(' | ')).join('\n').slice(0, 1800) || 'No persisted members.', files: [{ attachment: Buffer.from(rosterCsv(rows, c), 'utf8'), name: 'roster.csv' }], allowedMentions: { parse: [] } });
        return;
    }
    if (sub === 'sync-all' || sub === 'retire-left') {
        const live = await i.guild.members.fetch();
        const persisted = await store.members(i.guildId);
        const known = new Map(persisted.map(m => [m.memberId, m]));
        const relevant = new Set([...managedRoles(c), ...(await store.permissionRoles(i.guildId)).map(r => r.roleId)]);
        const failures: string[] = [];
        let completed = 0;
        const roles = await i.guild.roles.fetch();
        if (sub === 'sync-all')
            for (const member of live.values())
                if (!member.user.bot && !known.has(member.id) && [...member.roles.cache.keys()].some(id => relevant.has(String(id))))
                    try {
                        known.set(member.id, seedMember(i.guildId, member, c));
                    }
                    catch (error) {
                        failures.push(`${member.id}: ${String(error)}`);
                    }
        for (const m of known.values())
            try {
                const before = await store.member(i.guildId, m.memberId), member = live.get(m.memberId);
                if (sub === 'retire-left' && m.status !== 'LEFT')
                    continue;
                const after = { ...m, status: sub === 'retire-left' || m.status === 'RETIRED' ? 'RETIRED' as const : !member ? 'LEFT' as const : m.status === 'LEFT' ? 'INACTIVE' as const : m.status, displayName: member?.displayName ?? m.displayName };
                await service.change(before, after, c, i.user.id, sub === 'retire-left' ? 'MEMBER_RETIRED' : 'MEMBER_SYNCHRONIZED', 'Bulk administration', member ? roleAdapter(member, roles, desiredMemberRoles(after, c)) : undefined);
                completed++;
            }
            catch (error) {
                failures.push(`${m.memberId}: ${String(error)}`);
            }
        await i.editReply({ content: `Processed ${completed} members. Failures: ${failures.length}.`, ...(failures.length ? { files: [{ attachment: Buffer.from(failures.join('\n')), name: 'sync-errors.txt' }] } : {}) });
        return;
    }
    if (!memberId)
        throw new Error('Select a member');
    const before = await store.member(i.guildId, memberId), live = await discordMember(i.guild, memberId);
    let after = before ? structuredClone(before) : live ? seedMember(i.guildId, live, c) : undefined;
    if (!after)
        throw new Error('Member is neither in this server nor in persisted records');
    if (sub === 'info' || sub === 'assignments') {
        await i.editReply({ content: rosterRows([after], c).map(r => r.join(' | ')).join('\n').slice(0, 1900), ephemeral: true, allowedMentions: { parse: [] } });
        return;
    }
    if (sub === 'audit' || sub === 'notes') {
        const rows = sub === 'audit' ? await store.memberAudit(i.guildId, memberId) : await store.notes(i.guildId, memberId);
        await i.editReply({ content: `${rows.length} records. Notes and audit are restricted to LEVEL_3 administrators.`, files: [{ attachment: Buffer.from(JSON.stringify(rows, null, 2)), name: `${sub}.json` }], ephemeral: true });
        return;
    }
    if (sub === 'note') {
        if (!before)
            throw new Error('Synchronize the member before adding notes');
        const body = i.options.getString('body', true).trim();
        if (!body || body.length > 2000)
            throw new Error('Note must contain 1–2000 characters');
        await store.addNote(i.guildId, memberId, i.user.id, body, i.options.getString('visibility') ?? 'ADMIN');
        await i.editReply({ content: 'Authored note saved and audited.', ephemeral: true });
        return;
    }
    if (['promote', 'rank', 'set-member', 'clear-member'].includes(sub) && (!component || parts[4] === 'page')) {
        const page = component ? Number(i.values[0]) : 0;
        const options = sub === 'promote' ? (after.rankId ? advancementOptions(after.rankId, c.edges, c.ranks) : []) : sub === 'rank' ? c.ranks : c.entries.filter(e => sub !== 'clear-member' || after!.entryIds.includes(e.id)).map(e => ({ ...e, name: `${c.groups.find(g => g.id === e.groupId)?.name}: ${e.name}` }));
        if (!options.length)
            throw new Error('No configured choices are available for this member');
        const payload = choicePanel(i.user.id, sub, memberId, options, page);
        await i.editReply(payload);
        return;
    }
    let action = 'MEMBER_SYNCHRONIZED';
    if (sub === 'promote') {
        after = service.promote(after, c, i.values[0]);
        action = 'MEMBER_PROMOTED';
    }
    else if (sub === 'rank') {
        if (!i.memberPermissions?.has(PermissionFlagsBits.Administrator))
            throw new Error('Discord Administrator is required to initialize or correct a rank');
        after.rankId = i.values[0];
        action = 'MEMBER_RANK_SET';
    }
    else if (sub === 'set-member' || sub === 'clear-member') {
        after = service.assignment(after, c, i.values[0], sub === 'clear-member');
        action = sub === 'set-member' ? 'MEMBER_ASSIGNED' : 'MEMBER_ASSIGNMENT_REMOVED';
    }
    else if (sub === 'status') {
        after.status = i.options.getString('value', true);
        if (!live && after.status !== 'LEFT' && after.status !== 'RETIRED')
            throw new Error('Absent members must remain LEFT or RETIRED');
        action = 'MEMBER_STATUS_CHANGED';
    }
    else if (['sync-member', 'sync-roles', 'sync-join-history'].includes(sub)) {
        if (!live && after.status !== 'RETIRED')
            after.status = 'LEFT';
        else if (live) {
            after.displayName = live.displayName;
            if (live.joinedAt)
                after.joinedAt = live.joinedAt.toISOString();
            if (after.status === 'LEFT')
                after.status = 'INACTIVE';
        }
    }
    else
        throw new Error('Unsupported member operation');
    if (!live && !['LEFT', 'RETIRED'].includes(after.status))
        throw new Error('Member has left the server; synchronize status first');
    await service.change(before, after, c, i.user.id, action, component ? 'Selected in administration panel' : i.options.getString('reason') ?? sub, live ? roleAdapter(live, await i.guild.roles.fetch(), desiredMemberRoles(after, c)) : undefined);
    await i.editReply({ content: `Saved and audited member <@${memberId}>: ${action.toLowerCase().replaceAll('_', ' ')}.`, components: [], allowedMentions: { parse: [] } });
}
export function seedMember(guildId: string, member: any, c: OrganizationConfig): MemberState {
    const ranks = c.ranks.filter(r => r.roleId && member.roles.cache.has(r.roleId));
    if (ranks.length > 1)
        throw new Error(`Member ${member.id} has multiple configured rank roles. Remove the obsolete Discord rank role before importing`);
    return { guildId, memberId: member.id, displayName: member.displayName, status: 'INACTIVE', notes: [], version: 0, dutyIds: c.duties.filter(d => member.roles.cache.has(d.roleId)).map(d => d.roleId), entryIds: c.entries.filter(e => e.roleId && member.roles.cache.has(e.roleId)).map(e => e.id), ...(ranks[0] ? { rankId: ranks[0].id } : {}), ...(member.joinedAt ? { joinedAt: member.joinedAt.toISOString() } : {}) };
}
function choicePanel(owner: string, sub: string, member: string, options: Array<{
    id: string;
    name: string;
}>, page: number): any {
    const slice = options.slice(page * 25, page * 25 + 25);
    if (!slice.length)
        throw new Error('No choices on this page');
    const components: any[] = [{ type: 1, components: [{ type: 3, custom_id: `member:${owner}:${sub}:${member}:select`, placeholder: 'Select configured target', options: slice.map(x => ({ label: x.name.slice(0, 100), value: x.id })) }] }];
    const pages = [];
    if (page > 0)
        pages.push({ label: 'Previous', value: String(page - 1) });
    if ((page + 1) * 25 < options.length)
        pages.push({ label: 'Next', value: String(page + 1) });
    if (pages.length)
        components.push({ type: 1, components: [{ type: 3, custom_id: `member:${owner}:${sub}:${member}:page`, placeholder: `Page ${page + 1}`, options: pages }] });
    return { content: 'Select a target. Authorization and configuration are checked again when submitted.', components };
}
