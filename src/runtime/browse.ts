import type { RuntimeRepositories } from './bot.js';
import { choices, requireTier } from './interactions.js';

type Search = { guild: string; owner: string; system: string; query: string; expires: number };
const searches = new Map<string, Search>();
export async function browse(i: any, store: RuntimeRepositories, system?: string, query = ''): Promise<void> {
    await requireTier(i, store, 'BASELINE');
    let key: string, page = 0, direction = 1, state: Search;
    if (system) {
        for (const [key, value] of searches) if (value.expires <= Date.now()) searches.delete(key);
        if (searches.size >= 1000) searches.delete(searches.keys().next().value!);
        key = crypto.randomUUID(); state = { guild: i.guildId, owner: i.user.id, system, query: query.toLocaleLowerCase(), expires: Date.now() + 15 * 60000 }; searches.set(key, state);
    } else {
        const p = i.customId.split(':'); key = p[1]; page = Number(p[2]); direction = p[3] === 'back' ? -1 : 1;
        const saved = searches.get(key);
        if (!saved || saved.expires <= Date.now()) { await i.reply({ content: 'This search expired. Open /help and start a new search.', ephemeral: true }); return; }
        if (saved.guild !== i.guildId || saved.owner !== i.user.id) throw new Error('Open your own panel to search.');
        if (!Number.isSafeInteger(page) || page < 0) throw new Error('Open a fresh search panel.');
        state = saved;
    }
    await i.deferReply({ ephemeral: true });
    let rows: any[] = [], matches: any[] = [];
    // At most 250 records are inspected per interaction. Continue Search reaches later
    // pages without unbounded database reads or assuming an organization has <25 rows.
    for (let n = 0; n < 10; n++) {
        rows = state.system === 'reference' ? await store.optional(i.guildId, 'reference', 'list', i.user.id, undefined, { page }) : await store.workflow(i.guildId, 'assignment', 'list', i.user.id, undefined, { page });
        matches = rows.filter(r => state.system === 'reference' ? `${r.key} ${r.title} ${r.body}`.toLocaleLowerCase().includes(state.query) : (r.payload?.claimed ?? []).includes(i.user.id));
        if (matches.length || (direction > 0 && rows.length < 25) || page === 0 && direction < 0 || n === 9) break;
        page += direction;
    }
    const prefix = state.system === 'reference' ? `optional:${i.user.id}:reference:get` : `flow:${i.user.id}:assignment:list`;
    const payload = choices(prefix, matches.map(r => ({ id: r.id, name: r.title ?? r.key }))); // only read actions
    payload.content = matches.length ? `${state.system === 'reference' ? 'Reference search results' : 'Your claimed assignments'}. Choose an item to view it.` : 'No matches in these pages. Continue Search checks the next batch.';
    const nav = [];
    if (page > 0) nav.push({ type: 2, style: 2, label: 'Previous', custom_id: `uxbrowse:${key}:${page - 1}:back` });
    if (rows.length === 25) nav.push({ type: 2, style: 2, label: matches.length ? 'Next' : 'Continue Search', custom_id: `uxbrowse:${key}:${page + 1}:next` });
    if (!matches.length && !nav.length) payload.content = 'No matching records. Open the feature panel to try another search.';
    if (nav.length) payload.components.push({ type: 1, components: nav });
    await i.editReply(payload);
}
