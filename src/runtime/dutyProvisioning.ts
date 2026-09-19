import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import type { StoredSetupDraft } from '../setup.js';
export interface DutyCreationStore {
    managedDuty(guild: string, id: string, action: string, actor: string, data: Record<string, unknown>): Promise<any>;
}
/** Durable reservation before Discord creation; never retry an uncertain create by name. */
export async function provisionDuties(d: StoredSetupDraft, guild: any, store: DutyCreationStore): Promise<void> {
    for (const duty of d.managedDuties ?? []) {
        if (d.organization!.duties.some(x => x.displayName.toLowerCase() === duty.name.toLowerCase()))
            continue;
        const me = await guild.members.fetchMe();
        if (!me.permissions.has(PermissionFlagsBits.ManageRoles) || me.roles.highest.position <= 1)
            throw new Error('Move the bot role above duty roles and grant Manage Roles before confirming setup.');
        const receipt = await store.managedDuty(d.guildId, duty.id, 'reserve', d.ownerId, { name: duty.name });
        const reason = `Codex duty ${receipt.attempt}`;
        let role: any;
        if (receipt.role_id) {
            role = await guild.roles.fetch(receipt.role_id);
            if (!role)
                throw new Error('A managed duty role was deleted. Map a replacement duty role in Detailed Editor before retrying.');
        }
        else if (receipt.fresh) {
            role = await guild.roles.create({ name: duty.name, permissions: 0n, mentionable: false, hoist: false, reason });
        }
        else {
            if (me.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
                const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 100 });
                const matches = [...logs.entries.values()].filter((x: any) => x.reason === reason && x.executorId === me.id);
                if (matches.length === 1)
                    role = await guild.roles.fetch((matches[0] as any).targetId);
            }
            if (!role)
                throw new Error('Duty role creation has an uncertain outcome. Use Detailed Editor to map the existing role with this duty name, then retry. Codex will not create a duplicate.');
        }
        if (!role.editable || role.managed)
            throw new Error('Move the bot role above the managed duty role before retrying.');
        await store.managedDuty(d.guildId, receipt.id, 'complete', d.ownerId, { attempt: receipt.attempt, roleId: role.id });
        d.organization!.duties.push({ guildId: d.guildId, roleId: role.id, displayName: duty.name });
    }
}
