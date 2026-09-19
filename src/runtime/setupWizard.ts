import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { emptyOrganization, validateOrganization, type AdministrationStore } from '../administration.js';
import { permissionLabels, permissionTiers, type ServerConfig } from '../domain.js';
import { configuredResources } from '../resources.js';
import { DiscordProvisioner } from './discordProvisioner.js';
import { beginSetup, preview, validateForConfirmation, type StoredSetupDraft } from '../setup.js';
import { answerConversation, beginConversation, conversationView } from './setupConversation.js';
import { beginRefinement, answerRefinement, refinementView, refinementSummary } from './setupRefinement.js';
import { provisionDuties, type DutyCreationStore } from './dutyProvisioning.js';
export interface SetupStore extends AdministrationStore {
    managedDuty?: DutyCreationStore['managedDuty'];
    load(guildId: string): Promise<ServerConfig | undefined>;
    loadSetupDraft(guildId: string): Promise<StoredSetupDraft | undefined>;
    saveSetupDraft(draft: StoredSetupDraft): Promise<void>;
    deleteSetupDraft(guildId: string, ownerId?: string): Promise<void>;
}
const sections = ['identity', 'namespace', 'permissions', 'ranks', 'branches', 'progression', 'duties', 'groups', 'entries', 'modules', 'resources', 'destinations', 'integration', 'preview'];
const row = (...components: any[]) => ({ type: 1, components });
const button = (id: string, label: string, style = 2) => ({ type: 2, custom_id: id, label, style });
const option = (label: string, value: string) => ({ label: label.slice(0, 100), value });
const select = (id: string, placeholder: string, options: any[], max = 1, min = 1) => ({ type: 3, custom_id: id, placeholder, options, max_values: max, min_values: min });
export class SetupWizard {
    constructor(protected readonly store: SetupStore, private readonly provision: (config: ServerConfig, actorId: string) => Promise<string>, protected readonly refined = false, private readonly beforeApply?: (draft: StoredSetupDraft, guild: any) => Promise<void>) { }
    async start(guildId: string, ownerId: string): Promise<any> {
        let d = await this.store.loadSetupDraft(guildId);
        let resumed = !!d;
        if (d && Date.parse(d.expiresAt) <= Date.now()) {
            await this.store.deleteSetupDraft(guildId, d.ownerId);
            d = undefined;
            resumed = false;
        }
        if (d && d.ownerId !== ownerId)
            throw new Error('Another administrator owns the active setup draft');
        const existing = await this.store.load(guildId);
        if (!d) {
            d = { ...beginSetup(existing), guildId, ownerId, updatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), organization: existing ? await this.store.organization(guildId) : emptyOrganization(), editor: { section: 'identity', page: 0 } };
            d.config.guildId = guildId;
            d.config.modules ??= { briefings: false, patrols: false, supply: false, atlas: false };
            d.config.confidentialityMarker ??= '[CONFIDENTIAL]';
            if (this.refined) { d.refinedSetup = true; beginRefinement(d, !!existing); } else beginConversation(d, existing ? 'sections' : 'identity');
            await this.store.saveSetupDraft(d);
        }
        if (!d.organization || !d.editor) {
            d.organization ??= existing ? await this.store.organization(guildId) : emptyOrganization();
            d.editor ??= { section: d.stage, page: 0 };
            d.revision++;
            await this.store.saveSetupDraft(d);
        }
        if (this.refined && !d.refinedSetup) { d.refinedSetup = true; beginRefinement(d, !!existing); d.editor!.refinement!.step = 'sections'; d.revision++; await this.store.saveSetupDraft(d); }
        if (resumed) return { content: `You have an unfinished setup from ${Math.max(0, Math.floor((Date.now() - Date.parse(d.updatedAt)) / 60000))} minutes ago. Your answers are saved.`, components: [row(button(`setup:${d.revision}:resume`, 'Resume', 1), button(`setup:${d.revision}:restart`, 'Start Over'), button(`setup:${d.revision}:progress`, 'View Progress'), button(`setup:${d.revision}:cancel`, 'Cancel', 4))], ephemeral: true };
        return { ...this.render(d), ephemeral: true };
    }
    private async required(guildId: string, ownerId: string, revision: number): Promise<StoredSetupDraft> {
        const d = await this.store.loadSetupDraft(guildId);
        if (!d)
            throw new Error('Start /server setup first');
        if (d.ownerId !== ownerId)
            throw new Error('Only the draft owner can edit or confirm setup');
        if (Date.parse(d.expiresAt) <= Date.now())
            throw new Error('Setup draft expired. Run /server setup to start again');
        if (revision !== d.revision)
            throw new Error('This setup panel is stale. Run /server setup to resume the latest draft');
        d.organization ??= emptyOrganization();
        d.editor ??= { section: d.stage, page: 0 };
        return d;
    }
    async handle(i: any): Promise<void> {
        if (!i.guildId || !i.memberPermissions?.has(PermissionFlagsBits.Administrator))
            throw new Error('Discord Administrator permission required');
        const [, rev, action] = i.customId.split(':');
        let d: StoredSetupDraft;
        try { d = await this.required(i.guildId, i.user.id, Number(rev)); }
        catch (error) {
            const latest = await this.store.loadSetupDraft(i.guildId);
            if (latest && latest.ownerId === i.user.id && Date.parse(latest.expiresAt) > Date.now() && Number(rev) !== latest.revision) {
                await i.reply({ content: 'Your setup changed in another interaction. Press Resume to load the newest saved answers.', ephemeral: true, components: [row(button(`setup:${latest.revision}:resume`, 'Resume', 1))] }); return;
            }
            throw error;
        }
        const c = d.organization!, e = d.editor!, selected = e.selected, section = e.section;
        if (action === 'resume' || action === 'progress') {
            await i.update(action === 'progress' ? { content: this.summary(d), components: [row(button(`setup:${d.revision}:resume`, 'Resume', 1))], files: [{ attachment: Buffer.from(this.fullSummary(d)), name: 'setup-progress.txt' }], allowedMentions: { parse: [] } } : this.render(d));
            return;
        }
        if (action === 'restart') {
            await i.update({ content: 'Discard this draft and start from the saved server configuration? Production settings will stay as they are.', components: [row(button(`setup:${d.revision}:restart-confirm`, 'Confirm', 4), button(`setup:${d.revision}:resume`, 'Cancel'))] }); return;
        }
        if (action === 'restart-confirm') {
            await this.store.deleteSetupDraft(d.guildId, d.ownerId);
            const payload = await this.start(d.guildId, d.ownerId); delete payload.ephemeral; await i.update(payload); return;
        }
        if (action.startsWith('refine-')) {
            if (!e.refinement) throw new Error('Run /server setup to refresh this conversation.');
            await answerRefinement(d, action.slice(7), i);
            d.revision++; d.updatedAt = new Date().toISOString(); await this.store.saveSetupDraft(d);
            if (i.isModalSubmit()) await i.reply(this.render(d)); else await i.update(this.render(d));
            return;
        }
        if (action.startsWith('guide-')) {
            if (!e.conversation) beginConversation(d);
            if (e.section === 'preview') e.section = 'identity';
            if (await answerConversation(d, action.slice(6), i) === 'modal') return;
            d.stage = e.section === 'preview' ? 'preview' : 'identity';
            d.revision++; d.updatedAt = new Date().toISOString();
            await this.store.saveSetupDraft(d);
            if (i.isModalSubmit()) { await i.reply({ ...this.render(d), ephemeral: true }); }
            else await i.update(this.render(d));
            return;
        }
        if (action === 'guided' && d.refinedSetup) { beginRefinement(d, !!(await this.store.load(d.guildId))); d.editor!.refinement!.step = 'sections'; d.revision++; await this.store.saveSetupDraft(d); await i.update(this.render(d)); return; }
        if (action === 'advanced') { delete e.refinement; delete e.conversation; e.section = 'identity'; d.revision++; await this.store.saveSetupDraft(d); await i.update(this.render(d)); return; }
        if (action === 'cancel') {
            await this.store.deleteSetupDraft(d.guildId, d.ownerId);
            await i.update({ content: 'Setup draft cancelled.', components: [] });
            return;
        }
        if (action === 'view') {
            await i.deferReply({ ephemeral: true });
            const saved = await this.store.load(d.guildId);
            const summary = saved ? { ...d, managedDuties: [], config: saved, organization: await this.store.organization(d.guildId) } : d;
            await i.editReply({ content: this.summary(summary), files: [{ attachment: Buffer.from(this.fullSummary(summary)), name: 'configuration.txt' }], allowedMentions: { parse: [] } });
            return;
        }
        if (action === 'repair') {
            const saved = await this.store.load(d.guildId);
            if (!saved) throw new Error('Confirm setup before repairing');
            await i.deferReply({ ephemeral: true });
            const organization = await this.store.organization(d.guildId);
            const resources = configuredResources(saved.modules, organization.additionalResources);
            const checker = new DiscordProvisioner(i.guild, organization.permissions);
            let present = 0, missing = 0, mismatched = 0;
            for (const spec of resources) {
                const bound = organization.resources.find(r => r.key === spec.key);
                const channel = bound && !bound.discordId.startsWith('pending:') ? await i.guild.channels.fetch(bound.discordId).catch((error: any) => { if (error.code === 10003) return null; throw error; }) : null;
                if (!channel) missing++;
                else if (await checker.permissionsMatch(channel, spec)) present++;
                else mismatched++;
            }
            await i.editReply({ content: `Codex found ${present} healthy managed resources, ${missing} missing or unresolved resources, and ${mismatched} permission mismatches. Repair checks functional permissions and creates missing resources. Healthy names and positions are retained. Uncertain creation may require an existing-resource binding.`, components: [row(button(`setup:${d.revision}:repair-confirm`, 'Repair Missing/Incorrect Items', 3), button(`setup:${d.revision}:view`, 'View Details'), button(`setup:${d.revision}:resume`, 'Cancel'))] });
            return;
        }
        if (action === 'repair-confirm') {
            await i.deferReply({ ephemeral: true });
            const config = await this.store.load(d.guildId);
            if (!config)
                throw new Error('Confirm setup before repairing');
            await i.editReply(await this.provision(config, i.user.id));
            return;
        }
        if (action === 'confirm') {
            validateForConfirmation(d);
            validateOrganization(d.guildId, c);
            if (d.refinedSetup && !(await this.store.load(d.guildId)) && (!c.ranks.length || typeof d.config.modules.intelligence !== 'boolean' || typeof d.config.modules.trailmarks !== 'boolean' || ['BOT_COMMANDS','BOT_LOGS'].some(key => !c.resources.some(r => r.key === key) && !c.additionalResources.some(r => r.key === key)))) throw new Error('Complete ranks, command/log destinations, and Intelligence/Trailmark choices before confirming.');
            await i.deferUpdate();
            const stored = await this.store.organization(d.guildId);
            const selectedKeys = new Set(d.resourceSelections ?? []);
            c.resources = [...stored.resources.filter(r => !selectedKeys.has(r.key)), ...c.resources.filter(r => selectedKeys.has(r.key))];
            await this.validateDiscord(i.guild, c, selectedKeys);
            if (d.managedDuties?.length) {
                if (!this.store.managedDuty) throw new Error('Setup duty provisioning is unavailable. Apply the setup refinement migration.');
                await provisionDuties(d, i.guild, { managedDuty: this.store.managedDuty.bind(this.store) });
                validateOrganization(d.guildId, c);
                d.revision++; await this.store.saveSetupDraft(d);
            }
            await this.beforeApply?.(d, i.guild);
            await this.store.saveOrganization(d.config, c, i.user.id);
            const result = await this.provision(d.config, i.user.id);
            await this.store.deleteSetupDraft(d.guildId, d.ownerId);
            await i.editReply({ content: `Configuration saved. ${result}`, components: [] });
            return;
        }
        if (action === 'text' || action === 'new') {
            const value = section === 'identity' ? d.config.organizationName : section === 'namespace' ? d.config.commandNamespace : section === 'integration' ? d.config.confidentialityMarker : this.entities(d).find(x => x.id === selected)?.name;
            await i.showModal({ custom_id: `setup:${d.revision}:${action === 'new' ? 'create' : 'save-text'}`, title: `Configure ${section}`, components: [row({ type: 4, custom_id: 'name', label: section === 'integration' ? 'Confidentiality marker' : 'Name', style: 1, required: true, max_length: section === 'namespace' ? 32 : 100, ...(action !== 'new' && value ? { value } : {}) })] });
            return;
        }
        if (i.isModalSubmit())
            await i.deferReply({ ephemeral: true });
        else
            await i.deferUpdate();
        if (action === 'section') {
            delete e.conversation;
            e.section = i.values[0];
            delete e.selected;
            e.page = 0;
        }
        else if (action === 'page') {
            e.page += Number(i.values[0]);
            delete e.selected;
        }
        else if (action === 'pick') {
            e.selected = i.values[0];
            e.page = 0;
        }
        else if (action === 'target-page') {
            e.page += Number(i.values[0]);
        }
        else if (action === 'back') {
            delete e.selected;
            e.page = 0;
        }
        else if (action === 'create' || action === 'save-text') {
            const name = i.fields.getTextInputValue('name').trim();
            if (!name)
                throw new Error('Name cannot be blank');
            if (section === 'identity')
                d.config.organizationName = name;
            else if (section === 'namespace') {
                if (!/^[a-z0-9_-]{1,32}$/.test(name))
                    throw new Error('Use 1–32 lowercase letters, digits, underscores or hyphens');
                if ((await import('./commands.js')).genericCommandNames.includes(name as any) && !(['help','promotion','apprenticeship'].includes(name) && d.config.commandNamespace === name))
                    throw new Error('Choose a namespace that does not replace a core command');
                d.config.commandNamespace = name;
            }
            else if (section === 'integration')
                d.config.confidentialityMarker = name;
            else if (action === 'save-text') {
                const entity = this.entities(d).find(x => x.id === selected);
                if (!entity)
                    throw new Error('Select an item first');
                entity.rename(name);
            }
            else {
                const id = crypto.randomUUID();
                e.selected = id;
                if (section === 'ranks')
                    c.ranks.push({ id, guildId: d.guildId, name, tier: 'BASELINE' });
                else if (section === 'branches')
                    c.branches.push({ id, name });
                else if (section === 'groups')
                    c.groups.push({ id, guildId: d.guildId, name, multiple: false, required: false });
                else if (section === 'entries') {
                    if (!c.groups.length)
                        throw new Error('Create an assignment group first');
                    c.entries.push({ id, groupId: c.groups[0]!.id, name });
                }
                else if (section === 'resources') {
                    const key = `EXTRA:${id}` as const;
                    c.additionalResources.push({ key, name, kind: 'CHANNEL', parent: 'ORGANIZATION_CATEGORY', minimumTier: 'LEVEL_1' });
                    e.selected = key;
                }
            }
        }
        else if (action === 'delete')
            this.remove(d);
        else if (action === 'permission') {
            if (!permissionTiers.includes(selected as any))
                throw new Error('Select a permission tier');
            c.permissions = c.permissions.filter(p => !i.values.includes(p.roleId));
            c.permissions.push(...i.values.map((roleId: string) => ({ guildId: d.guildId, roleId, tier: selected })));
        }
        else if (action === 'permission-remove') {
            c.permissions = c.permissions.filter(p => p.tier !== selected || !i.values.includes(p.roleId));
        }
        else if (action === 'duty') {
            for (const roleId of i.values) {
                const role = await i.guild.roles.fetch(roleId);
                if (!role)
                    throw new Error('Role no longer exists');
                if (!c.duties.some(x => x.roleId === roleId))
                    c.duties.push({ guildId: d.guildId, roleId, displayName: role.name });
            }
        }
        else if (action === 'role') {
            const entity = section === 'ranks' ? c.ranks.find(x => x.id === selected) : c.entries.find(x => x.id === selected);
            if (!entity)
                throw new Error('Select an item');
            if (i.values[0])
                entity.roleId = i.values[0];
            else
                delete entity.roleId;
        }
        else if (action === 'tier') {
            const rank = c.ranks.find(x => x.id === selected);
            if (rank)
                rank.tier = i.values[0];
        }
        else if (action === 'group') {
            const entry = c.entries.find(x => x.id === selected);
            if (entry)
                entry.groupId = i.values[0];
        }
        else if (action === 'rules') {
            const group = c.groups.find(x => x.id === selected);
            if (group) {
                group.multiple = i.values.includes('multiple');
                group.required = i.values.includes('required');
            }
        }
        else if (action === 'edge') {
            const [branchId, fromRankId] = String(selected).split('/');
            if (!branchId || !fromRankId)
                throw new Error('Select a branch and source rank');
            const pageIds = c.ranks.filter(r => r.id !== fromRankId).slice(e.page * 25, e.page * 25 + 25).map(r => r.id);
            if (i.values.some((id: string) => !pageIds.includes(id)))
                throw new Error('Unknown target on this page');
            c.edges = c.edges.filter(x => x.branchId !== branchId || x.fromRankId !== fromRankId || !pageIds.includes(x.toRankId));
            c.edges.push(...i.values.map((toRankId: string) => ({ guildId: d.guildId, branchId, fromRankId, toRankId })));
        }
        else if (action === 'modules') {
            d.config.modules = { ...d.config.modules, briefings: i.values.includes('briefings'), patrols: i.values.includes('patrols'), supply: i.values.includes('supply'), atlas: i.values.includes('atlas') };
        }
        else if (action === 'channel') {
            const spec = this.specs(d).find(x => x.key === selected);
            if (!spec)
                throw new Error('Select a resource');
            const id = i.values[0];
            if (!id && section !== 'destinations')
                throw new Error('Select an existing resource or retain the managed ID');
            d.resourceSelections = [...new Set([...(d.resourceSelections ?? []), spec.key])];
            c.resources = c.resources.filter(x => x.key !== selected);
            if (id)
                c.resources.push({ guildId: d.guildId, key: spec.key, discordId: id, kind: spec.kind });
        }
        d.config.guildId = d.guildId;
        d.config.modules ??= { briefings: false, patrols: false, supply: false, atlas: false };
        d.config.confidentialityMarker ??= '[CONFIDENTIAL]';
        d.stage = e.section === 'preview' ? 'preview' : sectionStage(e.section);
        d.revision++;
        d.updatedAt = new Date().toISOString();
        await this.store.saveSetupDraft(d);
        await i.editReply(this.render(d));
    }
    private entities(d: StoredSetupDraft): Array<{
        id: string;
        name: string;
        rename: (name: string) => void;
    }> {
        const c = d.organization!, s = d.editor!.section;
        const rows = s === 'ranks' ? c.ranks : s === 'branches' ? c.branches : s === 'groups' ? c.groups : s === 'entries' ? c.entries : [];
        if (s === 'duties')
            return c.duties.map(x => ({ id: x.roleId, name: x.displayName, rename: (name: string) => { x.displayName = name; } }));
        if (s === 'resources')
            return c.additionalResources.map(x => ({ id: x.key, name: x.name, rename: (name: string) => { x.name = name; } }));
        return rows.map(x => ({ id: x.id, name: x.name, rename: (name: string) => { x.name = name; } }));
    }
    private specs(d: StoredSetupDraft) { return [...configuredResources(d.config.modules ?? { briefings: false, patrols: false, supply: false, atlas: false }, d.organization!.additionalResources).filter(r => !['BOT_COMMANDS','BOT_LOGS'].includes(r.key)), { key: 'BOT_COMMANDS' as const, name: 'Command destination', kind: 'CHANNEL' as const }, { key: 'BOT_LOGS' as const, name: 'Log destination', kind: 'CHANNEL' as const }]; }
    private remove(d: StoredSetupDraft): void {
        const c = d.organization!, id = d.editor!.selected, s = d.editor!.section;
        if (s === 'ranks') {
            c.ranks = c.ranks.filter(x => x.id !== id);
            c.edges = c.edges.filter(x => x.fromRankId !== id && x.toRankId !== id);
        }
        if (s === 'branches') {
            c.branches = c.branches.filter(x => x.id !== id);
            c.edges = c.edges.filter(x => x.branchId !== id);
        }
        if (s === 'duties')
            c.duties = c.duties.filter(x => x.roleId !== id);
        if (s === 'entries')
            c.entries = c.entries.filter(x => x.id !== id);
        if (s === 'groups') {
            c.groups = c.groups.filter(x => x.id !== id);
            c.entries = c.entries.filter(x => x.groupId !== id);
        }
        if (s === 'resources')
            c.additionalResources = c.additionalResources.filter(x => x.key !== id);
        delete d.editor!.selected;
    }
    private summary(d: StoredSetupDraft): string {
        if (d.refinedSetup) return refinementSummary(d).slice(0,1900);
        const c = d.organization!;
        return (preview(d) + '\n' + permissionTiers.map(t => `${t}: ${c.permissions.filter(p => p.tier === t).map(p => `<@&${p.roleId}>`).join(', ') || 'none'}`).join('\n') + `\nRanks: ${c.ranks.map(x => x.name).join(', ') || 'none'}\nBranches: ${c.branches.map(x => x.name).join(', ') || 'none'}\nProgression edges: ${c.edges.length}\nDuties: ${c.duties.map(x => x.displayName).join(', ') || 'none'}\nAssignment groups: ${c.groups.map(x => `${x.name} (${x.multiple ? 'multiple' : 'single'}, ${x.required ? 'required' : 'optional'})`).join(', ') || 'none'}\nAssignment entries: ${c.entries.length}\nStored destinations: ${c.resources.length}`).slice(0, 1900);
    }
    render(d: StoredSetupDraft): any {
        if (d.editor?.refinement) return refinementView(d);
        const c = d.organization!, e = d.editor!, s = e.section, id = (action: string) => `setup:${d.revision}:${action}`;
        if (e.conversation && s !== 'preview') {
            const payload = conversationView(d);
            if (e.conversation.step === 'sections') payload.components.push(row(button(id('view'), 'View Saved'), button(id('repair'), 'Repair'), button(id('advanced'), 'Detailed Editor')));
            return payload;
        }
        if (e.conversation && s === 'preview') return { content: this.summary(d).slice(0,1700) + '\nConfirm Setup applies these changes and provisions resources. Review removals carefully: affected members may need synchronization. Full details are attached.', components: [row(button(id('guide-back'), 'Back'), button(id('guide-sections'), 'Edit Section'), button(id('confirm'), 'Confirm Setup', 3), button(id('cancel'), 'Cancel', 4))], files: [{ attachment: Buffer.from(this.fullSummary(d)), name: 'configuration-preview.txt' }], allowedMentions: { parse: [] } };
        const components: any[] = [row(select(id('section'), 'Configuration area', sections.map(x => option(x, x))))];
        let content = `**Setup / Edit: ${s}** — changes are a durable draft until preview and confirmation.`;
        if (['identity', 'namespace', 'integration'].includes(s))
            components.push(row(button(id('text'), 'Edit text', 1)));
        else if (s === 'preview') {
            content = this.summary(d) + '\nConfirm saves configuration and provisions resources.';
            components.push(row(button(id('confirm'), 'Confirm and provision', 3)));
        }
        else if (s === 'modules')
            components.push(row(select(id('modules'), 'Enabled optional modules', ['briefings', 'patrols', 'supply', 'atlas'].map(x => ({ ...option(x, x), default: d.config.modules?.[x as keyof ServerConfig['modules']] ?? false })), 4, 0)));
        else {
            let choices = this.entities(d).map(x => option(x.name, x.id));
            if (s === 'entries')
                choices = c.entries.map(x => option(`${c.groups.find(g => g.id === x.groupId)?.name}: ${x.name}`, x.id));
            if (s === 'permissions')
                choices = permissionTiers.map(x => option(d.refinedSetup ? permissionLabels[x] : x, x));
            if (s === 'progression')
                choices = c.branches.flatMap(b => c.ranks.map(r => option(`${b.name}: ${r.name}`, `${b.id}/${r.id}`)));
            if (s === 'resources' || s === 'destinations')
                choices = this.specs(d).filter(x => s === 'destinations' ? x.key === 'BOT_COMMANDS' || x.key === 'BOT_LOGS' : x.key !== 'BOT_COMMANDS' && x.key !== 'BOT_LOGS').map(x => option(x.name, x.key));
            const page = Math.max(0, Math.min(e.page, Math.ceil(choices.length / 25) - 1));
            if (choices.length && !e.selected)
                components.push(row(select(id('pick'), 'Select item', choices.slice(page * 25, page * 25 + 25))));
            if (!e.selected) {
                if (choices.length > 25)
                    components.push(row(select(id('page'), `Page ${page + 1} of ${Math.ceil(choices.length / 25)}`, [...(page > 0 ? [option('Previous', '-1')] : []), ...((page + 1) * 25 < choices.length ? [option('Next', '1')] : [])])));
                if (['ranks', 'branches', 'groups', 'entries', 'resources'].includes(s))
                    components.push(row(button(id('new'), 'Add', 1)));
                if (s === 'duties')
                    components.push(row({ type: 6, custom_id: id('duty'), placeholder: 'Add existing duty roles', max_values: 25 }));
            }
            else {
                content += `\nSelected: ${choices.find(x => x.value === e.selected)?.label ?? e.selected}`;
                if (s === 'permissions') {
                    const mapped = c.permissions.filter(p => p.tier === e.selected).map(p => p.roleId);
                    content += `\n${e.selected}: ${mapped.map(x => `<@&${x}>`).join(', ') || 'none'}`;
                    components.push(row({ type: 6, custom_id: id('permission'), placeholder: 'Add roles to this tier', max_values: 25 }), row({ type: 6, custom_id: id('permission-remove'), placeholder: 'Remove roles from this tier', max_values: 25 }));
                }
                if (s === 'ranks' || s === 'entries') {
                    const entity = s === 'ranks' ? c.ranks.find(x => x.id === e.selected) : c.entries.find(x => x.id === e.selected);
                    content += `\nMapped role: ${entity?.roleId ? `<@&${entity.roleId}>` : 'none'}`;
                    components.push(row({ type: 6, custom_id: id('role'), placeholder: 'Discord role (clear for no sync)', min_values: 0, max_values: 1 }));
                    if (s === 'ranks')
                        components.push(row(select(id('tier'), 'Rank tier (does not grant permissions)', permissionTiers.map(x => ({ ...option(d.refinedSetup ? permissionLabels[x] : x, x), default: c.ranks.find(r => r.id === e.selected)?.tier === x })))));
                    if (s === 'entries' && c.groups.length) {
                        components.push(row(select(id('group'), 'Assignment group', c.groups.slice(e.page * 25, e.page * 25 + 25).map(x => ({ ...option(x.name, x.id), default: c.entries.find(entry => entry.id === e.selected)?.groupId === x.id })))));
                        this.targetPages(components, id, e.page, c.groups.length);
                    }
                }
                if (s === 'groups') {
                    const group = c.groups.find(x => x.id === e.selected);
                    components.push(row(select(id('rules'), 'Membership rules', [{ ...option('Allow multiple entries', 'multiple'), default: group?.multiple ?? false }, { ...option('Membership required when active', 'required'), default: group?.required ?? false }], 2, 0)));
                }
                if (s === 'progression') {
                    const [branch, from] = e.selected.split('/');
                    const all = c.ranks.filter(r => r.id !== from), targets = all.slice(e.page * 25, e.page * 25 + 25);
                    if (targets.length)
                        components.push(row(select(id('edge'), 'Next ranks on this page', targets.map(r => ({ ...option(r.name, r.id), default: c.edges.some(edge => edge.branchId === branch && edge.fromRankId === from && edge.toRankId === r.id) })), targets.length, 0)));
                    this.targetPages(components, id, e.page, all.length);
                }
                if (s === 'resources' || s === 'destinations') {
                    const spec = this.specs(d).find(x => x.key === e.selected);
                    components.push(row({ type: 8, custom_id: id('channel'), placeholder: 'Use existing destination', channel_types: [spec?.kind === 'CATEGORY' ? ChannelType.GuildCategory : spec?.kind === 'FORUM' ? ChannelType.GuildForum : ChannelType.GuildText], min_values: s === 'destinations' ? 0 : 1, max_values: 1 }));
                }
                if (['ranks', 'branches', 'duties', 'groups', 'entries'].includes(s) && components.length < 5)
                    components.push(row(button(id('text'), 'Rename'), button(id('delete'), 'Delete', 4), ...(s !== 'duties' ? [button(id('new'), 'Add', 1)] : [])));
                if (s === 'resources' && e.selected.startsWith('EXTRA:'))
                    components.push(row(button(id('text'), 'Rename desired resource'), button(id('delete'), 'Stop managing resource', 4)));
            }
        }
        if (components.length < 5)
            components.push(row(button(id('back'), 'Back'), button(id('view'), 'View saved'), button(id('repair'), 'Repair'), button(id('cancel'), 'Cancel', 4), ...(d.refinedSetup ? [button(id('guided'), 'Six Sections')] : [])));
        return { content: content.slice(0, 1900), components, allowedMentions: { parse: [] }, ...(s === 'preview' ? { files: [{ attachment: Buffer.from(this.fullSummary(d)), name: 'configuration-preview.txt' }] } : {}) };
    }
    private targetPages(components: any[], id: (s: string) => string, page: number, total: number): void { const choices = []; if (page > 0)
        choices.push(option('Previous', '-1')); if ((page + 1) * 25 < total)
        choices.push(option('Next', '1')); if (choices.length)
        components.push(row(select(id('target-page'), `Page ${page + 1}`, choices))); }
    private fullSummary(d: StoredSetupDraft): string { if(d.refinedSetup) return refinementSummary(d); const c = d.organization!; return [preview(d), ...c.permissions.map(p => `Permission ${p.tier}: role ${p.roleId}`), ...c.ranks.map(r => `Rank ${r.name}: ${r.tier}, role ${r.roleId ?? 'none'}`), ...c.edges.map(e => `Progression [${c.branches.find(b => b.id === e.branchId)?.name}]: ${c.ranks.find(r => r.id === e.fromRankId)?.name} -> ${c.ranks.find(r => r.id === e.toRankId)?.name}`), ...c.duties.map(x => `Duty ${x.displayName}: role ${x.roleId}`), ...c.groups.flatMap(g => [`Group ${g.name}: ${g.multiple ? 'multiple' : 'single'}, ${g.required ? 'required' : 'optional'}`, ...c.entries.filter(e => e.groupId === g.id).map(e => `  ${e.name}: role ${e.roleId ?? 'none'}`)]), ...this.specs(d).map(r => `${r.name} (${r.kind}): ${c.resources.find(x => x.key === r.key)?.discordId ?? 'create when enabled'}`)].join('\n'); }
    private async validateDiscord(guild: any, c: NonNullable<StoredSetupDraft['organization']>, selectedKeys: Set<string>): Promise<void> {
        const roles = await guild.roles.fetch();
        await guild.members.fetchMe();
        if (c.ranks.some(r => !r.roleId))
            throw new Error('Each rank needs a Discord role mapping');
        for (const id of [...c.permissions.map(x => x.roleId), ...c.ranks.flatMap(x => x.roleId ? [x.roleId] : []), ...c.duties.map(x => x.roleId), ...c.entries.flatMap(x => x.roleId ? [x.roleId] : [])])
            if (!roles.has(id) || id === guild.id)
                throw new Error('A configured role is missing or is @everyone; update role selections');
        for (const id of [...c.ranks.flatMap(r => r.roleId ? [r.roleId] : []), ...c.duties.map(d => d.roleId), ...c.entries.flatMap(e => e.roleId ? [e.roleId] : [])])
            if (!roles.get(id).editable)
                throw new Error('Move the bot role above configured rank, duty and assignment roles; integration-managed roles cannot be assigned');
        for (const resource of c.resources.filter(r => selectedKeys.has(r.key))) {
            const channel = await guild.channels.fetch(resource.discordId);
            if (!channel)
                throw new Error('A selected destination was deleted; select it again');
            const expected = resource.kind === 'CATEGORY' ? ChannelType.GuildCategory : resource.kind === 'FORUM' ? ChannelType.GuildForum : ChannelType.GuildText;
            if (channel.type !== expected)
                throw new Error('Destination type does not match its resource');
        }
    }
}
function sectionStage(section: string): StoredSetupDraft['stage'] { return (section === 'branches' || section === 'progression' ? 'ranks' : section === 'groups' || section === 'entries' ? 'assignments' : section) as StoredSetupDraft['stage']; }
