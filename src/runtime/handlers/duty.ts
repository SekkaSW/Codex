import { AdministrationService, desiredMemberRoles, type MemberState } from '../../administration.js';
import { authorize, seedMember, type MemberRepositories } from './members.js';
export interface DutyRepositories extends MemberRepositories {
    audit(guildId: string, actorId: string, subjectId: string, eventType: string, detail: Record<string, unknown>): Promise<void>;
}
export async function handleDuty(i: any, store: DutyRepositories): Promise<void> {
    await i.deferReply({ ephemeral: true });
    await authorize(i, store);
    const targetId = i.options.getUser('member')?.id ?? i.user.id;
    const before = await store.member(i.guildId, targetId), c = await store.organization(i.guildId), sub = i.options.getSubcommand();
    const requested = i.options.getString?.('duty');
    if(sub==='setup'){await i.editReply({content:'Configure duties in /server setup → Duties & Assignments. Managed duty roles are created only at final setup confirmation.',ephemeral:true});return;}
    if(sub==='list' && requested){const duty=c.duties.find(d=>d.roleId===requested||d.displayName.toLowerCase()===requested.toLowerCase());if(!duty)throw new Error('Choose a configured duty');const members=(await store.members(i.guildId)).filter(m=>m.dutyIds.includes(duty.roleId));await i.editReply({content:`${duty.displayName}: ${members.map(m=>m.displayName).join(', ')||'No assigned members'}`,allowedMentions:{parse:[]}});return;}
    if (sub === 'list') {
        const members=await store.members(i.guildId);const text=c.duties.map(d=>d.displayName+': '+(members.filter(m=>m.dutyIds.includes(d.roleId)).map(m=>m.displayName).join(', ')||'No assigned members')).join('\n')||'No configured duties';await i.editReply(text.length>1900?{content:'Duty holders attached.',files:[{attachment:Buffer.from(text),name:'duties.txt'}],allowedMentions:{parse:[]}}:{content:text,allowedMentions:{parse:[]}});
        return;
    }
    const roleId = requested ? c.duties.find(d=>d.roleId===requested||d.displayName.toLowerCase()===requested.toLowerCase())?.roleId : i.options.getRole('role', true).id;
    if (!c.duties.some(d => d.roleId === roleId))
        throw new Error('Select a configured duty role');
    const member = await i.guild.members.fetch({ user: targetId, force: true }), roles = await i.guild.roles.fetch();
    const after: MemberState = before ? structuredClone(before) : seedMember(i.guildId, member, c);
    if (['LEFT', 'RETIRED'].includes(after.status))
        throw new Error('Change member status before assigning or removing duties');
    if (sub === 'assign') {
        if (after.dutyIds.includes(roleId))
            throw new Error('Member already has this duty');
        after.dutyIds.push(roleId);
    }
    else if (sub === 'remove') {
        if (!after.dutyIds.includes(roleId))
            throw new Error('Member does not have this duty');
        after.dutyIds = after.dutyIds.filter(id => id !== roleId);
    }
    else
        throw new Error('Unsupported duty operation');
    for (const id of desiredMemberRoles(after, c))
        if (!roles.has(id))
            throw new Error('A configured role was deleted; update configuration');
    await new AdministrationService(store).change(before, after, c, i.user.id, sub === 'assign' ? 'DUTY_ASSIGNED' : 'DUTY_REMOVED', i.options.getString?.('reason')??sub, {
        roles: new Set<string>(member.roles.cache.keys()), async add(id) { await member.roles.add(id, 'Codex duty change'); }, async remove(id) { if (roles.has(id))
            await member.roles.remove(id, 'Codex duty change'); }
    });
    await i.editReply({ content: `Duty ${sub === 'assign' ? 'assigned' : 'removed'}; member state and audit saved.`, allowedMentions: { parse: [] } });
}
