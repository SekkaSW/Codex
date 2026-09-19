import { referenceCategories, referenceAuthorities, referenceContexts, referenceConfidentialities } from './nativeConstants.js';
import type { WorkflowRepositories } from './handlers/workflows.js';
import { workflowDestination } from './handlers/workflows.js';
import { interactionUuid, requireTier, replyText, textModal } from './interactions.js';
import { DurableDelivery } from '../intelligence.js';
import { DurableSummary } from '../workflows.js';
import { DiscordDurablePublisher } from './intelligenceDiscord.js';
export async function nativeCall(store: WorkflowRepositories, guild: string, action: string, actor: string, id?: string, data: Record<string, unknown> = {}) { if (!store.native)
    throw new Error('Apply the native workflow migration and restart Codex'); return store.native(guild, action, actor, id, data); }
export async function sendTrackedDM(i: any, store: WorkflowRepositories, user: any, key: string, body: string, components: any[] = []) {
    const dm = await user.createDM();
    const id = await new DurableDelivery(store, { async send(_channel, k, text) { return (await dm.send({ embeds: [{ description: text.slice(0, 4096), footer: { text: `codex-delivery:${k}` } }], components, allowedMentions: { parse: [] } })).id; }, async recover(_channel, k) { return (await dm.messages.fetch({ limit: 100 })).find((m: any) => m.author.id === i.guild.client.user.id && m.embeds.some((e: any) => e.footer?.text === `codex-delivery:${k}`))?.id; } }).deliver(i.guildId, key, dm.id, body);
    return id;
}
export async function openNativeForm(i: any, store: WorkflowRepositories, system: string, input: Record<string, unknown>, fields: any[], title: string) { const id = interactionUuid(i.id); await nativeCall(store, i.guildId, 'form-create', i.user.id, id, { system, input }); await i.showModal(textModal(`native:form:${id}`, title, fields)); }
export async function publishNativeBoard(i: any, store: WorkflowRepositories, system: 'vote' | 'assignment', record: any) {
    const key = `native-${system}:${record.id}`, destination = record.channel_id ?? await workflowDestination(i, store, system === 'vote' ? 'NOTICE_BOARD' : 'ASSIGNMENTS');
    const body = system === 'vote' ? `${record.title}\n${record.context ?? ''}\n${record.status}\n${record.options.map((o: string) => `${o}: ${record.counts?.[o] ?? 0}`).join('\n')}` : `${record.title}\n${record.status}\n${record.payload.description ?? ''}\n${['objective', 'details', 'location', 'timing'].filter(k => record.payload[k]).map(k => `${k}: ${record.payload[k]}`).join('\n')}\nParticipants: ${(record.payload.claimed ?? []).join(', ') || 'None'}`;
    const components = record.status !== 'OPEN' ? [] : system === 'vote' ? [{ type: 1, components: [{ type: 3, custom_id: `native:ballot:${record.id}`, placeholder: 'Cast your ballot', options: record.options.map((label: string, n: number) => ({ label, value: String(n) })) }] }] : [{ type: 1, components: [['claim', 'Sign On'], ['unclaim', 'Withdraw'], ['close', 'Mark Complete']].map(([action, label]) => ({ type: 2, style: 2, custom_id: `native:assignment:${record.id}:${action}`, label })) }];
    const publisher = new DiscordDurablePublisher(i.guild), channel = await i.guild.channels.fetch(destination);
    if (channel?.type === 15) {
        const threadId = await new DurableDelivery(store, publisher).deliver(i.guildId, key, destination, body);
        const thread = await i.guild.channels.fetch(threadId);
        if (thread.archived)
            await thread.setArchived(false);
        const starter = await thread.fetchStarterMessage();
        if (!starter || starter.author.id !== i.guild.client.user.id)
            throw new Error('Assignment board requires recovery');
        await starter.edit({ embeds: [{ description: body.slice(0, 4096) }], components, allowedMentions: { parse: [] } });
        return;
    }
    const messageId = await new DurableSummary(store, publisher).refresh(i.guildId, key, destination, body);
    const message = await channel.messages.fetch(messageId);
    await message.edit({ components });
    if (system === 'vote' && record.status === 'OPEN' && !message.hasThread && typeof message.startThread === 'function')
        await message.startThread({ name: record.title.slice(0, 100), autoArchiveDuration: 1440 });
}
async function mentorshipBoard(i: any, store: WorkflowRepositories) { const rows = await store.workflow<any[]>(i.guildId, 'mentorship', 'list', i.user.id, undefined, { all: true }); await new DurableSummary(store, new DiscordDurablePublisher(i.guild)).refresh(i.guildId, 'mentorship-board', await workflowDestination(i, store, 'NOTICE_BOARD'), rows.filter(r => r.status !== 'ENDED').map(r => `${r.mentee_id} — ${r.status}${r.mentor_id ? ` with ${r.mentor_id}` : `; seeking ${r.seeking ?? 'Mentor'}`} ${r.note ?? ''}`).join('\n') || 'No open mentorship notices.'); }
export async function handleNativeWorkflow(i: any, store: WorkflowRepositories): Promise<boolean> {
    const parts = i.customId?.split(':') ?? [], component = parts[0] === 'native';
    let system = i.commandName === 'apprenticeship' ? 'mentorship' : i.commandName, action = i.options?.getSubcommand?.();
    if (component && parts[1] === 'ballot') {
        await i.deferReply({ ephemeral: true });
        const r = await store.workflow(i.guildId, 'vote', 'get', i.user.id, parts[2]);
        await requireTier(i, store, r.voter_tier, r.permission_snapshot);
        const choice = r.options[Number(i.values?.[0])];
        if (!choice)
            throw new Error('Choose a listed ballot option');
        const result = await store.workflow(i.guildId, 'vote', 'cast', i.user.id, r.id, { selection: choice });
        await publishNativeBoard(i, store, 'vote', result);
        await i.editReply(replyText('Your ballot is recorded.'));
        return true;
    }
    if (component && parts[1] === 'assignment') {
        const r = await store.workflow(i.guildId, 'assignment', 'get', i.user.id, parts[2]), a = parts[3];
        if (!['claim', 'unclaim', 'close'].includes(a))
            throw new Error('Unknown assignment action');
        await requireTier(i, store, a === 'close' ? 'LEVEL_3' : 'BASELINE');
        if (a === 'claim' && r.payload.minimum_rank) {
            const member = await store.member(i.guildId, i.user.id), org = await store.organization(i.guildId), reachable = new Set([r.payload.minimum_rank]);
            for (let pass = 0; pass < org.ranks.length; pass++)
                for (const edge of org.edges)
                    if (reachable.has(edge.fromRankId))
                        reachable.add(edge.toRankId);
            if (!member?.rankId || !reachable.has(member.rankId))
                throw new Error('Your rank does not meet this assignment’s requirement');
        }
        await i.deferReply({ ephemeral: true });
        const result = await store.workflow(i.guildId, 'assignment', a, i.user.id, r.id);
        await publishNativeBoard(i, store, 'assignment', result);
        await i.editReply(replyText('Assignment updated.'));
        return true;
    }
    if (component && parts[1] === 'mentorship') {
        await requireTier(i, store, 'BASELINE');
        await i.deferReply({ ephemeral: true });
        if (!['accept', 'decline'].includes(parts[3]))
            throw new Error('Choose Accept or Decline');
        const r = await nativeCall(store, i.guildId, `mentorship-${parts[3]}`, i.user.id, parts[2]);
        await mentorshipBoard(i, store);
        await i.editReply(replyText(`Mentorship ${r.status.toLowerCase()}.`));
        return true;
    }
    if (component && parts[1] === 'form') {
        const form = await nativeCall(store, i.guildId, 'form-get', i.user.id, parts[2]);
        system = form.system;
        await requireTier(i, store, 'LEVEL_3');
        await i.deferReply({ ephemeral: true });
        if (form.result) {
            await i.editReply(replyText(`Already saved: ${form.result.id}. Use the record’s status/refresh command for delivery recovery.`));
            return true;
        }
        const input = form.input;
        let record: any;
        if (system === 'vote') {
            record = await nativeCall(store, i.guildId, 'vote-open', i.user.id, form.id, { ...input, title: i.fields.getTextInputValue('title'), options: i.fields.getTextInputValue('body').split('\n').map((v: string) => v.trim()).filter(Boolean) });
        }
        else if (system === 'assignment') {
            const data = { ...input, ...Object.fromEntries(['title', 'objective', 'details', 'location', 'timing'].map(k => [k, i.fields.getTextInputValue(k)])) };
            data.description = [data.objective, data.details, data.location, data.timing].filter(Boolean).join('\n');
            record = await nativeCall(store, i.guildId, 'assignment-open', i.user.id, form.id, data);
        }
        else if (system === 'reference') {
            if (input.confidentiality === 'captain_plus')
                await requireTier(i, store, 'LEVEL_4');
            input.source = Object.fromEntries(['author', 'server', 'channel', 'scope'].map(k => [k, i.fields.getTextInputValue(k)]));
            record = await nativeCall(store, i.guildId, 'reference-save', i.user.id, form.id, { title: input.title, metadata: input, body: i.fields.getTextInputValue('body') });
        }
        else
            throw new Error('Unknown native form');
        await nativeCall(store, i.guildId, 'form-complete', i.user.id, form.id, { id: record.id });
        try {
            if (system === 'vote' || system === 'assignment')
                await publishNativeBoard(i, store, system, record);
        }
        catch {
            await i.editReply(replyText(`Saved ${record.id}; board delivery needs recovery. Reopen the record to refresh it.`));
            return true;
        }
        await i.editReply(replyText(`Saved ${record.id}.`));
        return true;
    }
    if (component)
        return false;
    if (system === 'vote' && action === 'open' && ((i.options.getString('format') ?? 'binary') === 'binary')) {
        await requireTier(i, store, 'LEVEL_3');
        const title = i.options.getString('question');
        if (!title)
            throw new Error('A question is required for a Yes / No / Abstain vote');
        await i.deferReply();
        const r = await nativeCall(store, i.guildId, 'vote-open', i.user.id, interactionUuid(i.id), { title, context: i.options.getString('context'), channel: i.channelId, options: ['Yes', 'No', 'Abstain'], tier: 'BASELINE' });
        await publishNativeBoard(i, store, 'vote', r);
        await i.editReply(replyText(`Opened ${r.title}. Vote using the posted ballot. Reference: ${r.id}`));
        return true;
    }
    if (system === 'vote' && action === 'open') {
        await requireTier(i, store, 'LEVEL_3');
        await openNativeForm(i, store, 'vote', { context: i.options.getString('context'), channel: i.channelId, tier: 'BASELINE' }, [{ id: 'title', label: 'Question', max: 300, value: i.options.getString('question') ?? '' }, { id: 'body', label: 'Choices, one per line', max: 2500, paragraph: true }], 'Open multiple-choice vote');
        return true;
    }
    if (system === 'vote' && ['close', 'audit'].includes(action) && i.options.getString('vote')) {
        await requireTier(i, store, 'LEVEL_3');
        await i.deferReply({ ephemeral: true });
        const r = await store.workflow(i.guildId, 'vote', 'get', i.user.id, i.options.getString('vote', true));
        if (r.channel_id && r.channel_id !== i.channelId)
            throw new Error('Use this vote in its original channel');
        const result = await store.workflow(i.guildId, 'vote', action, i.user.id, r.id);
        if (action === 'close')
            await publishNativeBoard(i, store, 'vote', result);
        await i.editReply({ ...replyText(`${result.title}: ${result.status}\n${Object.entries(result.counts ?? {}).map(([k, v]) => typeof v === 'object' ? Object.entries(v as Record<string, unknown>).map(([field, value]) => `${field}: ${value}`).join('\n') : `${k}: ${v}`).join('\n')}`), ...(action === 'audit' ? { files: [{ attachment: Buffer.from(JSON.stringify(result.ballots, null, 2)), name: 'ballot-audit.json' }] } : {}) });
        return true;
    }
    if (system === 'assignment' && action === 'create') {
        await requireTier(i, store, 'LEVEL_3');
        const org = await store.organization(i.guildId), rank = i.options.getString('minimum_rank'), entry = i.options.getString('assignment');
        if (rank && !org.ranks.some(r => r.id === rank))
            throw new Error('Choose a configured rank');
        if (entry && !org.entries.some(e => e.id === entry))
            throw new Error('Choose a configured assignment');
        await openNativeForm(i, store, 'assignment', { minimum_rank: rank, assignment: entry }, [{ id: 'title', label: 'Assignment title', max: 100 }, { id: 'objective', label: 'Objective', max: 1000, paragraph: true }, { id: 'details', label: 'Details, risks, or requirements', max: 1800, paragraph: true, optional: true }, { id: 'location', label: 'Meeting point or operating area', max: 200 }, { id: 'timing', label: 'Timing or deadline', max: 200, optional: true }], 'Create an assignment');
        return true;
    }
    if (system === 'assignment' && action === 'setup' && i.options.getChannel('forum')) {
        await requireTier(i, store, 'LEVEL_3');
        const channel = i.options.getChannel('forum', true);
        if (channel.guildId !== i.guildId || channel.type !== 15)
            throw new Error('Choose an existing Forum in this server');
        await i.deferReply({ ephemeral: true });
        const config = await store.load(i.guildId);
        if (!config)
            throw new Error('Configure this server first');
        const org = await store.organization(i.guildId);
        org.additionalResources = [...org.additionalResources.filter(r => r.key !== 'ASSIGNMENTS'), { key: 'ASSIGNMENTS', name: channel.name, kind: 'FORUM', parent: 'CORE_CATEGORY' }];
        await store.saveOrganization(config, org, i.user.id);
        await store.put({ guildId: i.guildId, key: 'ASSIGNMENTS', discordId: channel.id, kind: 'FORUM' });
        await store.workflow(i.guildId, 'assignment', 'setup', i.user.id, undefined, { enabled: true });
        await i.editReply(replyText('Assignments Forum connected. Existing posts remain unchanged.'));
        return true;
    }
    if (system === 'reference' && ['add', 'view'].includes(action)) {
        await requireTier(i, store, 'LEVEL_3');
        if (action === 'view') {
            await i.deferReply({ ephemeral: true });
            const r = await nativeCall(store, i.guildId, 'reference-get', i.user.id, i.options.getString('id', true));
            if (!r)
                throw new Error('Reference not found in this server');
            if (r.metadata.confidentiality === 'captain_plus')
                await requireTier(i, store, 'LEVEL_4');
            await i.editReply({ ...replyText(r.title), files: [{ attachment: Buffer.from(`${r.title}\n${Object.entries(r.metadata).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${r.body}`), name: 'reference.txt' }] });
            return true;
        }
        const input = Object.fromEntries(['title', 'category', 'source-url', 'authority', 'context', 'confidentiality', 'posted-at', 'attachment-links', 'supersedes'].map(k => [k, i.options.getString(k)]));
        input.authority ??= 'unverified';
        input.context ??= 'unspecified';
        input.confidentiality ??= 'marshal_plus';
        for (const [key, values] of Object.entries({ category: referenceCategories, authority: referenceAuthorities, context: referenceContexts, confidentiality: referenceConfidentialities }))
            if (!values.includes(input[key]!))
                throw new Error('Choose a listed reference classification');
        if (input.confidentiality === 'captain_plus')
            await requireTier(i, store, 'LEVEL_4');
        for (const url of [input['source-url'], ...(input['attachment-links'] ?? '').split(/\s+/).filter(Boolean)]) {
            if (!url || !/^https?:\/\//i.test(url))
                throw new Error('Provide HTTP(S) source and attachment links');
            const parsed = new URL(url);
            if (parsed.username || parsed.password)
                throw new Error('Links cannot contain embedded credentials');
        }
        if (input['posted-at'] && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(input['posted-at']) || !Number.isFinite(Date.parse(input['posted-at']))))
            throw new Error('Provide a valid original timestamp');
        await openNativeForm(i, store, 'reference', input, [{ id: 'body', label: 'Exact source text', max: 4000, paragraph: true }, ...['author', 'server', 'channel', 'scope'].map(id => ({ id, label: ({ author: 'Source author / speaker', server: 'Source server / community', channel: 'Source channel / ticket', scope: 'Where does this apply?' } as Record<string, string>)[id], max: id === 'scope' ? 1000 : 150, optional: true, paragraph: id === 'scope' }))], 'Preserve reference source');
        return true;
    }
    if (system !== 'mentorship')
        return false;
    await requireTier(i, store, ['assign', 'requests'].includes(action) ? 'LEVEL_3' : 'BASELINE');
    await i.deferReply({ ephemeral: true });
    const actor = i.user.id;
    let record: any;
    if (action === 'looking-for') {
        record = await nativeCall(store, i.guildId, 'mentorship-preference', actor, interactionUuid(i.id), { seeking: i.options.getString('type') ?? 'Mentor', note: i.options.getString('note') });
    }
    else if (['propose', 'sponsor', 'assign'].includes(action)) {
        const mentor = action === 'assign' ? i.options.getUser('mentor', true).id : actor, target = i.options.getUser(action === 'assign' ? 'apprentice' : action === 'sponsor' ? 'recruit' : 'member', true).id;
        await i.guild.members.fetch(mentor);
        const member = await i.guild.members.fetch(target);
        record = await nativeCall(store, i.guildId, 'mentorship-pair', actor, interactionUuid(i.id), { mentor, mentee: target, assign: action === 'assign', reason: i.options.getString('reason') });
        if (action === 'propose') {
            try {
                await sendTrackedDM(i, store, member.user, `mentorship-proposal:${record.id}`, `A mentorship with ${mentor} has been proposed. Return to the server and use /apprenticeship info to accept or decline.`);
            }
            catch {
                await i.editReply(replyText(`Proposal ${record.id} saved; DM delivery needs recovery. The recipient can respond using /apprenticeship info.`));
                return true;
            }
        }
        if (action === 'sponsor') {
            const submission = await store.workflow(i.guildId, 'strongbox', 'submit', actor, interactionUuid(i.id), { contents: `Mentorship sponsorship for ${target}\nMentor: ${mentor}\n${i.options.getString('reason', true)}`, source: i.id });
            await new DurableDelivery(store, new DiscordDurablePublisher(i.guild)).deliver(i.guildId, `sponsorship:${submission.id}`, await workflowDestination(i, store, 'HQ_STRONGBOX', true), submission.contents);
        }
    }
    else {
        const target = i.options.getUser('member')?.id ?? actor;
        const rows = await store.workflow<any[]>(i.guildId, 'mentorship', 'list', actor, undefined, { all: true });
        if (action === 'requests') {
            await i.editReply(replyText(rows.filter(r => r.status !== 'ENDED').map(r => `${r.mentee_id} — ${r.seeking}: ${r.status}${r.mentor_id ? ` with ${r.mentor_id}` : ''}`).join('\n') || 'No current requests.'));
            return true;
        }
        record = rows.find(r => r.status !== 'ENDED' && (r.mentee_id === target || r.mentor_id === target));
        if (!record) {
            await i.editReply(replyText('No current mentorship found.'));
            return true;
        }
        if (action === 'end') {
            if (record.mentor_id !== actor && record.mentee_id !== actor)
                await requireTier(i, store, 'LEVEL_3');
            record = await store.workflow(i.guildId, 'mentorship', 'end', actor, record.id, { reason: i.options.getString('reason') });
        }
        else if (action === 'withdraw-looking')
            record = await store.workflow(i.guildId, 'mentorship', 'withdraw-looking', actor, record.id);
        else if (action !== 'info')
            throw new Error('Unknown mentorship action');
    }
    if (action !== 'info')
        try {
            await mentorshipBoard(i, store);
        }
        catch {
            await i.editReply(replyText(`Mentorship ${record.id} saved; notice board refresh needs recovery.`));
            return true;
        }
    await i.editReply({ ...replyText(`${record.id}: ${record.status}\nMentor: ${record.mentor_id ?? 'Not assigned'}\nApprentice: ${record.mentee_id}\n${record.note ?? ''}`), components: record.status === 'PROPOSED' && record.mentee_id === actor ? [{ type: 1, components: ['accept', 'decline'].map(a => ({ type: 2, style: 2, label: a === 'accept' ? 'Accept' : 'Decline', custom_id: `native:mentorship:${record.id}:${a}` })) }] : [] });
    return true;
}
