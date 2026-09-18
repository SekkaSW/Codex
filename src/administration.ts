import { advancementOptions, assignMember, type AssignmentEntry, type AssignmentGroup, type DutyRole, type MemberAssignment, type MemberRecord, type PermissionRole, type Rank, type RankEdge, type ServerConfig } from './domain.js';
import { validateRankGraph } from './setup.js';
import type { ManagedResource, ResourceSpec } from './resources.js';
export interface OrganizationConfig {
    permissions: PermissionRole[];
    ranks: Rank[];
    branches: Array<{
        id: string;
        name: string;
    }>;
    edges: RankEdge[];
    duties: DutyRole[];
    groups: AssignmentGroup[];
    entries: AssignmentEntry[];
    resources: ManagedResource[];
    additionalResources: ResourceSpec[];
    ownedRoleIds?: string[];
}
export const emptyOrganization = (): OrganizationConfig => ({ permissions: [], ranks: [], branches: [], edges: [], duties: [], groups: [], entries: [], resources: [], additionalResources: [] });
export interface MemberState extends MemberRecord {
    version: number;
    dutyIds: string[];
    entryIds: string[];
}
export interface MemberNote {
    id: string;
    authorId: string;
    body: string;
    visibility: 'ADMIN' | 'MEMBER';
    createdAt: string;
}
export interface AdministrationStore {
    organization(guildId: string): Promise<OrganizationConfig>;
    saveOrganization(config: ServerConfig, organization: OrganizationConfig, actorId: string): Promise<void>;
    members(guildId: string): Promise<MemberState[]>;
    member(guildId: string, memberId: string): Promise<MemberState | undefined>;
    commitMember(before: MemberState | undefined, after: MemberState, actorId: string, action: string, reason: string): Promise<void>;
    notes(guildId: string, memberId: string): Promise<MemberNote[]>;
    addNote(guildId: string, memberId: string, actorId: string, body: string, visibility: 'ADMIN' | 'MEMBER'): Promise<void>;
    memberAudit(guildId: string, memberId: string): Promise<unknown[]>;
}
export function validateOrganization(guildId: string, c: OrganizationConfig): void {
    validateRankGraph(c.ranks.map(r => r.id), c.edges);
    for (const rows of [c.ranks, c.branches, c.groups, c.entries]) {
        if (new Set(rows.map(r => r.id)).size !== rows.length)
            throw new Error('Duplicate configuration identity');
        if (rows.some(r => !r.name.trim() || r.name.length > 100))
            throw new Error('Names must contain 1–100 characters');
    }
    for (const row of [...c.ranks, ...c.groups, ...c.edges, ...c.permissions, ...c.duties])
        if (row.guildId !== guildId)
            throw new Error('Configuration belongs to another guild');
    for (const edge of c.edges)
        if (!c.branches.some(b => b.id === edge.branchId))
            throw new Error('Progression references an unknown branch');
    for (const entry of c.entries)
        if (!c.groups.some(g => g.id === entry.groupId))
            throw new Error('Assignment entry references an unknown group');
    for (const rows of [c.ranks, c.branches, c.groups])
        if (new Set(rows.map(r => r.name)).size !== rows.length)
            throw new Error('Names must be unique within a configuration area');
    if (new Set(c.entries.map(e => `${e.groupId}:${e.name}`)).size !== c.entries.length)
        throw new Error('Entry names must be unique within a group');
    const roles = [...c.ranks.flatMap(r => r.roleId ? [r.roleId] : []), ...c.duties.map(d => d.roleId), ...c.entries.flatMap(e => e.roleId ? [e.roleId] : [])];
    if (new Set(roles).size !== roles.length)
        throw new Error('Rank, duty, and assignment roles must be distinct to allow safe synchronization');
}
export interface RoleMember {
    roles: Set<string>;
    add(roleId: string): Promise<void>;
    remove(roleId: string): Promise<void>;
}
export class PersistenceUncertainError extends Error {
}
export function managedRoles(c: OrganizationConfig): Set<string> { return new Set([...(c.ownedRoleIds ?? []), ...c.ranks.flatMap(r => r.roleId ? [r.roleId] : []), ...c.duties.map(d => d.roleId), ...c.entries.flatMap(e => e.roleId ? [e.roleId] : [])]); }
export function desiredMemberRoles(m: MemberState, c: OrganizationConfig): Set<string> {
    if (m.status === 'LEFT' || m.status === 'RETIRED')
        return new Set();
    return new Set([...c.ranks.filter(r => r.id === m.rankId).flatMap(r => r.roleId ? [r.roleId] : []), ...c.duties.filter(d => m.dutyIds.includes(d.roleId)).map(d => d.roleId), ...c.entries.filter(e => m.entryIds.includes(e.id)).flatMap(e => e.roleId ? [e.roleId] : [])]);
}
export class AdministrationService {
    constructor(private readonly store: AdministrationStore) { }
    async change(before: MemberState | undefined, after: MemberState, c: OrganizationConfig, actorId: string, action: string, reason: string, discord?: RoleMember, commit?:()=>Promise<void>): Promise<void> {
        if (before && (before.guildId !== after.guildId || before.memberId !== after.memberId))
            throw new Error('Member identity cannot change');
        if (after.rankId && !c.ranks.some(r => r.id === after.rankId))
            throw new Error('Unknown rank');
        if (after.entryIds.some(id => !c.entries.some(e => e.id === id)) || after.dutyIds.some(id => !c.duties.some(d => d.roleId === id)))
            throw new Error('Unknown duty or assignment');
        for (const group of c.groups) {
            const count = c.entries.filter(e => e.groupId === group.id && after.entryIds.includes(e.id)).length;
            if (!group.multiple && count > 1)
                throw new Error(`${group.name} allows only one membership`);
            if (group.required && count === 0 && after.status === 'ACTIVE')
                throw new Error(`${group.name} requires a membership; configure all required assignments before activating the member`);
        }
        const desired = desiredMemberRoles(after, c), managed = managedRoles(c);
        const changed: Array<{
            id: string;
            added: boolean;
        }> = [];
        try {
            if (discord) {
                for (const id of desired)
                    if (!discord.roles.has(id)) {
                        await discord.add(id);
                        changed.push({ id, added: true });
                    }
                for (const id of discord.roles)
                    if (managed.has(id) && !desired.has(id)) {
                        await discord.remove(id);
                        changed.push({ id, added: false });
                    }
            }
            if(commit)await commit();else await this.store.commitMember(before, after, actorId, action, reason);
        }
        catch (error) {
            if (error instanceof PersistenceUncertainError)
                throw error;
            const failures: string[] = [];
            if (discord)
                for (const change of changed.reverse())
                    try {
                        if (change.added)
                            await discord.remove(change.id);
                        else
                            await discord.add(change.id);
                    }
                    catch {
                        failures.push(change.id);
                    }
            if (failures.length)
                throw new Error(`Operation failed and role rollback failed for ${failures.join(', ')}. Run member synchronization. Cause: ${String(error)}`);
            throw error;
        }
    }
    promote(member: MemberState, c: OrganizationConfig, targetId?: string): MemberState {
        const options = member.rankId ? advancementOptions(member.rankId, c.edges, c.ranks) : [];
        if (!options.length)
            throw new Error('This member has no configured next rank');
        if (!targetId && options.length !== 1)
            throw new Error('Select one of the configured next ranks');
        const target = options.find(r => r.id === (targetId ?? options[0]!.id));
        if (!target)
            throw new Error('That target is not connected by an allowed advancement edge');
        if (member.status !== 'ACTIVE')
            throw new Error('Only active members can advance');
        return { ...member, rankId: target.id };
    }
    assignment(member: MemberState, c: OrganizationConfig, entryId: string, remove: boolean): MemberState {
        const entry = c.entries.find(e => e.id === entryId), group = c.groups.find(g => g.id === entry?.groupId);
        if (!entry || !group)
            throw new Error('Unknown assignment entry');
        const rows: MemberAssignment[] = member.entryIds.map(id => ({ guildId: member.guildId, memberId: member.memberId, entryId: id }));
        const next = remove ? rows.filter(r => r.entryId !== entryId) : assignMember(rows, { guildId: member.guildId, memberId: member.memberId, entryId }, c.entries, group);
        return { ...member, entryIds: next.map(r => r.entryId) };
    }
}
export function rosterRows(members: MemberState[], c: OrganizationConfig): string[][] {
    return [['Member', 'Discord ID', 'Status', 'Rank', 'Branch', 'Duties', ...c.groups.map(g => g.name)], ...members.map(m => [m.displayName, m.memberId, m.status, c.ranks.find(r => r.id === m.rankId)?.name ?? '', c.branches.filter(b => c.edges.some(e => e.branchId === b.id && (e.fromRankId === m.rankId || e.toRankId === m.rankId))).map(b => b.name).join('; '), c.duties.filter(d => m.dutyIds.includes(d.roleId)).map(d => d.displayName).join('; '), ...c.groups.map(g => c.entries.filter(e => e.groupId === g.id && m.entryIds.includes(e.id)).map(e => e.name).join('; '))])];
}
export function rosterCsv(members: MemberState[], c: OrganizationConfig): string {
    return rosterRows(members, c).map(row => row.map(value => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"').join(',')).join('\r\n');
}
