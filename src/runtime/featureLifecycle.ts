import type { FieldStore, AccessSession } from '../field.js';
import type { StoredSetupDraft } from '../setup.js';
import type { RuntimeRepositories } from './bot.js';
import { DiscordTrailmarkAccess } from './trailmarkAccess.js';
/** One-time cleanup at explicit confirmation, before workers are switched off. */
export async function closeTrailmarkAccess(guildId: string, actor: string, store: FieldStore, revoke: (trailmark: any, member: string) => Promise<void>): Promise<void> {
    for (let batch = 0; batch < 10; batch++) {
        const sessions = await store.trailmark<AccessSession[]>(guildId, 'sessions', actor, undefined, { all: true });
        if (!sessions.length)
            return;
        for (const session of sessions) {
            const trailmark = await store.trailmark(guildId, 'get', actor, session.trailmark_id);
            await store.trailmark(guildId, 'session-revoke', actor, session.id);
            await revoke(trailmark, session.discord_member_id);
            await store.trailmark(guildId, 'session-closed', actor, session.id);
        }
    }
    throw new Error('Setup closed a batch of temporary access sessions. Confirm again to finish disabling Trailmarks.');
}
export async function prepareFeatureChange(d: StoredSetupDraft, guild: any, store: RuntimeRepositories): Promise<void> {
    const previous = await store.load(d.guildId);
    if (previous && previous.modules.trailmarks !== false && d.config.modules?.trailmarks === false) {
        const adapter = new DiscordTrailmarkAccess(guild, store);
        await closeTrailmarkAccess(d.guildId, d.ownerId, store, (trailmark, member) => adapter.revoke(trailmark, member));
    }
}
