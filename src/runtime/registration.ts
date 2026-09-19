import { commandDefinitions } from './commands.js';
/** Upsert only this scope's definitions. Never bulk-replace unrelated guild commands. */
export function registrationPlan(guildId?: string, namespace?: string) {
    if (namespace && !guildId)
        throw new Error('An organization namespace requires DISCORD_GUILD_ID; organization roots are guild-only');
    if (guildId && !namespace)
        throw new Error('Guild registration requires its configured ORGANIZATION_NAMESPACE');
    if (namespace && !/^[a-z][a-z0-9_-]{0,31}$/.test(namespace))
        throw new Error('Use the exact configured namespace without a slash');
    const definitions = commandDefinitions(namespace) as any[];
    if (!guildId)
        return definitions;
    const root = definitions.find(c => c.name === namespace);
    if (!root || !root.options?.some((s: any) => s.name === 'sync-member'))
        throw new Error('Namespace collides with a core command');
    return [root];
}
