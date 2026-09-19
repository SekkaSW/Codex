import type { WorkflowRepositories } from './handlers/workflows.js';
import { requireFeature } from './features.js';
import { requireTier, interactionUuid, replyText } from './interactions.js';
import { nativeCall } from './nativeWorkflows.js';
import { DiscordIntelligence, DiscordDurablePublisher } from './intelligenceDiscord.js';
import { DurableSummary } from '../workflows.js';
const profileKeys = ['race', 'sex', 'occupation', 'assignment', 'faction', 'usual_locations', 'commentary', 'category', 'group_category', 'estimated_size', 'identifying_features', 'weapons_capabilities', 'tactics'];
const label = (k: string) => k.split('_').map(x => x[0]!.toUpperCase() + x.slice(1)).join(' ');
function assessmentControls(c: any) { return [{ type: 1, components: ['good', 'cold', 'not_found', 'mia', 'archive'].map((value, n) => ({ type: 2, style: n === 0 ? 3 : n === 1 || n === 4 ? 4 : 2, label: (c.kind === 'GROUP' ? ['Active', 'Inactive', 'Not sighted', 'Disbanded', 'Propose archive'] : ['Still good', 'Cold', 'Not found', 'MIA', 'Propose archive'])[n], custom_id: 'native:contact-assessment:' + c.id + ':' + value, disabled: !c.active })) }]; }
export async function handleNativeIntelligence(i: any, store: WorkflowRepositories): Promise<boolean> {
    const component = i.customId?.split(':');
    if (component?.[1] === 'contact-assessment') {
        await requireFeature(store, i.guildId, 'intel');
        await requireTier(i, store, 'LEVEL_3');
        await i.deferReply({ ephemeral: true });
        const c = await nativeCall(store, i.guildId, 'contact-assessment', i.user.id, component[2], { assessment: component[3] });
        await i.editReply(replyText('Assessment saved and audited for ' + c.name + '. Archive proposals do not archive the record automatically.'));
        return true;
    }
    if (!['contact', 'intel'].includes(i.commandName))
        return false;
    await requireFeature(store, i.guildId, 'intel');
    const action = i.options.getSubcommand();
    if (i.commandName === 'intel' && !['topic-add', 'topic-edit', 'catchall-set', 'set-hq', 'refresh', 'repair-reporters', 'backfill'].includes(action))
        return false;
    await requireTier(i, store, 'LEVEL_3');
    const discord = new DiscordIntelligence(i.guild, store), actor = i.user.id, guild = i.guildId;
    if (i.commandName === 'contact') {
        if (!['setup', 'create', 'create-group', 'edit', 'list', 'link-member', 'unlink-member', 'archive'].includes(action))
            return false;
        await i.deferReply({ ephemeral: true });
        if (action === 'setup') {
            const category = i.options.getChannel('category');
            if (category) {
                if (category.guildId !== guild || category.type !== 4)
                    throw new Error('Choose a category in this server');
                await store.put({ guildId: guild, key: 'INTELLIGENCE_CATEGORY', discordId: category.id, kind: 'CATEGORY' });
            }
            await discord.refresh();
            await i.editReply(replyText('Contacts Forum is ready. Existing IDs are preserved.'));
            return true;
        }
        if (['create', 'create-group', 'edit'].includes(action)) {
            const old = action === 'edit' ? await store.intelligence<any>(guild, 'contact-get', actor, i.options.getString('contact', true)) : undefined;
            const detail = { ...(old?.detail ?? {}) };
            for (const key of profileKeys) {
                const v = i.options.getString(key);
                if (v !== null)
                    detail[key] = v;
            }
            const priority = i.options.getBoolean('high_priority');
            if (priority !== null)
                detail.high_priority = priority;
            if (detail.category)
                detail.group_category = detail.category;
            if (detail.assignment && !(await store.organization(guild)).entries.some(e => e.id === detail.assignment))
                throw new Error('Choose a configured assignment in this server');
            const name = i.options.getString('name') ?? old?.name;
            if (!name?.trim())
                throw new Error('Contact name required');
            const description = Object.entries(detail).map(([k, v]) => `${label(k)}: ${v}`).join('\n');
            const c = await nativeCall(store, guild, 'contact-save', actor, old?.id ?? interactionUuid(i.id), { name, kind: old?.kind ?? (action === 'create-group' ? 'GROUP' : 'CONTACT'), description: description.slice(0, 2000), revision: old?.revision, detail });
            try {
                const threadId = await discord.contact(c);
                const thread = await i.guild.channels.fetch(threadId);
                const starter = await thread.fetchStarterMessage();
                if (starter?.author.id === i.guild.client.user.id)
                    await starter.edit({ components: assessmentControls(c), embeds: [{ title: c.name, description: description.slice(0, 4096) }], allowedMentions: { parse: [] } });
                await i.editReply(replyText(`${c.name} saved: <#${threadId}>.`));
            }
            catch {
                await i.editReply(replyText(`Contact ${c.id} saved; Forum delivery needs recovery through /contact repair.`));
            }
            return true;
        }
        if (action === 'list') {
            const filters = Object.fromEntries(['assignment', 'occupation', 'group_category'].map(k => [k, i.options.getString(k)])), type = i.options.getString('type'), priority = i.options.getBoolean('high_priority');
            const rows = await store.intelligence<any[]>(guild, 'contacts', actor);
            const matched = rows.filter(r => (!type || r.kind === (type.toLowerCase().includes('group') ? 'GROUP' : 'CONTACT')) && Object.entries(filters).every(([k, v]) => !v || r.detail?.[k] === v) && (priority === null || !!r.detail?.high_priority === priority));
            await i.editReply(replyText(matched.map(r => `${r.name} — ${r.kind}${r.active ? '' : ' (Archived)'}\n${r.description}`).join('\n\n') || 'No matching contacts.'));
            return true;
        }
        if (action === 'link-member' || action === 'unlink-member') {
            const group = await store.intelligence<any>(guild, 'contact-get', actor, i.options.getString('group', true)), person = await store.intelligence<any>(guild, 'contact-get', actor, i.options.getString('person', true));
            if (group.kind !== 'GROUP' || person.kind !== 'CONTACT' || !group.active || !person.active)
                throw new Error('Choose an active group and person');
            const ids = new Set<string>(group.contacts);
            if (action === 'link-member')
                ids.add(person.id);
            else
                ids.delete(person.id);
            await store.intelligence(guild, 'contact-group', actor, group.id, { revision: group.revision, contacts: [...ids] });
            await i.editReply(replyText('Contact group membership updated.'));
            return true;
        }
        const c = await store.intelligence<any>(guild, 'contact-get', actor, i.options.getString('contact', true));
        await store.intelligence(guild, 'contact-archive', actor, c.id, { revision: c.revision });
        await store.audit(guild, actor, c.id, 'CONTACT_ARCHIVE_REASON', { reason: i.options.getString('reason') });
        if (c.forum_thread_id) {
            const thread = await discord.fetch(c.forum_thread_id);
            if (thread?.isThread())
                await thread.setArchived(true);
        }
        await i.editReply(replyText('Contact archived; history retained.'));
        return true;
    }
    await i.deferReply({ ephemeral: true });
    if (action === 'set-hq') {
        const id = i.options.getString('trailmark', true);
        await store.trailmark(guild, 'hq', actor, id);
        await i.editReply(replyText('Headquarters Trailmark updated.'));
        return true;
    }
    const topics = await store.intelligence<any[]>(guild, 'topics', actor);
    if (action === 'repair-reporters' || action === 'backfill') {
        const selected = i.options.getString('topic'), topic = selected ? topics.find(t => t.id === selected) : undefined;
        if (selected && !topic)
            throw new Error('Topic not found in this server');
        const mode = i.options.getString('mode') ?? 'historical-delivery', after = i.options.getString('after'), limit = i.options.getInteger('limit_per_trailmark') ?? 500;
        if (!['historical-delivery', 'pending-only'].includes(mode) || !Number.isInteger(limit) || limit < 1 || limit > 5000)
            throw new Error('Choose a valid backfill mode and scan limit');
        if (after && (!/^\d{4}-\d{2}-\d{2}$/.test(after) || !Number.isFinite(Date.parse(after)) || new Date(after).toISOString().slice(0, 10) !== after))
            throw new Error('Use a valid YYYY-MM-DD date');
        const rows: any[] = [];
        for (let page = 0; page < 200; page++) {
            const batch = await store.intelligence<any[]>(guild, 'reports', actor, undefined, { page });
            rows.push(...batch);
            if (batch.length < 25)
                break;
        }
        let updated = 0, missing = 0, failed = 0, checked = 0;
        const counts = new Map<string, number>();
        for (const r of rows) {
            if (topic && r.topic !== topic.name)
                continue;
            if (after && Date.parse(r.created_at) < Date.parse(after))
                continue;
            const key = r.source_trailmark_id ?? 'unassigned', count = counts.get(key) ?? 0;
            if (count >= limit)
                continue;
            counts.set(key, count + 1);
            checked++;
            try {
                if (action === 'repair-reporters') {
                    const receipt = await store.intelligence<any>(guild, 'delivery-get', actor, undefined, { key: 'report:' + r.id });
                    if (!receipt?.message_id) {
                        missing++;
                        continue;
                    }
                    const channel = await discord.fetch(receipt.channel_id);
                    if (!channel) {
                        missing++;
                        continue;
                    }
                    const message = await channel.messages.fetch(receipt.message_id);
                    if (message.author.id !== i.guild.client.user.id || !message.embeds.some((e: any) => e.footer?.text === 'codex-delivery:report:' + r.id)) {
                        missing++;
                        continue;
                    }
                    const reporter = r.reporter_id ?? r.author_id;
                    let name = reporter ?? 'Unknown';
                    if (reporter)
                        try {
                            name = (await i.guild.members.fetch(reporter)).displayName;
                        }
                        catch (error) {
                            if ((error as any).code !== 10007)
                                throw error;
                        }
                    await message.edit({ embeds: [{ description: ('Reporter: ' + name + '\n' + r.body).slice(0, 4096), footer: { text: 'codex-delivery:report:' + r.id } }], allowedMentions: { parse: [] } });
                    updated++;
                }
                else {
                    if (mode === 'pending-only' && r.delivery_status === 'PUBLISHED')
                        continue;
                    if (r.delivery_status === 'CAPTURED') {
                        if (mode === 'pending-only')
                            continue;
                        await store.intelligence(guild, 'report-hq', actor, r.id);
                    }
                    if (await discord.pipeline.process(guild, r.id))
                        updated++;
                }
            }
            catch {
                failed++;
            }
        }
        await i.editReply(replyText('Checked ' + checked + ' persisted reports; updated ' + updated + '; missing deliveries ' + missing + '; retryable failures ' + failed + '. The scan is bounded to 5,000 persisted reports and the selected per-Trailmark limit. Unrecognized historical Discord messages are not imported.'));
        return true;
    }
    if (action === 'topic-add' || action === 'topic-edit') {
        const old = action === 'topic-edit' ? topics.find(t => t.id === i.options.getString('topic', true)) : undefined;
        if (action === 'topic-edit' && !old)
            throw new Error('Topic not found in this server');
        const channel = i.options.getChannel('channel');
        if (channel && (channel.guildId !== guild || ![0, 5].includes(channel.type)))
            throw new Error('Choose a local report channel');
        const input = i.options.getString('keywords', true).split(',').map((x: string) => x.trim()).filter(Boolean), keywords = [...new Set([...(old && (i.options.getBoolean('append') ?? true) ? old.keywords : []), ...input])];
        const t = old ? await store.intelligence<any>(guild, 'topic-save', actor, old.id, { name: old.name, priority: old.priority, revision: old.revision, keywords }) : await nativeCall(store, guild, 'topic-create', actor, interactionUuid(i.id), { name: i.options.getString('name', true), keywords, priority: 0 });
        if (channel) {
            await store.put({ guildId: guild, key: `REPORT_TOPIC:${t.id}`, discordId: channel.id, kind: 'CHANNEL' });
        }
        else
            await discord.topic(t);
        await i.editReply(replyText(`Topic ${t.name} saved: ${keywords.join(', ')}.`));
        return true;
    }
    if (action === 'catchall-set') {
        const selected = i.options.getString('topic'), channel = i.options.getChannel('channel');
        let destination = channel?.id;
        if (channel && (channel.guildId !== guild || ![0, 5].includes(channel.type)))
            throw new Error('Choose a local report channel');
        if (selected) {
            const topic = topics.find(t => t.id === selected);
            if (!topic)
                throw new Error('Topic not found in this server');
            destination = await discord.topic(topic);
        }
        if (!destination) {
            const name = i.options.getString('name');
            if (name) {
                const topic = await nativeCall(store, guild, 'topic-create', actor, interactionUuid(i.id), { name, keywords: [], priority: 100000 });
                destination = await discord.topic(topic);
            }
            else
                destination = await discord.topic();
        }
        await store.put({ guildId: guild, key: 'REPORT_CATCHALL', discordId: destination, kind: 'CHANNEL' });
        await i.editReply(replyText('Catch-all destination saved. Unclassified reports retain a local destination.'));
        return true;
    }
    if (action === 'refresh') {
        const topic = topics.find(t => t.id === i.options.getString('topic', true));
        if (!topic)
            throw new Error('Topic not found in this server');
        const reports: any[] = [];
        for (let page = 0; page < 100; page++) {
            const batch = await store.intelligence<any[]>(guild, 'reports', actor, undefined, { page });
            reports.push(...batch.filter(r => r.topic === topic.name && r.delivery_status !== 'CAPTURED'));
            if (batch.length < 25)
                break;
        }
        await new DurableSummary(store, new DiscordDurablePublisher(i.guild)).refresh(guild, `topic-bulletin:${topic.id}`, await discord.topic(topic), `${topic.name}\n${reports.map(r => `${r.created_at}: ${r.body}`).join('\n\n') || 'No delivered reports.'}`);
        await i.editReply(replyText(`Refreshed ${topic.name}: ${reports.length} delivered reports in the bounded history scan.`));
        return true;
    }
    return false;
}
