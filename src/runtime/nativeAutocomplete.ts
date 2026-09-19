import { assertContactCreationContext, contactRequirement } from './contactPermissions.js';
import type { RuntimeRepositories } from './bot.js';
import { requireTier } from './interactions.js';
import { requireFeature } from './features.js';
import { panelRequirement } from './panels.js';
/** Suggestions are a guild-scoped convenience; handlers always revalidate on submission. */
export async function autocompleteNative(i: any, store: RuntimeRepositories): Promise<void> {
    try {
        const config = await store.load(i.guildId);
        if (!config) {
            await i.respond([]);
            return;
        }
        const system = i.commandName === config.commandNamespace ? i.commandName : i.commandName === 'promotion' ? 'advancement' : i.commandName === 'apprenticeship' ? 'mentorship' : i.commandName;
        const module = ({ atlas: 'atlas', briefing: 'briefings', patrol: 'patrols', supply: 'supply' } as const)[system as 'atlas'];
        if (module && !config.modules[module]) {
            await i.respond([]);
            return;
        }
        await requireFeature(store, i.guildId, system);
        const need = panelRequirement(system, i.options.getSubcommand(), config.commandNamespace);
        if (need !== 'ANY')
            await requireTier(i, store, need);
        const focused=i.options.getFocused(true);if(system==='contact'&&contactRequirement(i.options.getSubcommand())==='LEVEL_1'){assertContactCreationContext(i);if(focused.name!=='assignment'){await i.respond([]);return;}}
        const key = focused, q = String(key.value).toLowerCase();
        let rows: Array<{
            id: string;
            name: string;
        }> = [];
        const org = await store.organization(i.guildId);
        if (['duty', 'position'].includes(key.name))
            rows = org.duties.map(d => ({ id: d.roleId, name: d.displayName }));
        else if (['rank', 'target_rank', 'minimum_rank'].includes(key.name))
            rows = org.ranks;
        else if (key.name === 'assignment')
            rows = org.entries.map(e => ({ id: e.id, name: `${org.groups.find(g => g.id === e.groupId)?.name}: ${e.name}` }));
        else if (key.name === 'application')
            rows = (await store.workflow<any[]>(i.guildId, 'application', 'list', i.user.id)).filter(r => r.status === 'OPEN').map(r => ({ id: r.id, name: `${org.duties.find(d => d.roleId === r.duty_role_id)?.displayName ?? 'Duty'} — ${r.status}` }));
        else if (key.name === 'vote')
            rows = system === 'advancement' ? (await store.advancement<any[]>(i.guildId, 'list', i.user.id)).map(r => ({ id: r.id, name: `${r.candidate_id}: ${r.status}` })) : (await store.workflow<any[]>(i.guildId, 'vote', 'list', i.user.id)).map(r => ({ id: r.id, name: `${r.title}: ${r.status}` }));
        else if (key.name === 'topic')
            rows = await store.intelligence<any[]>(i.guildId, 'topics', i.user.id);
        else if (['trailmark', 'patrol_primary'].includes(key.name))
            rows = (await store.trailmark<any[]>(i.guildId, 'list', i.user.id)).filter(r => r.active);
        else if (['contact', 'contact_2', 'contact_3', 'group', 'person'].includes(key.name))
            rows = (await store.intelligence<any[]>(i.guildId, 'contacts', i.user.id, undefined, { active: true })).filter(r => r.active && (key.name === 'group' ? r.kind === 'GROUP' : key.name === 'person' ? r.kind === 'CONTACT' : true));
        await i.respond(rows.filter(r => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)).slice(0, 25).map(r => ({ name: r.name.slice(0, 100), value: r.id })));
    }
    catch {
        await i.respond([]);
    }
}
