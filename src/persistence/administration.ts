import type { AdministrationStore, MemberNote, MemberState, OrganizationConfig } from '../administration.js';
import { PersistenceUncertainError } from '../administration.js';
import type { ServerConfig } from '../domain.js';
import type { SupabaseClientLike } from './supabase.js';
export class AdministrationRepository implements AdministrationStore {
    constructor(protected readonly client: SupabaseClientLike) { }
    protected async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
        const { data, error } = await this.client.rpc<T>(name, args);
        if (error)
            throw new Error(error.message);
        return data as T;
    }
    organization(guildId: string): Promise<OrganizationConfig> { return this.rpc('codex_organization', { p_guild: guildId }); }
    saveOrganization(config: ServerConfig, organization: OrganizationConfig, actorId: string): Promise<void> { return this.rpc('codex_save_organization', { p_config: config, p_organization: organization, p_actor: actorId }); }
    members(guildId: string): Promise<MemberState[]> { return this.rpc('codex_members', { p_guild: guildId }); }
    async member(guildId: string, memberId: string): Promise<MemberState | undefined> { return (await this.rpc<MemberState[]>('codex_members', { p_guild: guildId, p_member: memberId }))[0]; }
    async commitMember(before: MemberState | undefined, after: MemberState, actorId: string, action: string, reason: string): Promise<void> {
        const operation = crypto.randomUUID();
        let result;
        try {
            result = await this.client.rpc('codex_commit_member', { p_before_version: before?.version ?? -1, p_member: after, p_actor: actorId, p_action: action, p_reason: reason, p_operation: operation });
        }
        catch {
            throw new PersistenceUncertainError('Database response was interrupted. Discord changes were retained because commit status is unknown. Run member synchronization before retrying.');
        }
        if (result.error) {
            // PostgREST SQL errors are definitive; network errors may arrive as an empty-code result.
            const code = (result.error as {
                code?: string;
            }).code;
            if (code && /^(P0001|22|23|42)/.test(code))
                throw new Error(result.error.message);
            try {
                if (await this.rpc<boolean>('codex_operation_committed', { p_operation: operation }))
                    return;
            }
            catch { }
            throw new PersistenceUncertainError('Database commit could not be confirmed. Run member synchronization before retrying. ' + result.error.message);
        }
    }
    async notes(guildId: string, memberId: string): Promise<MemberNote[]> {
        const { data, error } = await this.client.from('member_notes').select().eq('guild_id', guildId).eq('discord_member_id', memberId).order('created_at');
        if (error)
            throw new Error(error.message);
        return (data as any[]).map(r => ({ id: r.id, authorId: r.author_id, body: r.body, visibility: r.visibility, createdAt: r.created_at }));
    }
    addNote(guildId: string, memberId: string, actorId: string, body: string, visibility: 'ADMIN' | 'MEMBER'): Promise<void> { return this.rpc('codex_add_note', { p_guild: guildId, p_member: memberId, p_actor: actorId, p_body: body, p_visibility: visibility }); }
    async memberAudit(guildId: string, memberId: string): Promise<unknown[]> {
        const { data, error } = await this.client.from('audit_events').select().eq('guild_id', guildId).eq('subject_id', memberId).order('created_at', { ascending: false }).limit(100);
        if (error)
            throw new Error(error.message);
        return data as unknown[];
    }
}
