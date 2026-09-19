import { ApplicationFlagsBitField, ChannelType, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import type { StoredSetupDraft } from '../setup.js';
import { refinementText, setupTextLimit, humanSetupCopy } from './setupRefinement.js';
import { SetupWizard } from './setupWizard.js';
import { conversationResources } from './setupConversation.js';
import { friendlyError } from './confirmation.js';

type Binding = NonNullable<StoredSetupDraft['messageConversation']>;
const safe = { parse: [] };
export function currentSetupText(d: StoredSetupDraft): string | undefined {
    if (d.editor?.refinement) return refinementText(d);
    const e = d.editor!, g = e.conversation, c = d.organization!;
    switch (g?.step ?? e.section) {
        case 'identity': return d.config.organizationName;
        case 'namespace': return d.config.commandNamespace;
        case 'integration': return d.config.confidentialityMarker;
        case 'rank-name': return c.ranks.find(x => x.id === e.selected)?.name;
        case 'branch-name': return c.branches.find(x => x.id === g?.branch)?.name;
        case 'duty-name': return c.duties.find(x => x.roleId === e.selected)?.displayName;
        case 'group-name': return c.groups.find(x => x.id === g?.group)?.name;
        case 'entry-name': return c.entries.find(x => x.id === e.selected)?.name;
        case 'resource-name': return c.additionalResources.find(x => x.key === conversationResources(d)[g!.index]?.key)?.name;
    }
    if (!g) {
        if (e.section === 'duties') return c.duties.find(x => x.roleId === e.selected)?.displayName;
        if (e.section === 'resources') return c.additionalResources.find(x => x.key === e.selected)?.name;
        const entities = e.section === 'ranks' ? c.ranks : e.section === 'branches' ? c.branches : e.section === 'groups' ? c.groups : e.section === 'entries' ? c.entries : [];
        return entities.find(x => x.id === e.selected)?.name;
    }
    return undefined;
}

/** Message transport only: SetupWizard remains the authority for draft edits/apply. */
export class MessageSetupWizard extends SetupWizard {
    private readonly active = new Map<string, { ownerId: string; binding: Binding }>();

    private async save(d: StoredSetupDraft): Promise<void> {
        d.revision++;
        d.updatedAt = new Date().toISOString();
        await this.store.saveSetupDraft(d);
    }
    private async admin(guild: any, ownerId: string): Promise<any> {
        const member = await guild.members.fetch({ user: ownerId, force: true });
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) throw new Error('Discord Administrator permission required');
        return member.permissions;
    }
    private async intent(client: any): Promise<void> {
        const app = await client.application.fetch().catch(() => { throw new Error('Setup could not verify Message Content Intent. Check Discord connectivity and Developer Portal → Bot → Privileged Gateway Intents, then run /server setup again.'); });
        const flags = ApplicationFlagsBitField.Flags;
        if (!client.options.intents.has(GatewayIntentBits.MessageContent) ||
            !(app.flags?.has(flags.GatewayMessageContent) || app.flags?.has(flags.GatewayMessageContentLimited))) {
            throw new Error('Setup message replies require Message Content Intent. Enable it in Discord Developer Portal → Bot → Privileged Gateway Intents, then restart Codex and run /server setup.');
        }
    }
    async startInteraction(i: any): Promise<void> {
        if (!i.guildId || !i.guild) throw new Error('Use setup inside a server');
        if (!i.deferred && !i.replied) await i.deferReply({ ephemeral: true });
        await this.admin(i.guild, i.user.id);
        await this.intent(i.client);
        const payload = await super.start(i.guildId, i.user.id);
        const d = (await this.store.loadSetupDraft(i.guildId))!;
        this.active.delete(d.guildId);
        let channel: any;
        if (d.messageConversation) {
            channel = await i.guild.channels.fetch(d.messageConversation.channelId).catch(() => null);
            if (d.messageConversation.privateThread && channel?.type !== ChannelType.PrivateThread) channel = null;
            if (channel?.archived) { try { await channel.setArchived(false); } catch { channel = null; } }
            if (channel && d.messageConversation.privateThread) { try { await channel.members.add(d.ownerId); } catch { channel = null; } }
        }
        if (!channel) {
            const attempted = d.messageConversation?.threadAttempted ?? false;
            d.messageConversation = { channelId: i.channelId, privateThread: false, threadAttempted: true };
            // Record the attempt before calling Discord. Uncertain creation is never blindly retried.
            await this.save(d);
            channel = i.channel;
            const me = await i.guild.members.fetchMe();
            if (!attempted && channel?.type === ChannelType.GuildText &&
                channel.permissionsFor(me)?.has([PermissionFlagsBits.CreatePrivateThreads, PermissionFlagsBits.SendMessagesInThreads])) {
                let thread: any;
                try {
                    thread = await channel.threads.create({ name: `Codex setup — ${i.user.username ?? 'administrator'}`.slice(0, 100), type: ChannelType.PrivateThread, invitable: false, autoArchiveDuration: 60 });
                    await thread.members.add(d.ownerId);
                    channel = thread;
                    d.messageConversation = { channelId: thread.id, privateThread: true, threadAttempted: true };
                    await this.save(d);
                } catch {
                    if (thread) await thread.setArchived(true).catch(() => undefined);
                    channel = i.channel;
                    d.messageConversation = { channelId: i.channelId, privateThread: false, threadAttempted: true };
                    await this.save(d);
                }
            }
        }
        if (!channel?.send) throw new Error('Setup needs a channel where Codex can send messages. Run /server setup in a text channel.');
        await this.publish(d.guildId, channel, payload);
        await i.editReply({ content: `Continue setup in <#${channel.id}>. ${d.messageConversation!.privateThread ? 'Send your answers in the private setup thread.' : 'Use Discord Reply on the current question to answer text questions. Answers are visible to people who can read this channel.'}`, components: [], allowedMentions: safe });
    }

    /** Captured at event arrival, before the guild queue, so bursts cannot answer future questions. */
    messageRevision(m: any): number | undefined {
        const a = this.active.get(m.guildId), b = a?.binding;
        if (!a || !b?.answerAction || m.author.bot || m.webhookId || m.author.id !== a.ownerId || m.channelId !== b.channelId) return;
        if (!b.privateThread && m.reference?.messageId !== b.promptId) return;
        if (m.reference?.messageId && m.reference.messageId !== b.promptId) return;
        if (!b.promptId || !/^\d+$/.test(m.id) || BigInt(m.id) <= BigInt(b.promptId)) return;
        return b.revision;
    }
    async handleMessage(m: any, receivedRevision = this.messageRevision(m)): Promise<void> {
        if (receivedRevision === undefined || receivedRevision !== this.messageRevision(m)) return;
        const d = await this.store.loadSetupDraft(m.guildId), b = d?.messageConversation;
        if (!d || !b || d.guildId !== m.guildId || d.ownerId !== m.author.id || d.revision !== receivedRevision || b.revision !== d.revision ||
            b.channelId !== m.channelId || !b.answerAction || b.question !== this.question(d) || Date.parse(d.expiresAt) <= Date.now()) return;
        const permissions = await this.admin(m.guild, m.author.id);
        const content = m.content?.trim();
        if (!content || content.length > setupTextLimit(d)) {
            const payload = b.textPrompt ? this.textPrompt(d, b.textPrompt.content) : this.render(d);
            payload.content = `Reply with 1–${setupTextLimit(d)} characters of text. If Codex cannot read your replies, enable Message Content Intent in the Developer Portal and restart the bot.\n\n` + payload.content;
            await this.publish(d.guildId, m.channel, payload, b.textPrompt?.action);
            return;
        }
        await this.execute({ guildId: m.guildId, guild: m.guild, channelId: m.channelId, channel: m.channel, user: m.author,
            memberPermissions: permissions, customId: `setup:${d.revision}:${b.answerAction}`, isModalSubmit: () => true,
            fields: { getTextInputValue: () => content } }, d, true);
    }
    override async handle(i: any): Promise<void> {
        const d = await this.store.loadSetupDraft(i.guildId);
        if (!d?.messageConversation) throw new Error('Run /server setup to resume this draft as a conversation.');
        await this.admin(i.guild, i.user.id);
        const b = d.messageConversation;
        if (d.ownerId !== i.user.id) throw new Error('Only the draft owner can edit or confirm setup');
        if (Date.parse(d.expiresAt) <= Date.now()) throw new Error('Setup draft expired. Run /server setup again.');
        if (i.channelId !== b.channelId || i.message?.id !== b.promptId || Number(i.customId.split(':')[1]) !== d.revision || b.revision !== d.revision)
            throw new Error('This setup question is stale. Run /server setup to resume your saved answers.');
        // Text submission is exclusively via the bound message route, never a forged modal/select.
        if (i.isModalSubmit() || ['save-text', 'create'].includes(i.customId.split(':')[2]) ||
            (b.answerAction && (i.customId.endsWith(':guide-answer') || i.customId.endsWith(':refine-answer')))) throw new Error('Reply to the current setup question with your answer.');
        await i.deferUpdate();
        if (i.customId.endsWith(':keep')) {
            const value = currentSetupText(d);
            if (!b.answerAction || b.answerAction === 'create' || !value) throw new Error('There is no current value to keep.');
            await this.execute({ guildId: i.guildId, guild: i.guild, channel: i.channel, user: i.user, memberPermissions: i.memberPermissions,
                customId: `setup:${d.revision}:${b.answerAction}`, isModalSubmit: () => true, fields: { getTextInputValue: () => value } }, d, true);
        } else await this.execute(i, d, false);
    }
    private question(d: StoredSetupDraft): string { return JSON.stringify([d.editor?.refinement && [d.editor.refinement.step,d.editor.refinement.index,d.editor.refinement.group,d.editor.refinement.branch,d.editor.refinement.source,d.editor.refinement.page], d.editor?.section, d.editor?.conversation?.step, d.editor?.selected, d.editor?.conversation?.index, d.editor?.conversation?.group, d.editor?.conversation?.branch]); }

    private textPrompt(d: StoredSetupDraft, content: string): any {
        return { content, components: [{ type: 1, components: [
            { type: 2, custom_id: `setup:${d.revision}:text-back`, label: 'Back', style: 2 },
            { type: 2, custom_id: `setup:${d.revision}:cancel`, label: 'Cancel', style: 4 },
        ] }] };
    }
    private async execute(i: any, before: StoredSetupDraft, message: boolean): Promise<void> {
        this.active.delete(before.guildId);
        let payload: any, answerAction: string | undefined;
        const capture = async (p: any) => { payload = typeof p === 'string' ? { content: p } : p; };
        const adapter = new Proxy(i, { get: (target, key) => {
            if (['reply', 'update', 'editReply'].includes(String(key))) return capture;
            if (['deferReply', 'deferUpdate'].includes(String(key))) return async () => {};
            if (key === 'showModal') return async (modal: any) => {
                const raw = modal.toJSON?.() ?? modal;
                answerAction = raw.custom_id.split(':')[2];
                const input = raw.components[0].components[0];
                payload = this.textPrompt(before, `**${raw.title}: ${input.label}**`);
            };
            const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
        } });
        const action = i.customId.split(':')[2];
        try {
            if (action === 'text-back') payload = this.render(before);
            else await super.handle(adapter);
            if (action === 'resume' && before.messageConversation?.textPrompt) {
                answerAction = before.messageConversation.textPrompt.action;
                payload = this.textPrompt(before, before.messageConversation.textPrompt.content);
            }
        }
        catch (error) {
            // Validation failures preserve the saved draft and reissue the same question. Storage/API
            // failures may have committed; reload durable state rather than retrying a mutation.
            const latest = await this.store.loadSetupDraft(before.guildId);
            if (!latest) throw error;
            payload = this.render(latest);
            if (message && latest.revision === before.revision && !['guide-answer','refine-answer'].includes(before.messageConversation?.answerAction ?? '')) {
                answerAction = before.messageConversation?.answerAction;
                payload = this.textPrompt(latest, before.messageConversation?.textPrompt?.content ?? '**Reply with the corrected value.**');
            }
            const detail = friendlyError(error);
            payload.content = `${detail}\n\n${payload.content}`;
        }
        const latest = await this.store.loadSetupDraft(before.guildId);
        if (latest && !latest.messageConversation) { latest.messageConversation = { channelId: before.messageConversation!.channelId, privateThread: before.messageConversation!.privateThread, threadAttempted: true }; await this.save(latest); }
        if (message && latest && latest.revision > before.revision && !before.editor?.conversation && !before.editor?.refinement && payload) payload.content = `Value set to **${i.fields.getTextInputValue('name').trim()}** in the draft.\n\n${payload.content}`;
        if (payload) await this.publish(before.guildId, i.channel, payload, answerAction, !['progress', 'restart', 'view', 'repair', 'repair-confirm'].includes(action));
        if (!latest && before.messageConversation?.privateThread) await i.channel.setArchived(true).catch(() => undefined);
    }

    private async publish(guildId: string, channel: any, source: any, explicitAction?: string, clearText = false): Promise<void> {
        const d = await this.store.loadSetupDraft(guildId);
        const payload = { ...source, allowedMentions: safe }; delete payload.ephemeral;
        if (d?.refinedSetup && payload.content) payload.content = humanSetupCopy(payload.content);
        if (!d?.messageConversation) { await channel.send(payload); return; }
        this.active.delete(guildId);
        const b = d.messageConversation;
        if (explicitAction) {
            if (b.textPrompt?.action !== explicitAction) b.textPrompt = { action: explicitAction, content: source.content };
        } else if (clearText) delete b.textPrompt;
        // Fence the old prompt before sending. An orphan prompt after a send/save failure is inert.
        delete b.promptId; delete b.answerAction; delete b.revision; delete b.question;
        await this.save(d);
        const revision = d.revision + 1;
        let answerAction = explicitAction;
        payload.components = (source.components ?? []).map((r: any) => ({ ...r, components: r.components.filter((c: any) => {
            if (c.custom_id?.endsWith(':refine-text')) { answerAction = 'refine-answer'; return false; }
            if (c.custom_id?.endsWith(':guide-text')) { answerAction = 'guide-answer'; return false; }
            return true;
        }).map((c: any) => ({ ...c, ...(d.refinedSetup && c.label ? {label: humanSetupCopy(c.label)} : {}), ...(d.refinedSetup && c.options ? {options: c.options.map((o:any) => ({...o,label:humanSetupCopy(o.label)}))} : {}), custom_id: c.custom_id?.replace(/^setup:\d+:/, `setup:${revision}:`) })) })).filter((r: any) => r.components.length);
        if (answerAction) {
            const value = answerAction !== 'create' ? currentSetupText(d) : undefined;
            payload.content += `${value ? `\nCurrent value: **${value.length > 600 ? value.slice(0,600) + "…" : value}**` : ''}\n${b.privateThread ? 'Send your answer here.' : 'Use Discord Reply on this question to answer.'}`;
            if (value && payload.components.length < 5) payload.components.unshift({ type: 1, components: [{ type: 2, custom_id: `setup:${revision}:keep`, label: 'Keep Current', style: 2 }] });
        }
        payload.content = payload.content?.slice(0, 2000);
        const prompt = await channel.send(payload);
        b.promptId = prompt.id; if (answerAction) b.answerAction = answerAction; b.revision = revision; b.question = this.question(d);
        await this.save(d);
        this.active.set(guildId, { ownerId: d.ownerId, binding: { ...b } });
    }
}
