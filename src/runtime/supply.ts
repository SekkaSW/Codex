import type { OptionalRepositories } from './handlers/optional.js';
import { requireTier, interactionUuid, replyText } from './interactions.js';
import { DurableSummary } from '../workflows.js';
import { DiscordDurablePublisher } from './intelligenceDiscord.js';
export interface SupplyRecord {
    id: string;
    code: string;
    name: string;
    client: string;
    status: string;
    channel_id: string;
    sale_price: number;
    member_rate: number;
    items: Array<{
        id: string;
        name: string;
        quota: number;
        contributed: number;
    }>;
    credits: Array<{
        member_id: string;
        quantity: number;
        payout: number;
    }>;
}
export type SupplyCall = <T = SupplyRecord>(guild: string, action: string, actor: string, key?: string, operation?: string, data?: Record<string, unknown>) => Promise<T>;
export function supplyPairs(options: any, create = false): Array<Record<string, unknown>> {
    const entries: Array<Record<string, unknown>> = [];
    for (let n = 1; n <= 4; n++) {
        const suffix = create || n > 1 ? `_${n}` : '';
        const name = options.getString(`item${suffix}`)?.trim(), q = options.getInteger(`${create ? 'quota' : 'quantity'}${suffix}`);
        if ((name != null && name !== '') !== (q != null))
            throw new Error(`item${suffix} and ${create ? 'quota' : 'quantity'}${suffix} must be supplied together.`);
        if (name) {
            if (!Number.isSafeInteger(q) || q < 1 || q > 1e9)
                throw new Error('Supply quantity must be a positive integer no greater than one billion.');
            entries.push({ [create ? 'name' : 'item']: name, quantity: q });
        }
    }
    if (!entries.length)
        throw new Error('Supply requires at least one item and quantity.');
    return entries;
}
export function supplyText(r: SupplyRecord): string {
    const count = r.items.reduce((s, i) => s + Number(i.contributed), 0);
    return `${r.code} — ${r.name}\n${r.status} · Client: ${r.client}\n${r.items.map(i => `${i.name}: ${i.contributed} / ${i.quota}`).join('\n')}\nClient total: ${count * Number(r.sale_price)} · Member payouts: ${count * Number(r.member_rate)} · Organization remainder: ${count * (Number(r.sale_price) - Number(r.member_rate))}\n${r.credits.map(c => `${c.member_id}: ${c.quantity} items · payout ${c.payout}`).join('\n') || 'No contributions yet.'}`;
}
export async function handleSupply(i: any, store: OptionalRepositories, publish?: (record: SupplyRecord) => Promise<void>): Promise<void> {
    const config = await store.load(i.guildId);
    if (!config?.modules.supply)
        throw new Error('Supply is disabled');
    const action = i.options.getSubcommand();
    await requireTier(i, store, ['create', 'redistribute', 'refresh', 'close', 'reopen', 'cancel'].includes(action) ? 'LEVEL_3' : 'BASELINE');
    if (!store.supply)
        throw new Error('Supply migration and runtime are required');
    const data: Record<string, unknown> = {}, key = action === 'create' ? undefined : i.options.getString('assignment', true);
    if (action === 'create') {
        data.items = supplyPairs(i.options, true);
        for (const k of ['name', 'client', 'notes'])
            data[k] = i.options.getString(k);
        data.sale_price = i.options.getNumber('sale_price', true);
        data.member_rate = i.options.getNumber('member_rate', true);
        if (![data.sale_price, data.member_rate].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9) || Number(data.member_rate) > Number(data.sale_price))
            throw new Error('Member payout cannot exceed the client price.');
        const organizer = i.options.getUser('organizer') ?? i.user;
        await i.guild.members.fetch(organizer.id);
        data.organizer = organizer.id;
        if (!i.channel || ![0, 5, 10, 11, 12].includes(i.channel.type))
            throw new Error('Create a supply board in a server text channel or thread.');
        data.channel = i.channelId;
    }
    if (action === 'log' || action === 'undo-last') {
        const member = i.options.getUser('member') ?? i.user;
        if (member.id !== i.user.id) {
            await requireTier(i, store, 'LEVEL_3');
            await i.guild.members.fetch(member.id);
        }
        data.member = member.id;
        if (action === 'log') {
            data.items = supplyPairs(i.options);
            data.note = i.options.getString('note');
        }
    }
    if (action === 'redistribute') {
        const source = String(i.options.getString('source_id', true)).replace(/^<@!?(\d+)>$/, '$1'), before = i.options.getString('before', true);
        if (!/^\d+$/.test(source) || !/^\d{4}-\d{2}-\d{2}T/.test(before) || !Number.isFinite(Date.parse(before)))
            throw new Error('Provide a contributor Discord ID and an ISO cutoff date/time.');
        Object.assign(data, { source, before: new Date(before).toISOString(), method: i.options.getString('method', true), reason: i.options.getString('reason') });
    }
    await i.deferReply({ ephemeral: true });
    const result = await store.supply<SupplyRecord>(i.guildId, action, i.user.id, key, interactionUuid(i.id), data);
    // Refresh current totals on retries; the receipt result proves the mutation committed.
    let current = result;
    let delivery = '';
    if (!['status', 'contributors'].includes(action))
        try {
            current = await store.supply<SupplyRecord>(i.guildId, 'get', i.user.id, result.id);
            if (publish)
                await publish(current);
            else
                await new DurableSummary(store, new DiscordDurablePublisher(i.guild)).refresh(i.guildId, `supply-order:${current.id}`, current.channel_id, supplyText(current));
        }
        catch {
            delivery = '\nThe Supply operation is saved. Board delivery needs recovery; use /supply refresh with this assignment.';
        }
    const text = supplyText(current) + delivery;
    await i.editReply(text.length <= 1900 ? replyText(text) : { ...replyText(`${current.code}: ${current.status}.${delivery} Full totals attached.`), files: [{ attachment: Buffer.from(text), name: 'supply-summary.txt' }] });
}
export async function autocompleteSupply(i: any, store: OptionalRepositories): Promise<void> {
    try {
        if (!(await store.load(i.guildId))?.modules.supply || !store.supply) {
            await i.respond([]);
            return;
        }
        await requireTier(i, store, 'BASELINE');
        const focused = i.options.getFocused(true), query = String(focused.value).toLowerCase();
        if (focused.name === 'assignment') {
            const rows = await store.supply<SupplyRecord[]>(i.guildId, 'list', i.user.id, query);
            await i.respond(rows.map(r => ({ name: `${r.code} — ${r.name} (${r.status})`.slice(0, 100), value: r.code })));
            return;
        }
        if (/^item(?:_[2-4])?$/.test(focused.name)) {
            const key = i.options.getString('assignment');
            if (!key) {
                await i.respond([]);
                return;
            }
            const r = await store.supply<SupplyRecord>(i.guildId, 'get', i.user.id, key);
            await i.respond(r.status === 'Active' ? r.items.filter(x => x.name.toLowerCase().includes(query)).slice(0, 25).map(x => ({ name: `${x.name} (${Number(x.quota) - Number(x.contributed)} remaining)`.slice(0, 100), value: x.id })) : []);
            return;
        }
        await i.respond([]);
    }
    catch {
        await i.respond([]);
    }
}
