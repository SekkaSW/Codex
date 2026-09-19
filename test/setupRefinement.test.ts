import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationFlagsBitField, PermissionFlagsBits } from 'discord.js';
import { MessageSetupWizard } from '../src/runtime/messageSetup.js';
import { parseSetupList, refinementView, refinementSummary, featureDescriptions, beginRefinement } from '../src/runtime/setupRefinement.js';
import { emptyOrganization, type OrganizationConfig } from '../src/administration.js';
import type { StoredSetupDraft } from '../src/setup.js';
import { permissionLabels, featureEnabled, type ServerConfig } from '../src/domain.js';
import { configuredResources, repairResources, type ManagedResource } from '../src/resources.js';
import { disabledFeature, backgroundFeatures } from '../src/runtime/features.js';
import { availableActions } from '../src/runtime/panels.js';
import { handleField } from '../src/runtime/handlers/field.js';
import { handleIntelligence } from '../src/runtime/handlers/intelligence.js';
import { handleBridge } from '../src/runtime/handlers/bridge.js';
import { handleAtlas, AtlasRuntime } from '../src/runtime/atlas.js';
import { friendlyError } from '../src/runtime/confirmation.js';
import { closeTrailmarkAccess } from '../src/runtime/featureLifecycle.js';
import { provisionDuties } from '../src/runtime/dutyProvisioning.js';
import { SupabaseRepositories } from '../src/persistence/supabase.js';
import { fixtureConfig, fixtureOrganization, testDatabase } from './database.js';
import { readFile, readdir } from 'node:fs/promises';
export function fixture(existing = false) {
    let draft: StoredSetupDraft | undefined, production: ServerConfig | undefined = existing ? fixtureConfig() : undefined, org: OrganizationConfig = emptyOrganization(), seq = 1000n, applied = 0, provisioned = 0, created = 0, admin = true;
    const roles = new Map(Array.from({ length: 120 }, (_, n) => [String(100 + n), { id: String(100 + n), name: `Role ${n}`, editable: true, managed: false, permissions: { bitfield: 0n } }]));
    const receipts = new Map<string, any>();
    const sent: any[] = [];
    const channel: any = { id: 'channel', type: 0, permissionsFor: () => ({ has: () => false }), async send(p: any) { assert.ok((p.content?.length ?? 0) <= 2000); assert.ok((p.components?.length ?? 0) <= 5); for (const r of p.components ?? []) {
            assert.ok(r.components.length <= 5);
            for (const x of r.components)
                if (x.options) {
                    assert.ok(x.options.length <= 25);
                    for (const o of x.options)
                        assert.ok(o.label.length <= 100);
                }
        } const m = { id: String(++seq), ...p }; sent.push(m); return m; } };
    const guild: any = { id: 'g', members: { async fetch() { return { permissions: { has: () => admin } }; }, async fetchMe() { return { id: 'bot', permissions: { has: () => true }, roles: { highest: { position: 10 } } }; } }, roles: { async fetch(id?: string) { return id ? roles.get(id) : roles; }, async create(o: any) { assert.equal(o.permissions, 0n); assert.equal(o.mentionable, false); created++; const r = { id: String(500 + created), name: o.name, editable: true, managed: false, permissions: { bitfield: 0n } }; roles.set(r.id, r); return r; } }, channels: { async fetch(id: string) { return id === 'channel' ? channel : { id, type: id === 'category' ? 4 : id === 'forum' ? 15 : 0 }; } } };
    const store: any = { async load() { return production && structuredClone(production); }, async organization() { return structuredClone(org); }, async loadSetupDraft() { return draft && structuredClone(draft); }, async saveSetupDraft(d: StoredSetupDraft) { if (draft)
            assert.equal(d.revision, draft.revision + 1); draft = structuredClone(d); }, async deleteSetupDraft() { draft = undefined; }, async saveOrganization(config: ServerConfig, c: OrganizationConfig) { production = structuredClone(config); org = structuredClone(c); applied++; }, async managedDuty(g: string, id: string, action: string, actor: string, data: any) { if (action === 'reserve') {
            const old = receipts.get(id);
            if (old)
                return { ...old, fresh: false };
            const r = { id, attempt: crypto.randomUUID(), name: data.name, fresh: true };
            receipts.set(id, r);
            return r;
        } const r = receipts.get(id); r.role_id = data.roleId; return r; } };
    let wizard = new MessageSetupWizard(store, async () => { provisioned++; return 'Resources ready.'; }, true);
    const interaction = (action: string, values: string[] = [], root = false): any => ({ guildId: 'g', guild, channelId: 'channel', channel, user: { id: 'owner', username: 'Owner' }, client: { options: { intents: { has: () => true } }, application: { async fetch() { return { flags: new ApplicationFlagsBitField(ApplicationFlagsBitField.Flags.GatewayMessageContentLimited) }; } } }, memberPermissions: { has: () => admin }, message: { id: draft?.messageConversation?.promptId }, customId: `setup:${draft?.revision}:${root ? action : 'refine-' + action}`, values, isModalSubmit: () => false, async deferReply() { }, async deferUpdate() { }, async editReply() { } });
    return { store, guild, roles, sent, interaction, get d() { return draft!; }, get last() { return sent.at(-1); }, get wizard() { return wizard; }, get production() { return production; }, get org() { return org; }, get applied() { return applied; }, get created() { return created; }, get provisioned() { return provisioned; }, set admin(value: boolean) { admin = value; }, async start() { await wizard.startInteraction(interaction('')); }, async act(a: string, v: string[] = [], root = false) { await wizard.handle(interaction(a, v, root)); }, async answer(content: string, extra: any = {}) { await wizard.handleMessage({ id: String(++seq), guildId: 'g', guild, channelId: 'channel', channel, author: { id: 'owner', bot: false }, reference: { messageId: draft?.messageConversation?.promptId }, content, ...extra }); }, async at(step: string) { draft!.editor!.refinement!.step = step; draft!.editor!.refinement!.page = 0; await wizard.handle(interaction('resume', [], true)); }, restart() { wizard = new MessageSetupWizard(store, async () => { provisioned++; return 'Ready'; }, true); } };
}
async function ranks(f: ReturnType<typeof fixture>, names = 'Aspirant, Acolyte, Guardian') {
    await f.at('rank-list');
    await f.answer(names);
    await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue');
    for (let n = 0; n < f.d.organization!.ranks.length; n++) {
        await f.act('role', [String(100 + n)]);
        await f.act('tier', ['BASELINE']);
        await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue');
    }
}
function visible(p: any): string { return [p.content, ...(p.components ?? []).flatMap((r: any) => r.components.flatMap((x: any) => [x.label, x.placeholder, ...(x.options ?? []).map((o: any) => o.label)]))].filter(Boolean).join('\n'); }
test('refined group and command use literal messages with normalization and natural confirmation', async () => { const f = fixture(); await f.start(); assert.match(f.last.content, /What is the name of the group/); await f.answer('Order'); assert.equal(f.d.config.organizationName, 'Order'); assert.match(f.last.content, /Group name set to/); await f.answer('/order'); assert.equal(f.d.config.commandNamespace, 'order'); assert.match(f.last.content, /Command set to \/order/); assert.match(f.last.content, /Recruit permissions/); assert.equal(f.applied, 0); });
for (const bad of ['Order Name', '//order', 'help', 'a'.repeat(33)])
    test(`command rejects conflict or invalid syntax: ${bad}`, async () => { const f = fixture(); await f.start(); await f.answer('Group'); await f.answer(bad); assert.equal(f.d.config.commandNamespace, undefined); assert.equal(f.d.editor!.refinement!.step, 'namespace'); });
