export const permissionTiers = ["BASELINE", "LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"] as const;
export type PermissionTier = typeof permissionTiers[number];
export type Requirement = PermissionTier | "ADMIN";
export type ModuleKey = "briefings" | "patrols" | "supply" | "atlas";
export interface ServerConfig {
    guildId: string;
    organizationName: string;
    commandNamespace: string;
    confidentialityMarker: string;
    modules: Record<ModuleKey, boolean>;
}
export interface PermissionRole {
    guildId: string;
    roleId: string;
    tier: PermissionTier;
}
export interface Rank {
    id: string;
    guildId: string;
    name: string;
    roleId?: string;
    tier: PermissionTier;
}
export interface RankEdge {
    guildId: string;
    fromRankId: string;
    toRankId: string;
    branchId: string;
}
export interface AssignmentGroup {
    id: string;
    guildId: string;
    name: string;
    multiple: boolean;
    required: boolean;
}
export interface AssignmentEntry {
    id: string;
    groupId: string;
    name: string;
    roleId?: string;
}
export interface MemberAssignment {
    guildId: string;
    memberId: string;
    entryId: string;
}
export type MemberStatus = "ACTIVE" | "INACTIVE" | "RETIRED" | "LEFT";
export interface MemberRecord {
    guildId: string;
    memberId: string;
    displayName: string;
    rankId?: string;
    status: MemberStatus;
    joinedAt?: string;
    lastActiveAt?: string;
    notes: string[];
}
export interface DutyRole {
    guildId: string;
    roleId: string;
    displayName: string;
}
export function highestTier(roleIds: Iterable<string>, mappings: PermissionRole[]): PermissionTier | undefined {
    const roles = new Set(roleIds);
    return mappings.filter(m => roles.has(m.roleId)).map(m => m.tier)
        .sort((a, b) => permissionTiers.indexOf(b) - permissionTiers.indexOf(a))[0];
}
export function satisfies(roleIds: Iterable<string>, requirement: Requirement, mappings: PermissionRole[], administrator = false): boolean {
    if (administrator)
        return true;
    if (requirement === "ADMIN")
        return false;
    const actual = highestTier(roleIds, mappings);
    return actual !== undefined && permissionTiers.indexOf(actual) >= permissionTiers.indexOf(requirement);
}
export function advancementOptions(currentRankId: string, edges: RankEdge[], ranks: Rank[]): Rank[] {
    const rankById = new Map(ranks.map(rank => [rank.id, rank]));
    return [...new Set(edges.filter(edge => edge.fromRankId === currentRankId).map(edge => edge.toRankId))]
        .map(id => rankById.get(id)).filter((rank): rank is Rank => rank !== undefined);
}
export function rolesForRank(currentRankId: string | undefined, ranks: Rank[]): string[] {
    if (!currentRankId)
        return [];
    const rank = ranks.find(item => item.id === currentRankId);
    return rank?.roleId ? [rank.roleId] : [];
}
export function assignMember(existing: MemberAssignment[], next: MemberAssignment, entries: AssignmentEntry[], group: AssignmentGroup): MemberAssignment[] {
    const entry = entries.find(item => item.id === next.entryId);
    if (!entry || entry.groupId !== group.id || next.guildId !== group.guildId)
        throw new Error("Assignment entry is not in this group");
    const withoutDuplicate = existing.filter(item => !(item.guildId === next.guildId && item.memberId === next.memberId && item.entryId === next.entryId));
    if (group.multiple)
        return [...withoutDuplicate, next];
    const groupEntryIds = new Set(entries.filter(item => item.groupId === group.id).map(item => item.id));
    return [...withoutDuplicate.filter(item => !(item.guildId === next.guildId && item.memberId === next.memberId && groupEntryIds.has(item.entryId))), next];
}