test('permission labels preserve internal meanings and native multi-role mappings', async () => { assert.deepEqual(Object.values(permissionLabels), ['Recruit', 'Member', 'Advanced Member', 'Advisors', 'Leader']); const f = fixture(); await f.start(); await f.at('permissions'); for (const [index, tier] of Object.keys(permissionLabels).entries()) {
    assert.match(f.last.content, new RegExp(Object.values(permissionLabels)[index]!));
    assert.equal(f.last.components[0].components[0].type, 6);
    await f.act('role', [String(100 + index * 2), String(101 + index * 2)]);
    assert.equal(f.d.organization!.permissions.filter(p => p.tier === tier).length, 0); assert.equal(f.d.editor!.refinement!.pending!.roles!.length, 2);
    assert.doesNotMatch(visible(f.last), /BASELINE|LEVEL_[1-4]/);
    await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue');
} });
test('comma parser trims, preserves first capitalization and deduplicates case-insensitively', () => { assert.deepEqual(parseSetupList(' Aspirant, ACOLYTE, aspirant, Guardian '), ['Aspirant', 'ACOLYTE', 'Guardian']); });
for (const bad of ['', ',A', 'A,', 'A,,B', 'a'.repeat(101), Array(101).fill('A').join(','), 'x'.repeat(1801)])
    test(`bulk list rejects invalid input ${bad.length} characters/${bad.slice(0, 8)}`, () => { assert.throws(() => parseSetupList(bad), /Enter/); });
test('rank list confirms before changes and role plus permission appear together without branches', async () => { const f = fixture(); await f.start(); await f.at('rank-list'); await f.answer('Aspirant, Acolyte, aspirant'); assert.equal(f.d.organization!.ranks.length, 0); assert.match(f.last.content, /Ranks: Aspirant, Acolyte/); await f.act('edit-list'); assert.match(f.last.content, /Current value/); await f.act('keep', [], true); await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue'); assert.deepEqual(f.last.components.slice(0, 2).map((r: any) => r.components[0].type), [6, 3]); assert.doesNotMatch(visible(f.last), /branch/i); await f.act('role', ['100']); await f.act('tier', ['LEVEL_2']); await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue'); assert.match(f.last.content, /Acolyte/); assert.equal(f.d.organization!.ranks[0]!.tier, 'LEVEL_2'); });
test('bulk ranks retain matching IDs and roles when edited', async () => { const f = fixture(); await f.start(); await ranks(f, 'Alpha, Beta'); const id = f.d.organization!.ranks[0]!.id; await f.at('rank-list'); await f.answer('ALPHA, Beta, Gamma'); await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue'); assert.equal(f.d.organization!.ranks[0]!.id, id); assert.equal(f.d.organization!.ranks[0]!.roleId, '100'); });
test('no-branch progression walks multiple next ranks including same-tier alternatives', async () => { const f = fixture(); await f.start(); await ranks(f); const [a, b, c] = f.d.organization!.ranks; await f.act('no-branches'); assert.match(f.last.content, /What is the progression/); await f.act('answer', [a!.id]); await f.act('answer', [b!.id, c!.id]); await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue'); assert.match(f.last.content, /Acolyte/); await f.act('end'); await f.act('accept'); assert.match(f.last.content, /Guardian/); await f.act('end'); await f.act('accept'); assert.equal(f.d.editor!.refinement!.step, 'duty-list'); assert.equal(f.d.organization!.edges.length, 2); });
test('named branches support distinct starting paths and multiple branches', async () => { const f = fixture(); await f.start(); await ranks(f); const [a, b, c] = f.d.organization!.ranks; for (const [name, target] of [['Steel', b!.id], ['Cloth', c!.id]]) {
    await f.act('new-branch');
    await f.answer(name!);
    assert.match(f.last.content, /beginning rank/);
    await f.act('answer', [a!.id]);
    await f.act('answer', [target!]);
    await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue');
    await f.act('end'); await f.act('accept');
    assert.equal(f.d.editor!.refinement!.step, 'branch-more');
} assert.equal(f.d.organization!.branches.length, 2); assert.equal(new Set(f.d.organization!.edges.map(e => e.branchId)).size, 2); });
test('progression rejects self references, missing ranks and cycles without persisting them', async () => { const f = fixture(); await f.start(); await ranks(f, 'A, B'); const [a, b] = f.d.organization!.ranks; await f.act('no-branches'); await f.act('answer', [a!.id]); for (const id of [a!.id, 'missing']) {
    await f.act('answer', [id]);
    assert.equal(f.d.organization!.edges.length, 0);
} await f.act('answer', [b!.id]); await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue'); await f.act('answer', [a!.id]); assert.equal(f.d.organization!.edges.length, 1); assert.match(f.last.content, /loop/); });
test('rank alternatives paginate beyond 25 with Discord limits', async () => { const f = fixture(); await f.start(); await ranks(f, Array.from({ length: 28 }, (_, i) => `Rank ${i}`).join(', ')); await f.act('no-branches'); assert.equal(f.last.components[0].components[0].options.length, 25); await f.act('next'); assert.equal(f.last.components[0].components[0].options.length, 3); await f.act('answer', [f.d.organization!.ranks[27]!.id]); assert.equal(f.last.components[0].components[0].options.length, 25); });
test('duty names are drafted without requiring roles; manual duties and Skip are preserved', async () => { const f = fixture(); await f.start(); f.d.organization!.duties.push({ guildId: 'g', roleId: '110', displayName: 'Steward' }); await f.at('duty-list'); await f.answer('Loremaster, Quartermaster, loremaster, Steward'); assert.deepEqual(f.d.managedDuties!.map(x => x.name), ['Loremaster', 'Quartermaster']); assert.equal(f.created, 0); assert.equal(f.d.organization!.duties[0]!.roleId, '110'); await f.act('edit-list'); await f.act('skip'); assert.equal(f.d.managedDuties!.length, 2); });
test('Assignment Groups bulk entries support required/multiple and no basic role synchronization', async () => { const f = fixture(); await f.start(); await f.at('groups'); for (const [name, required, multi] of [['Holds', 'no', 'yes'], ['Temples', 'yes', 'no']]) {
    await f.act('yes');
    await f.answer(name!);
    await f.act(required!);
    await f.act(multi!);
    assert.doesNotMatch(visible(f.last), /Choose.*role|Synchronize/);
    await f.answer('Whiterun, Falkreath, whiterun');
    assert.equal(f.d.editor!.refinement!.step, 'group-more');
} assert.deepEqual(f.d.organization!.groups.map(g => [g.required, g.multiple]), [[false, true], [true, false]]); assert.equal(f.d.organization!.entries.length, 4); assert.ok(f.d.organization!.entries.every(e => !e.roleId)); });
test('Detailed Editor retains assignment role selectors and returns to six sections', async () => { const f = fixture(); await f.start(); await f.at('groups'); await f.act('yes'); await f.answer('Holds'); await f.act('no'); await f.act('yes'); await f.answer('Whiterun'); const id = f.d.organization!.entries[0]!.id; await f.act('advanced', [], true); await f.act('section', ['entries'], true); await f.act('pick', [id], true); assert.ok(f.last.components.some((r: any) => r.components.some((c: any) => c.type === 6))); await f.act('role', ['110'], true); assert.equal(f.d.organization!.entries[0]!.roleId, '110'); await f.act('guided', [], true); assert.equal(f.d.editor!.refinement!.step, 'sections'); });
test('Optional Features descriptions and multi-select retain other feature flags', async () => { const f = fixture(); await f.start(); f.d.config.modules!.intelligence = false; f.d.config.modules!.trailmarks = false; await f.at('features'); for (const text of Object.values(featureDescriptions))
    assert.ok(f.last.content.includes(text)); assert.doesNotMatch(f.last.content, /modules/i); await f.act('features', ['atlas', 'briefings']); assert.match(f.last.content, /Enabled: Briefings, Atlas/); await f.act('accept'); assert.equal(f.d.config.modules!.intelligence, false); assert.equal(f.d.config.modules!.atlas, true); assert.equal(f.d.editor!.refinement!.step, 'command-channel'); });
for (const feature of ['intelligence', 'trailmarks'] as const)
    test(`${feature} disable requires confirmation on existing groups and preserves history`, async () => { const f = fixture(true); await f.start(); const before = structuredClone(f.d.organization); await f.at(feature); await f.act('no'); assert.equal(f.d.editor!.refinement!.step, 'disable'); assert.notEqual(f.d.config.modules![feature], false); await f.act('disable-confirm'); assert.equal(f.d.config.modules![feature], false); assert.deepEqual(f.d.organization, before); assert.notEqual(f.production!.modules[feature], false); await f.at(feature); await f.act('yes'); assert.equal(f.d.config.modules![feature], true); });
test('new groups explicitly disable Intelligence/Trailmarks and skip private marker', async () => { const f = fixture(); await f.start(); await f.at('intelligence'); await f.act('no'); assert.equal(f.d.editor!.refinement!.step, 'trailmarks'); await f.act('no'); assert.equal(f.d.editor!.refinement!.step, 'atlas'); assert.doesNotMatch(refinementSummary(f.d), /Private Reports/); assert.match(refinementSummary(f.d), /Intelligence: Disabled/); });
test('confidentiality asks only when Intel is enabled and recommends brackets', async () => { const f = fixture(); await f.start(); f.d.config.modules!.intelligence = true; await f.at('trailmarks'); await f.act('no'); assert.equal(f.d.editor!.refinement!.step, 'marker'); assert.match(f.last.content, /brackets/); await f.answer('[LOCAL]'); assert.equal(f.d.config.confidentialityMarker, '[LOCAL]'); assert.match(f.last.content, /Private-report marker set/); });
test('commands/logs allow existing channels or literal creation names', async () => { const f = fixture(); await f.start(); await f.at('command-channel'); await f.act('create'); await f.answer('commands'); assert.equal(f.d.organization!.additionalResources[0]!.key, 'BOT_COMMANDS'); assert.equal(f.d.organization!.additionalResources[0]!.name, 'commands'); await f.act('channel', ['logs']); assert.equal(f.d.organization!.resources[0]!.key, 'BOT_LOGS'); assert.equal(f.d.editor!.refinement!.step, 'core'); });
for (const [step, parent] of [['core', 'CORE_CATEGORY'], ['organization', 'ORGANIZATION_CATEGORY'], ['intel-channels', 'INTELLIGENCE_CATEGORY']])
    test(`${step} accepts custom channel lists while preserving functional resource types`, async () => { const f = fixture(); await f.start(); await f.at(step!); await f.act('customize'); await f.answer('First, Second, Third, Fourth, Fifth, Sixth, Seventh'); const specs = configuredResources(f.d.config.modules!, f.d.organization!.additionalResources); assert.ok(specs.some(s => s.name === 'First' && s.parent === parent)); if (step === 'intel-channels')
        assert.equal(specs.find(s => s.key === 'CONTACTS')!.kind, 'FORUM'); assert.equal(new Set(specs.map(s => s.key)).size, specs.length); });
test('human review contains no internal labels, keys or raw JSON', async () => { const f = fixture(); await f.start(); await f.answer('Order'); await f.answer('order'); await ranks(f); f.d.config.modules!.intelligence = false; f.d.config.modules!.trailmarks = false; await f.act('review'); const text = refinementSummary(f.d); assert.doesNotMatch(text, /BASELINE|LEVEL_[1-4]|CORE_CATEGORY|BOT_COMMANDS|"guildId"/); assert.match(text, /Recruit/); assert.match(text, /Trailmarks: Disabled/); assert.match(text, /Review Your Setup/); assert.equal(f.applied, 0); });
test('Edit Section supports a small targeted change without a full rerun', async () => { const f = fixture(true); await f.start(); await f.act('resume', [], true); assert.equal(f.last.components[0].components[0].options.length, 6); await f.act('section', ['identity']); await f.act('edit-target', ['namespace']); await f.answer('/updated'); await f.act('review'); assert.equal(f.d.config.commandNamespace, 'updated'); assert.equal(f.production!.commandNamespace, 'example'); });
test('bulk message context persists over restart; Back keeps current values', async () => { const f = fixture(); await f.start(); await ranks(f, 'A, B'); f.restart(); await f.start(); await f.act('resume', [], true); assert.equal(f.d.editor!.refinement!.step, 'branches'); await f.act('back'); assert.equal(f.d.editor!.refinement!.step, 'rank-config'); assert.equal(f.d.organization!.ranks[1]!.name, 'B'); });
test('full refined message flow only creates duties and applies after final review confirmation', async () => { const f = fixture(); await f.start(); await f.answer('Order'); await f.answer('/order'); for (let n = 0; n < 5; n++) { await f.act('none'); await f.act('accept'); } await f.answer('A, B'); await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue'); for (const id of ['100', '101']) {
    await f.act('role', [id]); await f.act('tier', ['BASELINE']);
    await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue');
} await f.act('no-branches'); const [a, b] = f.d.organization!.ranks; await f.act('answer', [a!.id]); await f.act('answer', [b!.id]); await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue'); await f.act('end'); await f.act('accept'); await f.answer('Loremaster, Quartermaster'); await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue'); await f.act('no'); await f.act('features', ['atlas']); await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue'); await f.act('channel', ['commands']); await f.act('channel', ['logs']); await f.act('recommended'); await f.act('recommended'); await f.act('no'); await f.act('no'); assert.match(f.last.content, /Atlas enabled/); assert.equal(f.applied, 0); assert.equal(f.created, 0); await f.act(f.d.editor!.refinement!.pending?.review ? 'accept' : 'continue'); await f.act('confirm', [], true); assert.equal(f.applied, 1); assert.equal(f.created, 2); assert.equal(f.org.duties.length, 2); assert.equal(f.provisioned, 1); assert.equal(f.d, undefined); });
test('premature confirmation and unauthorized/stale messages cannot apply', async () => { const f = fixture(); await f.start(); await f.answer('Order'); await f.answer('order'); await f.act('review'); await f.act('confirm', [], true); assert.equal(f.applied, 0); await f.at('identity'); const original = f.d.config.organizationName; await f.answer('Intruder', { author: { id: 'other', bot: false } }); assert.equal(f.d.config.organizationName, original); f.admin = false; await assert.rejects(f.answer('Denied'), /Administrator/); });
for (const feature of ['intelligence', 'trailmarks'] as const)
    test(`${feature} resources and overrides are excluded while disabled and return on re-enable`, () => {
        const modules = { ...fixtureConfig().modules, [feature]: false };
        const extras: any[] = feature === 'intelligence' ? [{ key: 'CONTACTS', kind: 'FORUM', name: 'People', parent: 'INTELLIGENCE_CATEGORY' }, { key: 'REPORT_TOPIC:old', kind: 'CHANNEL', name: 'Reports' }, { key: 'EXTRA:private', kind: 'CHANNEL', name: 'More', parent: 'INTELLIGENCE_CATEGORY' }] : [{ key: 'TRAILMARK_ACCESS', kind: 'CHANNEL', name: 'Locations' }, { key: 'TRAILMARK:old', kind: 'CHANNEL', name: 'Old' }];
        const off = configuredResources(modules, extras);
        assert.ok(extras.every(x => !off.some(s => s.key === x.key)));
        assert.ok(!off.some(s => s.key === (feature === 'intelligence' ? 'INTELLIGENCE_CATEGORY' : 'TRAILMARK_CATEGORY')));
        assert.ok(configuredResources({ ...modules, [feature]: true }, extras).some(s => s.key === extras[0].key));
    });
test('disabled-feature repair retains historical resources without treating them as missing', async () => { const rows: ManagedResource[] = [{ guildId: 'g', key: 'CONTACTS', discordId: 'old', kind: 'FORUM' }, { guildId: 'g', key: 'TRAILMARK_ACCESS', discordId: 'trail', kind: 'CHANNEL' }], seen: string[] = []; await repairResources('g', configuredResources({ ...fixtureConfig().modules, intelligence: false, trailmarks: false }), { async list() { return rows; }, async put(r) { rows.push(r); } }, { async exists() { return true; }, async create(s) { seen.push(s.key); return 'new-' + s.key; }, async restorePermissions() { } }); assert.ok(!seen.includes('CONTACTS') && !seen.includes('TRAILMARK_ACCESS')); assert.ok(rows.some(r => r.discordId === 'old') && rows.some(r => r.discordId === 'trail')); });
test('existing configs without flags remain enabled and Atlas resource follows only Atlas toggle', () => { const c = fixtureConfig(); assert.equal(featureEnabled(c, 'intelligence'), true); assert.equal(featureEnabled(c, 'trailmarks'), true); assert.ok(configuredResources({ ...c.modules, atlas: true, trailmarks: false, intelligence: false }).some(s => s.key === 'ATLAS')); assert.ok(!configuredResources({ ...c.modules, atlas: false }, [{ key: 'ATLAS', name: 'Map', kind: 'CHANNEL' }]).some(s => s.key === 'ATLAS')); });
for (const system of ['intel', 'contact', 'alliance', 'trailmark', 'patrol'])
    test(`disabled ${system} is absent from dashboard actions`, async () => { const c = { ...fixtureConfig(), modules: { ...fixtureConfig().modules, patrols: true, intelligence: false, trailmarks: false } }; assert.ok(disabledFeature(c, system)); assert.deepEqual(await availableActions({} as any, {} as any, c, system, () => true), []); });
test('direct commands and stale field/intel/bridge components fail before writes when disabled', async () => { const store: any = { async load() { return { ...fixtureConfig(), modules: { ...fixtureConfig().modules, intelligence: false, trailmarks: false } }; } }; const base: any = { guildId: 'g', user: { id: 'owner' }, options: { getSubcommand: () => 'create' } }; await assert.rejects(handleField({ ...base, commandName: 'trailmark' }, store), /Trailmarks are not enabled/); await assert.rejects(handleField({ ...base, customId: 'field:owner:trail:report-form:x' }, store), /Trailmarks are not enabled/); await assert.rejects(handleIntelligence({ ...base, commandName: 'contact' }, store), /Intelligence is not enabled/); await assert.rejects(handleBridge({ ...base, customId: 'bridge:owner:sync' }, store), /Intelligence is not enabled/); });
test('background feature plan skips disabled workers and resumes on re-enable', () => { const c = { ...fixtureConfig(), modules: { ...fixtureConfig().modules, atlas: true, intelligence: false, trailmarks: false } }; assert.deepEqual(backgroundFeatures(c), { atlas: false, intelligence: false, trailmarks: false }); assert.deepEqual(backgroundFeatures({ ...c, modules: { ...c.modules, trailmarks: true, intelligence: true } }), { atlas: true, intelligence: true, trailmarks: true }); });
test('Atlas remains linkable but polling and status clearly degrade without Trailmarks', async () => { let calls = 0, response: any; const store: any = { async load() { return { ...fixtureConfig(), modules: { ...fixtureConfig().modules, atlas: true, trailmarks: false } }; }, async atlasRpc() { calls++; return { link: true }; }, async permissionRoles() { return []; } }; await new AtlasRuntime(store).poll({ id: 'g' }); assert.equal(calls, 0); await handleAtlas({ guildId: 'g', user: { id: 'owner' }, guild: { members: { async fetch() { return { permissions: { has: () => true }, roles: { cache: new Map() } }; } }, roles: { async fetch() { return new Map(); } } }, options: { getSubcommand: () => 'status' }, async deferReply() { }, async editReply(p: any) { response = p; } }, store); assert.match(response.content, /Trailmarks are not enabled/); assert.match(response.content, /linking remains available/); });
test('disabled messages survive friendly error sanitization', () => { for (const message of ['Trailmarks are not enabled for this group.', 'Intelligence is not enabled for this group.'])
    assert.equal(friendlyError(new Error(message)), message); });
test('managed duties persist role IDs and repeated finalization never creates duplicates', async () => { const f = fixture(); await f.start(); f.d.managedDuties = [{ id: crypto.randomUUID(), name: 'Loremaster' }]; const draft = structuredClone(f.d); await provisionDuties(draft, f.guild, f.store); assert.equal(f.created, 1); assert.equal(draft.organization!.duties[0]!.roleId, '501'); await provisionDuties(structuredClone(f.d), f.guild, f.store); assert.equal(f.created, 1); });
test('manual duties are never recreated or replaced', async () => { const f = fixture(); await f.start(); f.d.organization!.duties.push({ guildId: 'g', roleId: '100', displayName: 'Steward' }); f.d.managedDuties = [{ id: crypto.randomUUID(), name: 'steward' }]; await provisionDuties(f.d, f.guild, f.store); assert.equal(f.created, 0); assert.equal(f.d.organization!.duties[0]!.roleId, '100'); });
test('managed duty creation fails before side effects without role hierarchy/permissions', async () => { const f = fixture(); await f.start(); f.d.managedDuties = [{ id: crypto.randomUUID(), name: 'Duty' }]; f.guild.members.fetchMe = async () => ({ permissions: { has: () => false }, roles: { highest: { position: 1 } } }); await assert.rejects(provisionDuties(f.d, f.guild, f.store), /Move the bot role/); assert.equal(f.created, 0); });
test('uncertain duty creation recovers only from the exact bot-authored audit event', async () => { const f = fixture(); await f.start(); const id = crypto.randomUUID(); f.d.managedDuties = [{ id, name: 'Duty' }]; const receipt = await f.store.managedDuty('g', id, 'reserve', 'owner', { name: 'Duty' }); f.guild.fetchAuditLogs = async () => ({ entries: new Map([['entry', { reason: `Codex duty ${receipt.attempt}`, executorId: 'bot', targetId: '110' }]]) }); await provisionDuties(f.d, f.guild, f.store); assert.equal(f.created, 0); assert.equal(f.d.organization!.duties[0]!.roleId, '110'); });
test('uncertain duty outcome never creates a duplicate without matching audit evidence', async () => { const f = fixture(); await f.start(); const id = crypto.randomUUID(); f.d.managedDuties = [{ id, name: 'Duty' }]; await f.store.managedDuty('g', id, 'reserve', 'owner', { name: 'Duty' }); f.guild.fetchAuditLogs = async () => ({ entries: new Map() }); await assert.rejects(provisionDuties(f.d, f.guild, f.store), /uncertain outcome/); assert.equal(f.created, 0); });
test('stored missing or unmanageable duty role fails clearly instead of creating another', async () => { const f = fixture(); await f.start(); const id = crypto.randomUUID(); f.d.managedDuties = [{ id, name: 'Duty' }]; await f.store.managedDuty('g', id, 'reserve', 'owner', { name: 'Duty' }); await f.store.managedDuty('g', id, 'complete', 'owner', { roleId: 'missing' }); await assert.rejects(provisionDuties(f.d, f.guild, f.store), /deleted/); assert.equal(f.created, 0); });
test('back from feature disable confirmation restores a usable question', async () => { const f = fixture(true); await f.start(); await f.at('trailmarks'); await f.act('no'); await f.act('back'); assert.equal(f.d.editor!.refinement!.step, 'trailmarks'); assert.notEqual(f.d.config.modules!.trailmarks, false); await f.act('no'); await f.act('disable-cancel'); assert.equal(f.d.config.modules!.trailmarks, true); });
test('Supabase configuration reader defaults older rows to enabled while honoring disabled flags', async () => { let modules: any[] = []; const chain: any = { select() { return this; }, eq() { return this; }, limit() { return Promise.resolve({ data: [{ guild_id: 'g', organization_name: 'Group', command_namespace: 'group', confidentiality_marker: '[LOCAL]', server_modules: modules }], error: null }); } }; const repo = new SupabaseRepositories({ from: () => chain, rpc: async () => ({ data: null, error: null }) }); assert.equal((await repo.server('g'))!.modules.intelligence, true); modules = [{ module_key: 'intelligence', enabled: false }, { module_key: 'trailmarks', enabled: false }]; assert.equal((await repo.server('g'))!.modules.trailmarks, false); assert.equal((await repo.server('g'))!.modules.intelligence, false); });
test('migration 012 upgrades populated guilds, preserves history, and enforces both features at SQL boundaries', async () => {
    const { db, client } = await testDatabase(async (db, file) => { if (file.startsWith('012_')) {
        await db.query('select codex_save_organization($1,$2,$3)', [fixtureConfig(), fixtureOrganization(), 'admin']);
        await db.exec("insert into duty_roles values('g','777','Manual duty'); insert into intel_reports(id,guild_id,body,source,created_at,delivery_status) values('99999999-0000-4000-8000-000000000001','g','History','codex',now(),'CAPTURED');");
    } });
    try {
        const repo = new SupabaseRepositories(client);
        const flags = await db.query<{
            module_key: string;
            enabled: boolean;
        }>("select module_key,enabled from server_modules where guild_id='g' and module_key in('intelligence','trailmarks') order by module_key");
        assert.deepEqual(flags.rows, [{ module_key: 'intelligence', enabled: true }, { module_key: 'trailmarks', enabled: true }]);
        const before = await repo.organization('g');
        const config = { ...fixtureConfig(), modules: { ...fixtureConfig().modules, atlas: true, intelligence: false, trailmarks: false } };
        await repo.saveOrganization(config, before, 'admin');
        await assert.rejects(repo.intelligence('g', 'topics', 'owner'), /Intelligence is not enabled/);
        await assert.rejects(repo.trailmark('g', 'list', 'owner'), /Trailmarks are not enabled/);
        await assert.rejects(repo.bridge('g', 'queue', 'owner'), /Intelligence is not enabled/);
        await assert.rejects(repo.optional('g', 'patrol', 'suggest', 'owner'), /Trailmarks are not enabled/);
        await assert.rejects(repo.atlasRpc('claim_pending_atlas_trailmark_access_requests', { p_guild_id: 'g' }), /Trailmarks are not enabled/);
        await assert.rejects(repo.atlasRpc('request_atlas_trailmark_access', { p_guild_id: 'g', p_atlas_user_id: 'map-user', p_trailmark_id: crypto.randomUUID(), p_request_id: crypto.randomUUID() }), /Trailmarks are not enabled/);
        const receipt: any = await repo.intelligence('g', 'delivery-claim', 'system', undefined, { key: 'funds:summary', channel: '123' });
        assert.equal(receipt.claimed, true);
        await repo.intelligence('g', 'delivery-complete', 'system', undefined, { key: 'funds:summary', message: '456' });
        assert.equal((await db.query("select * from intel_reports where guild_id='g'")).rows.length, 1);
        assert.equal((await repo.organization('g')).duties[0]!.roleId, '777');
        await repo.saveOrganization({ ...config, modules: { ...config.modules, intelligence: true, trailmarks: true } }, before, 'admin');
        assert.deepEqual(await repo.intelligence('g', 'topics', 'owner'), []);
        assert.deepEqual(await repo.trailmark('g', 'list', 'owner'), []);
        for (const role of ['anon', 'authenticated']) {
            await db.exec(`set role ${role}`);
            await assert.rejects(db.query("select * from managed_duty_creations"), /permission denied/);
            await assert.rejects(db.query("select codex_managed_duty('g',$1,'reserve','owner','{\"name\":\"Duty\"}')", [crypto.randomUUID()]), /permission denied/);
            await db.exec('reset role');
        }
        const rls = await db.query<{
            relrowsecurity: boolean;
        }>("select relrowsecurity from pg_class where relname='managed_duty_creations'");
        assert.equal(rls.rows[0]!.relrowsecurity, true);
    }
    finally {
        await db.close();
    }
});
test('managed duty SQL receipts persist first-time role IDs before configuration and audit exactly once on save', async () => { const { db, client } = await testDatabase(); try {
    const repo = new SupabaseRepositories(client), id = crypto.randomUUID();
    const receipt = await repo.managedDuty('new', id, 'reserve', 'owner', { name: 'Steward' });
    assert.equal(receipt.fresh, true);
    const repeated = await repo.managedDuty('new', crypto.randomUUID(), 'reserve', 'owner', { name: 'steward' });
    assert.equal(repeated.id, id);
    assert.equal(repeated.fresh, false);
    await assert.rejects(repo.managedDuty('other', id, 'complete', 'owner', { attempt: receipt.attempt, roleId: '123' }), /does not match/);
    await repo.managedDuty('new', id, 'complete', 'owner', { attempt: receipt.attempt, roleId: '123' });
    const c = emptyOrganization();
    c.duties = [{ guildId: 'new', roleId: '123', displayName: 'Steward' }];
    await repo.saveOrganization(fixtureConfig('new'), c, 'owner');
    await repo.managedDuty('new', id, 'complete', 'owner', { attempt: receipt.attempt, roleId: '123' });
    assert.equal((await repo.organization('new')).duties[0]!.roleId, '123');
    assert.equal((await db.query("select * from audit_events where guild_id='new' and event_type='MANAGED_DUTY_ROLE_CREATED'")).rows.length, 1);
    await assert.rejects(repo.managedDuty('new', id, 'complete', 'owner', { attempt: receipt.attempt, roleId: '456' }), /stored role/);
}
finally {
    await db.close();
} });
test('Supabase migration mirror exactly matches canonical sequential migration history', async () => { const canonical = new URL('../../migrations/', import.meta.url), mirror = new URL('../../supabase/migrations/', import.meta.url); const a = (await readdir(canonical)).filter(x => x.endsWith('.sql')).sort(), b = (await readdir(mirror)).filter(x => x.endsWith('.sql')).sort(); assert.equal(a.length, b.length); for (let n = 0; n < a.length; n++)
    assert.equal((await readFile(new URL(a[n]!, canonical), 'utf8')).replaceAll('\r\n', '\n'), (await readFile(new URL(b[n]!, mirror), 'utf8')).replaceAll('\r\n', '\n')); assert.ok(a.includes('013_native_supply_workflows.sql')); });
test('small edits on existing valid configurations do not force new ranks or destinations', async () => { const f = fixture(true); await f.start(); await f.act('resume', [], true); await f.act('section', ['identity']); await f.act('edit-target', ['identity']); await f.answer('New group name'); await f.act('review'); await f.act('confirm', [], true); assert.equal(f.applied, 1); assert.equal(f.production!.organizationName, 'New group name'); });
test('disabling Trailmarks closes temporary access before stopping workers and keeps session history', async () => { const rows: any[] = Array.from({ length: 103 }, (_, i) => ({ id: String(i), trailmark_id: 'mark', discord_member_id: 'member' + i, state: 'ACTIVE' })), revoked: string[] = []; const store: any = { async trailmark(g: string, action: string, actor: string, id?: string) { if (action === 'sessions')
        return rows.filter(r => r.state !== 'CLOSED').slice(0, 100); if (action === 'get')
        return { id: 'mark' }; const row = rows.find(r => r.id === id); row.state = action === 'session-revoke' ? 'REVOKING' : 'CLOSED'; } }; await closeTrailmarkAccess('g', 'owner', store, async (t, m) => { assert.equal(t.id, 'mark'); revoked.push(m); }); assert.equal(revoked.length, 103); assert.equal(rows.length, 103); assert.ok(rows.every(r => r.state === 'CLOSED')); });
test('temporary access cleanup failure remains retryable and does not mark a session closed', async () => { let state = 'ACTIVE'; const store: any = { async trailmark(g: string, a: string) { if (a === 'sessions')
        return state === 'CLOSED' ? [] : [{ id: 's', trailmark_id: 't', discord_member_id: 'm', state }]; if (a === 'get')
        return { id: 't' }; if (a === 'session-revoke')
        state = 'REVOKING'; if (a === 'session-closed')
        state = 'CLOSED'; } }; await assert.rejects(closeTrailmarkAccess('g', 'owner', store, async () => { throw new Error('No channel permission'); }), /permission/); assert.equal(state, 'REVOKING'); await closeTrailmarkAccess('g', 'owner', store, async () => { }); assert.equal(state, 'CLOSED'); });

test('legacy draft upgrade preserves accepted values but clears obsolete text expectations',async()=>{const f=fixture();await f.start();await f.answer('Saved Group');f.d.refinedSetup=false;delete f.d.editor!.refinement;f.d.editor!.conversation={step:'namespace',index:0,history:[]};f.d.messageConversation!.textPrompt={action:'guide-answer',content:'Old question'};await f.start();await f.act('resume',[],true);assert.equal(f.d.config.organizationName,'Saved Group');assert.equal(f.d.messageConversation!.textPrompt,undefined);assert.equal(f.d.editor!.refinement!.step,'sections');assert.equal(f.d.stage,'identity');assert.equal(f.d.config.modules!.intelligence,undefined);});
test('View Saved excludes uncommitted duty names from the draft',async()=>{const f=fixture(true);await f.start();await f.at('duty-list');await f.answer('Not Yet Saved');await f.act('view',[],true);assert.doesNotMatch(f.last.content,/Not Yet Saved/);assert.ok(!f.last.files[0].attachment.toString().includes('Not Yet Saved'));});

for (const name of ['order','/order','  /order  ']) test(`setup routed namespace answer ${name}`,async()=>{const f=fixture();await f.start();await f.answer('Example');await f.answer(name);assert.equal(f.d.config.commandNamespace,'order');assert.equal(f.d.editor!.refinement!.step,'permissions');assert.equal(f.applied,0);});
test('setup pending role review replaces and confirms exactly once with conflicts preserved',async()=>{const f=fixture();await f.start();await f.at('permissions');await f.act('role',['100','101']);assert.equal(f.d.organization!.permissions.length,0);assert.match(f.last.content,/Are these all/);await f.act('change');assert.deepEqual(f.last.components[0].components[0].default_values.map((x:any)=>x.id),['100','101']);await f.act('role',['102']);const confirm=f.interaction('accept');await f.wizard.handle(confirm);assert.deepEqual(f.d.organization!.permissions.map(x=>x.roleId),['102']);assert.equal(f.d.editor!.refinement!.index,1);await assert.rejects(f.wizard.handle(confirm),/stale/);await f.act('role',['102']);assert.match(f.last.content,/already belongs/);assert.equal(f.d.editor!.refinement!.pending,undefined);await f.act('none');await f.act('accept');assert.equal(f.d.editor!.refinement!.index,2);});
test('setup fast paired selectors survive one partial update; old selectors cannot mutate next rank',async()=>{const f=fixture();await f.start();await f.at('rank-list');await f.answer('One, Two, Three');await f.act('continue');for(let n=0;n<3;n++){assert.match(f.last.content,new RegExp(`Rank ${n+1} of 3`));assert.match(f.last.content,/Permission level: Unanswered/);const role=f.interaction('role',[String(100+n)]),tier=f.interaction('tier',[Object.keys(permissionLabels)[n]!]);await Promise.all(n%2?[f.wizard.handle(tier),f.wizard.handle(role)]:[f.wizard.handle(role),f.wizard.handle(tier)]);assert.match(f.last.content,/Confirm rank/);assert.equal(f.d.organization!.ranks[n]!.roleId,undefined);await f.act('accept');assert.equal(f.d.organization!.ranks[n]!.roleId,String(100+n));assert.equal(f.d.organization!.ranks[n]!.tier,Object.keys(permissionLabels)[n]);await assert.rejects(f.wizard.handle(role),/stale/);}assert.equal(f.d.editor!.refinement!.step,'branches');assert.equal(f.applied,0);assert.equal(f.created,0);});
test('setup partial pair and review survive resume; change restores own pending pair',async()=>{const f=fixture();await f.start();await f.at('rank-list');await f.answer('One');await f.act('continue');await f.act('tier',['LEVEL_2']);assert.match(f.last.content,/Discord role: Unanswered/);f.restart();await f.start();await f.act('resume',[],true);assert.match(f.last.content,/Advanced Member/);await f.act('role',['103']);await f.act('change');assert.match(f.last.content,/Role 3/);assert.equal(f.d.organization!.ranks[0]!.roleId,undefined);await f.act('role',['104']);await f.act('accept');assert.equal(f.d.organization!.ranks[0]!.roleId,'104');await f.act('back');assert.equal(f.d.editor!.refinement!.step,'rank-config');assert.equal(f.d.editor!.refinement!.pending,undefined);assert.match(f.last.content,/Review These Settings|Choose its Discord role/);});
test('setup feature review replaces pending choices and preserves independent flags',async()=>{const f=fixture();await f.start();f.d.config.modules!.intelligence=false;f.d.config.modules!.trailmarks=true;await f.at('features');await f.act('features',['atlas']);assert.equal(f.d.config.modules!.atlas,false);await f.act('change');await f.act('none');assert.match(f.last.content,/Enabled: None/);await f.act('accept');assert.equal(f.d.editor!.refinement!.step,'command-channel');assert.equal(f.d.config.modules!.intelligence,false);assert.equal(f.d.config.modules!.trailmarks,true);assert.equal(f.d.config.modules!.atlas,false);});
