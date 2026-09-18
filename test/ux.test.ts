import test from 'node:test';
import assert from 'node:assert/strict';
import { SetupWizard } from '../src/runtime/setupWizard.js';
import { emptyOrganization } from '../src/administration.js';
import type { StoredSetupDraft } from '../src/setup.js';
import { beginConversation, conversationView, conversationResources } from '../src/runtime/setupConversation.js';
import { availableActions, openPanel, handlePanel, commandInteraction } from '../src/runtime/panels.js';
import { needsConfirmation, askConfirmation, handleConfirmation, friendlyError } from '../src/runtime/confirmation.js';
import { commandDefinitions } from '../src/runtime/commands.js';
import { choices, recordView } from '../src/runtime/interactions.js';
import { configuredResources } from '../src/resources.js';
import { route } from '../src/runtime/bot.js';
import { SupabaseRepositories } from '../src/persistence/supabase.js';
import { testDatabase, fixtureConfig } from './database.js';
import { browse } from '../src/runtime/browse.js';
import { DiscordProvisioner } from '../src/runtime/discordProvisioner.js';
import { PermissionFlagsBits } from 'discord.js';

function assertPayload(payload: any) {
    assert.ok((payload.content?.length ?? 0) <= 2000);
    assert.ok((payload.components?.length ?? 0) <= 5);
    for (const row of payload.components ?? []) {
        assert.ok(row.components.length <= 5);
        for (const c of row.components) {
            assert.ok(c.custom_id.length <= 100, c.custom_id);
            if (c.type !== 2) assert.equal(row.components.length, 1);
            if (c.options) { assert.ok(c.options.length <= 25 && c.options.length > 0); for (const o of c.options) assert.ok(o.label.length <= 100 && o.value.length <= 100); }
        }
    }
}
function wizardFixture(existing = false) {
    let draft: StoredSetupDraft | undefined, response: any, saves = 0, provisions = 0, applied = 0;
    const roles = new Map(['first', 'second', 'duty', 'entry', 'a', 'b', 'c'].map(id => [id, { id, name: id.toUpperCase(), editable: true }]));
    const guild = { id: 'g', roles: { everyone: { id: 'g' }, async fetch(id?: string) { return id ? roles.get(id) : roles; } }, members: { async fetchMe() { return { id: 'bot' }; } }, channels: { async fetch(id: string) { return { id, type: id.startsWith('category') ? 4 : id.startsWith('forum') ? 15 : 0, permissionOverwrites: { cache: new Map() } }; } } };
    const store: any = { async load() { return existing ? fixtureConfig() : undefined; }, async organization() { return emptyOrganization(); }, async loadSetupDraft() { return draft ? structuredClone(draft) : undefined; }, async saveSetupDraft(d: StoredSetupDraft) { if (draft) assert.equal(d.revision, draft.revision + 1); draft = structuredClone(d); saves++; }, async deleteSetupDraft() { draft = undefined; }, async saveOrganization() { applied++; } };
    const provision = async () => { provisions++; return 'Resources ready.'; };
    let wizard = new SetupWizard(store, provision);
    const interaction = (action: string, values: string[] = [], text?: string, rev = draft!.revision): any => ({ id: crypto.randomUUID(), guildId: 'g', guild, user: { id: 'owner' }, memberPermissions: { has: () => true }, customId: `setup:${rev}:${action}`, values, isModalSubmit: () => text !== undefined, fields: { getTextInputValue: () => text }, async showModal(p: any) { response = p; }, async update(p: any) { assertPayload(p); response = p; }, async reply(p: any) { assertPayload(p); response = p; }, async deferReply() {}, async deferUpdate() {}, async editReply(p: any) { if (typeof p === 'object') assertPayload(p); response = p; } });
    return { store, guild, roles, interaction, get draft() { return draft!; }, get response() { return response; }, get saves() { return saves; }, get provisions() { return provisions; }, get applied() { return applied; }, get wizard() { return wizard; }, async start() { response = await wizard.start('g', 'owner'); return response; }, async act(action: string, values: string[] = [], text?: string) { await wizard.handle(interaction(action, values, text)); }, restart() { wizard = new SetupWizard(store, provision); } };
}

test('UX setup starts at Organization Name and accepts one-field modals with a saved confirmation', async () => {
    const f = wizardFixture(); await f.start(); assert.match(f.response.content, /Organization Name/);
    await f.act('guide-text'); assert.equal(f.response.components.length, 1); assert.equal(f.response.components[0].components.length, 1);
    const before = f.saves; await f.act('guide-answer', [], 'Example Guild'); assert.equal(f.saves, before + 1); assert.equal(f.draft.config.organizationName, 'Example Guild'); assert.match(f.response.content, /Organization Name set to/); assert.match(f.response.content, /namespace/);
    await f.act('guide-answer', [], 'example'); assert.equal(f.draft.config.commandNamespace, 'example'); assert.match(f.response.content, /\/example/); assert.equal(f.draft.editor!.conversation!.step, 'permissions'); assert.equal(f.response.components[0].components[0].type, 6); assert.equal(f.applied, 0);
});
test('UX setup rejects reserved namespaces and missing roles without saving invalid answers', async () => {
    const f = wizardFixture(); await f.start(); await f.act('guide-answer', [], 'Example');
    const before = f.saves; await assert.rejects(f.act('guide-answer', [], 'help'), /core command/); assert.equal(f.saves, before);
    await f.act('guide-answer', [], 'example'); await assert.rejects(f.act('guide-answer', ['deleted']), /role no longer/);
});
test('UX setup adds multiple roles per tier, continues through all five tiers and clears only the current tier', async () => {
    const f = wizardFixture(); await f.start(); await f.act('guide-answer', [], 'Example'); await f.act('guide-answer', [], 'example');
    await f.act('guide-answer', ['a', 'b']); await f.act('guide-answer', ['c']); assert.equal(f.draft.organization!.permissions.length, 3); assert.match(f.response.content, /A, B, C/);
    await f.act('guide-continue'); await f.act('guide-answer', ['c']); assert.equal(f.draft.organization!.permissions.find(p => p.roleId === 'c')!.tier, 'LEVEL_1');
    await f.act('guide-clear'); assert.equal(f.draft.organization!.permissions.length, 2);
    for (let n = 0; n < 4; n++) await f.act('guide-continue'); assert.equal(f.draft.editor!.conversation!.step, 'ranks');
});
test('UX full conversation creates ranks, explicit edges, duties, assignment rules, modules and resources before final confirmation', async () => {
    const f = wizardFixture(); await f.start(); await f.act('guide-answer', [], 'Example'); await f.act('guide-answer', [], 'example'); await f.act('guide-answer', ['a']);
    for (let n = 0; n < 5; n++) await f.act('guide-continue');
    for (const [name, role] of [['First', 'first'], ['Second', 'second']]) { await f.act('guide-add'); await f.act('guide-answer', [], name); await f.act('guide-answer', [role!]); await f.act('guide-answer', ['BASELINE']); await f.act('guide-skip'); }
    assert.equal(f.draft.organization!.ranks.length, 2); await f.act('guide-continue'); await f.act('guide-new-branch'); await f.act('guide-answer', [], 'Path');
    const [first, second] = f.draft.organization!.ranks; await f.act('guide-answer', [first!.id]); await f.act('guide-answer', [second!.id]); assert.match(f.response.content, /First → Second/); await f.act('guide-continue');
    await f.act('guide-add'); await f.act('guide-answer', ['duty']); await f.act('guide-answer', [], 'Steward'); await f.act('guide-continue');
    await f.act('guide-add'); await f.act('guide-answer', [], 'Temples'); await f.act('guide-yes'); await f.act('guide-no'); await f.act('guide-yes'); await f.act('guide-answer', [], 'North'); await f.act('guide-answer', ['entry']); await f.act('guide-continue'); await f.act('guide-continue');
    assert.equal(f.draft.organization!.groups[0]!.required, true); assert.equal(f.draft.organization!.groups[0]!.multiple, false); assert.equal(f.draft.organization!.entries[0]!.roleId, 'entry');
    await f.act('guide-answer', ['atlas', 'briefings']); assert.match(f.response.content, /atlas, briefings/);
    await f.act('guide-answer', ['commands']); await f.act('guide-continue');
    await f.act('guide-custom-name'); await f.act('guide-answer', [], 'Community'); await f.act('guide-continue');
    while (f.draft.editor!.conversation!.step === 'resources') await f.act('guide-continue');
    await f.act('guide-answer', [], '[LOCAL]'); assert.match(f.response.content, /Atlas is enabled/); await f.act('guide-continue');
    assert.equal(f.draft.stage, 'preview'); assert.equal(f.provisions, 0); assert.equal(f.applied, 0); assert.ok(f.response.files[0].attachment.toString().includes('First -> Second'));
    assert.equal(f.draft.organization!.additionalResources.find(r => r.key === 'CORE_CATEGORY')!.name, 'Community');
    await f.act('confirm'); assert.equal(f.provisions, 1); assert.equal(f.applied, 1); assert.equal(f.draft, undefined);
});
test('UX setup Back retains saved values, optional Skip advances, and Cancel only deletes the draft', async () => {
    const f = wizardFixture(); await f.start(); await f.act('guide-answer', [], 'Example'); await f.act('guide-back'); assert.equal(f.draft.editor!.conversation!.step, 'identity'); assert.equal(f.draft.config.organizationName, 'Example');
    await f.act('guide-sections'); await f.act('guide-answer', ['duties']); await f.act('guide-skip'); assert.equal(f.draft.editor!.conversation!.step, 'groups'); await f.act('cancel'); assert.equal(f.draft, undefined); assert.equal(f.applied, 0);
});
test('UX interrupted setup offers Resume, View Progress and confirmed Start Over across wizard replacement', async () => {
    const f = wizardFixture(); await f.start(); await f.act('guide-answer', [], 'Retained'); const revision = f.draft.revision; f.restart(); await f.start(); assert.match(f.response.content, /unfinished setup/); assert.equal(f.draft.revision, revision);
    await f.act('progress'); assert.match(f.response.content, /Retained/); await f.act('resume'); assert.match(f.response.content, /namespace/);
    await f.act('restart'); assert.equal(f.draft.config.organizationName, 'Retained'); await f.act('restart-confirm'); assert.equal(f.draft.config.organizationName, undefined); assert.equal(f.applied, 0);
});
test('UX stale setup has a fresh Resume path while owner, administrator and expiry guards remain enforced', async () => {
    const f = wizardFixture(); await f.start(); await f.act('guide-answer', [], 'Example');
    await f.wizard.handle(f.interaction('guide-answer', [], 'Stale', 0)); assert.match(f.response.content, /changed/); assert.equal(f.draft.config.organizationName, 'Example');
    const other = f.interaction('cancel'); other.user.id = 'other'; await assert.rejects(f.wizard.handle(other), /owner/);
    const denied = f.interaction('cancel'); denied.memberPermissions.has = () => false; await assert.rejects(f.wizard.handle(denied), /Administrator/);
    f.draft.expiresAt = '2000-01-01'; await assert.rejects(f.act('cancel'), /expired/);
});
test('UX configured-server edit uses section questions and repair previews without provisioning', async () => {
    const f = wizardFixture(true); await f.start(); assert.match(f.response.content, /Edit Server Configuration/); await f.act('guide-answer', ['identity']); await f.act('guide-answer', [], 'Renamed'); assert.equal(f.applied, 0);
    await f.act('repair'); assert.match(f.response.content, /healthy.*missing.*permission mismatches/); assert.equal(f.provisions, 0); await f.act('repair-confirm'); assert.equal(f.provisions, 1); assert.equal(f.applied, 0);
});
test('UX large setup selectors and all navigation payloads stay within Discord limits', () => {
    const f = wizardFixture(); const d: StoredSetupDraft = { guildId: 'g', ownerId: 'owner', config: fixtureConfig(), organization: emptyOrganization(), stage: 'identity', revision: 12, updatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() };
    beginConversation(d, 'ranks'); d.organization!.ranks = Array.from({ length: 80 }, (_, n) => ({ id: `r${n}`, guildId: 'g', name: `Rank ${n}`, tier: 'BASELINE' }));
    assert.equal(conversationView(d).components[0].components[0].options.length, 25); d.editor!.page = 2; assert.equal(conversationView(d).components[0].components[0].options[0].value, 'r50');
    for (const step of ['identity', 'namespace', 'permissions', 'ranks', 'rank-name', 'rank-role', 'rank-tier', 'rank-branch', 'rank-more', 'branches', 'branch-name', 'edge-from', 'edge-to', 'edge-more', 'duties', 'duty-role', 'duty-name', 'duty-more', 'groups', 'group-name', 'group-required', 'group-multiple', 'group-sync', 'entry-name', 'entry-role', 'entry-more', 'group-more', 'modules', 'resources', 'resource-name', 'integration', 'atlas', 'sections']) { d.editor!.conversation!.step = step; assertPayload(conversationView(d)); }
    assert.equal(configuredResources(d.config.modules!, [{ key: 'CORE_CATEGORY', kind: 'CATEGORY', name: 'Custom' }]).filter(r => r.key === 'CORE_CATEGORY').length, 1);
    d.organization!.permissions=Array.from({length:200},(_,n)=>({guildId:'g',roleId:String(n).padStart(20,'0'),tier:'BASELINE'}));d.editor!.section='preview';assertPayload(f.wizard.render(d));
    assert.equal(f.provisions, 0);
});
test('UX conversation payload round-trips through the real setup RPC and rejects competing revisions', async () => {
    const { db, client } = await testDatabase(); const store = new SupabaseRepositories(client);
    try {
        const d: StoredSetupDraft = { guildId: 'g', ownerId: 'owner', config: fixtureConfig(), organization: emptyOrganization(), stage: 'identity', revision: 0, updatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() }; beginConversation(d, 'permissions');
        d.editor!.conversation!.index = 2; d.editor!.conversation!.history.push({ step: 'namespace', index: 0 }); await store.saveSetupDraft(d);
        const loaded: any = (await db.query('select payload from setup_drafts where guild_id=$1', ['g'])).rows[0]; assert.deepEqual(loaded.payload.editor, d.editor);
        await assert.rejects(store.saveSetupDraft(d), /concurrently/); d.revision++; d.editor!.conversation!.index = 3; await store.saveSetupDraft(d);
        assert.equal((await db.query<any>('select payload from setup_drafts')).rows[0].payload.editor.conversation.index, 3);
    } finally { await db.close(); }
});

function panelFixture(tier = 'BASELINE', admin = false) {
    const config = { ...fixtureConfig(), modules: { atlas: true, supply: true, briefings: true, patrols: true } };
    const roles = new Map([['role', { id: 'role', name: 'Member' }]]);
    const member = { id: 'actor', roles: { cache: roles }, permissions: { has: () => admin } };
    const store: any = { async load() { return config; }, async list() { return []; }, async permissionRoles() { return [{ guildId: 'g', roleId: 'role', tier }]; }, async trailmark() { return []; }, async optional() { return []; }, async workflow() { return []; } };
    let response: any;
    const interaction = (customId?: string, values?: string[], text?: string): any => ({ id: crypto.randomUUID(), guildId: 'g', channelId: 'commands', user: { id: 'actor' }, client: { users: { async fetch(id: string) { return { id, username: 'Selected member' }; } } }, guild: { members: { async fetch() { return member; } }, roles: { async fetch(id?: string) { return id ? roles.get(id) : roles; } }, channels: { async fetch(id: string) { return { id, type: 0 }; } } }, memberPermissions: member.permissions, customId, values, deferred: false, isButton: () => !!customId && !values && text == null, isAnySelectMenu: () => !!values, isStringSelectMenu: () => !!values, isModalSubmit: () => text != null, isChatInputCommand: () => !customId, fields: { getTextInputValue: () => text }, async deferReply() { this.deferred = true; }, async reply(p: any) { assertPayload(p); response = p; }, async update(p: any) { assertPayload(p); response = p; }, async editReply(p: any) { assertPayload(p); response = p; }, async showModal(p: any) { response = p; } });
    return { store, config, roles, interaction, get response() { return response; } };
}
for (const system of ['trailmark', 'advancement', 'application', 'mentorship', 'assignment', 'intel', 'contact', 'funds', 'strongbox', 'vote', 'supply', 'briefing', 'patrol', 'reference', 'atlas', 'example', 'recruit', 'duty', 'roster', 'alliance']) {
    test(`UX ${system} dashboard dispatches visible production command contracts and paginates`, async () => {
        const f = panelFixture('LEVEL_3', true); let dispatched = 0;
        const actions = await availableActions(f.interaction(), f.store, f.config, system); assert.ok(actions.length);
        for (let p = 0; p < Math.ceil(actions.length / 10); p++) {
            await openPanel(f.interaction(), f.store, system, p + (system === 'example' ? 1 : 0)); assertPayload(f.response);
            const ids: string[] = f.response.components.flatMap((r: any) => r.components).filter((c: any) => c.custom_id.includes(`:action:${system}:`)).map((c: any) => c.custom_id);
            for (const id of ids) {
                const dispatch = async (i:any) => { assert.equal(i.isChatInputCommand(), true); assert.equal(i.customId, undefined); assert.equal(i.commandName, system); assert.ok(actions.some(a => a.name === i.options.getSubcommand())); dispatched++; };
                await handlePanel(f.interaction(id), f.store, dispatch, async () => {});
                const action=actions.find(a=>id.endsWith(`:${a.name}`));
                if(action?.options?.length){
                    for(const option of action.options){
                        const controls=f.response.components.flatMap((r:any)=>r.components),skip=controls.find((c:any)=>c.label==='Skip');
                        if(skip){await handlePanel(f.interaction(skip.custom_id),f.store,dispatch,async()=>{});continue;}
                        const control=controls[0];
                        if(control.type===2){await handlePanel(f.interaction(control.custom_id),f.store,dispatch,async()=>{});await handlePanel(f.interaction(f.response.custom_id,undefined,[4,10].includes(option.type)?String(option.min_value??1):'Example'),f.store,dispatch,async()=>{});}
                        else {const i=f.interaction(control.custom_id,[control.options?.[0]?.value??(control.type===6?'role':'selected')]);if(control.type===8)i.guild.channels.fetch=async(id:string)=>({id,type:option.channel_types?.[0]??0});await handlePanel(i,f.store,dispatch,async()=>{});}
                    }
                    await handlePanel(f.interaction(f.response.components[0].components[0].custom_id),f.store,dispatch,async()=>{});
                }
            }
        }
        assert.ok(dispatched > 0);
    });
}
test('UX normal-user panels hide staff actions and disabled modules; missing mappings fail closed', async () => {
    const f = panelFixture(); const names = async (s: string) => (await availableActions(f.interaction(), f.store, f.config, s)).map(a => a.name);
    assert.deepEqual(await names('application'), ['apply', 'withdraw', 'list']); assert.ok(!(await names('funds')).includes('deposit')); assert.deepEqual(await names('contact'), []); assert.deepEqual(await names('example'), []);
    f.config.modules.atlas = false; assert.deepEqual(await names('atlas'), []); f.roles.clear(); assert.deepEqual(await names('trailmark'), ['leave']);
});
test('UX help includes only currently available features and offers administrators server setup', async () => {
    const f = panelFixture(); f.config.modules.atlas = false; await openPanel(f.interaction(), f.store, 'help');
    const options = f.response.components[0].components[0].options; assert.ok(options.some((o: any) => o.value === 'trailmark')); assert.ok(!options.some((o: any) => ['atlas', 'contact', 'roster'].includes(o.value)));
    const admin = panelFixture('BASELINE', true); await openPanel(admin.interaction(), admin.store, 'help'); assert.ok(admin.response.components.some((r: any) => r.components.some((c: any) => c.label === 'Server Setup')));
});
test('UX hidden actions cannot bypass authorization after role or module changes', async () => {
    const f = panelFixture('LEVEL_3'); let calls = 0; const dispatch = async () => { calls++; };
    f.roles.clear(); await assert.rejects(handlePanel(f.interaction('ux:actor:action:funds:deposit'), f.store, dispatch, async () => {}), /no longer available/);
    f.config.modules.supply = false; await assert.rejects(handlePanel(f.interaction('ux:actor:action:supply:create'), f.store, dispatch, async () => {}), /no longer available/); assert.equal(calls, 0);
});
test('UX command inputs use user selectors and single-value forms, validate values, and dispatch only after Continue', async () => {
    const f = panelFixture('LEVEL_3'); let received: any; const dispatch = async (i: any) => { received = i; };
    const send = async (id: string, values?: string[], text?: string) => handlePanel(f.interaction(id, values, text), f.store, dispatch, async () => {});
    await send('ux:actor:action:supply:redistribute'); const memberInput = f.response.components[0].components[0]; assert.equal(memberInput.type, 5); await send(memberInput.custom_id, ['recipient']);
    const textButton = f.response.components[0].components[0].custom_id; await send(textButton); assert.equal(f.response.components.length, 1); const modal = f.response.custom_id;
    await assert.rejects(send(modal, undefined, '-10'), /allowed range/); await send(modal, undefined, '10'); assert.equal(received, undefined);
    await send(f.response.components[0].components[0].custom_id); assert.equal((received as any).options.getUser('member').id, 'recipient'); assert.equal((received as any).options.getNumber('quantity'), 10); assert.equal((received as any).isModalSubmit(), false);
    await send(modal, undefined, '10'); assert.match(f.response.content, /outdated or expired/);
});
test('UX confirmations are owner/guild-bound, cancellable, single-use and re-run production authorization', async () => {
    const f = panelFixture('LEVEL_2'); const original = commandInteraction(f.interaction(), 'funds', 'undo-last', {}); assert.equal(needsConfirmation(original), true); await askConfirmation(original);
    const id = f.response.components[0].components[0].custom_id; let count = 0;
    const foreign = f.interaction(id); foreign.guildId = 'other'; await assert.rejects(handleConfirmation(foreign, async () => { count++; }), /another member/);
    await handleConfirmation(f.interaction(id), async next => { assert.equal(needsConfirmation(next), false); assert.equal(next.options.getSubcommand(), 'undo-last'); count++; });
    await handleConfirmation(f.interaction(id), async () => { count++; }); assert.equal(count, 1); assert.match(f.response.content, /already used/);
    await askConfirmation(original); await handleConfirmation(f.interaction(f.response.components[0].components[1].custom_id), async () => { count++; }); assert.equal(count, 1);
    await askConfirmation(original); f.roles.clear(); await assert.rejects(handleConfirmation(f.interaction(f.response.components[0].components[0].custom_id), next => route(next, {} as any, { ...f.store, async history() { return []; } }, true)), /permission/i);
});
test('UX destructive record selections preserve context through confirmation and reject stale components', async () => {
    const f = panelFixture('LEVEL_3'); const selected = f.interaction('field:actor:trail:deactivate:', ['trail/revision']); assert.ok(needsConfirmation(selected)); await askConfirmation(selected);
    await handleConfirmation(f.interaction(f.response.components[0].components[0].custom_id), async next => { assert.equal(next.customId, selected.customId); assert.deepEqual(next.values, ['trail/revision']); assert.equal(next.isStringSelectMenu(), true); });
    await handlePanel(f.interaction('uxform:missing:0:run'), f.store, async () => { throw new Error('must not dispatch'); }, async () => {}); assert.match(f.response.content, /expired/);
});
test('UX command registration retains every compatibility operation, adds help/panels and respects command limits', () => {
    const commands = commandDefinitions('example') as any[]; assert.equal(commands.length, 23); assert.ok(commands.some(c => c.name === 'help' && !c.options?.length));
    for (const c of commands) { assert.ok((c.options?.length ?? 0) <= 25); if (!['help', 'server', 'ping'].includes(c.name)) assert.ok(c.options.some((o: any) => o.name === 'panel')); }
    assert.ok(commands.find(c => c.name === 'funds').options.some((o: any) => o.name === 'deposit' && o.options.length === 2));
    assert.ok(commands.find(c => c.name === 'example').options.some((o: any) => o.name === 'rank'));
});
test('UX friendly errors hide database internals and explain stale-panel recovery', () => {
    assert.match(friendlyError(new Error('VERSION_CONFLICT')), /outdated/); assert.doesNotMatch(friendlyError(new Error('duplicate key violates constraint internal_secret')), /internal_secret/);
    assert.match(friendlyError(new Error('LEVEL_3 or Discord Administrator permission required')), /permission/); assert.match(friendlyError(new Error('This optional module is disabled')), /disabled/);
    assert.match(friendlyError(new Error('That role no longer exists. Choose another role.')), /Choose another/);
});
test('UX empty pages remain navigable and long human-readable workflow details use text attachments', () => {
    assertPayload(choices('flow:actor:vote:list', [], 2)); assert.equal(choices('flow:actor:vote:list', [], 2).components[0].components[0].label, 'Previous');
    const view = recordView('application', { status: 'PENDING', applicant_id: 'actor', answers: { response: 'Reason '.repeat(600) } }); assertPayload(view); assert.equal(view.files[0].name, 'application-details.txt'); assert.match(view.files[0].attachment.toString(), /Applicant: actor/);
});
test('UX reference search scans bounded batches, continues beyond 250 entries and keeps owner/guild checks', async () => {
    const f = panelFixture(); let reads = 0;
    f.store.optional = async (_g:string,_s:string,_a:string,_u:string,_id:string,data:any) => { reads++; return Array.from({length:25},(_,n)=>({id:`${data.page}-${n}`,key:'key',title:data.page===10&&n===0?'Needle':'Other',body:'Reference'})); };
    await browse(f.interaction(),f.store,'reference','needle');assert.equal(reads,10);assert.match(f.response.content,/No matches/);
    const next=f.response.components.flatMap((r:any)=>r.components).find((c:any)=>c.label==='Continue Search').custom_id;
    const foreign=f.interaction(next);foreign.guildId='other';await assert.rejects(browse(foreign,f.store),/own panel|permission/);
    await browse(f.interaction(next),f.store);assert.equal(reads,11);assert.equal(f.response.components[0].components[0].options[0].label,'Needle');assert.equal(f.response.components[0].components[0].custom_id,'optional:actor:reference:get');
});
test('UX claimed-assignment filter uses current actor and retains the production record viewer', async () => {
    const f=panelFixture();f.store.workflow=async()=>[{id:'mine',title:'Mine',payload:{claimed:['actor']}},{id:'other',title:'Other',payload:{claimed:['someone']}}];
    await browse(f.interaction(),f.store,'assignment');assert.deepEqual(f.response.components[0].components[0].options.map((o:any)=>o.value),['mine']);assert.equal(f.response.components[0].components[0].custom_id,'flow:actor:assignment:list');
});
test('UX normal organization hub offers member workflows without exposing staff records', async () => {
    const f=panelFixture();await openPanel(f.interaction(),f.store,'example');assert.match(f.response.content,/organization hub/);const controls=f.response.components.flatMap((r:any)=>r.components);assert.ok(controls.some((c:any)=>c.label==='Application'));assert.ok(!controls.some((c:any)=>c.label==='Member Administration'));
});
test('UX panel runtime reaches the actual Funds reader and Strongbox submission modal', async () => {
    const f=panelFixture();f.store.history=async()=>[{amount:12}];
    await route(f.interaction('ux:actor:action:funds:balance'),{} as any,f.store);assert.match(f.response.content,/12\.00/);
    await route(f.interaction('ux:actor:action:strongbox:submit'),{} as any,f.store);assert.match(f.response.custom_id,/^flow:actor:strongbox:submit-save:/);assert.equal(f.response.components[0].components[0].custom_id,'body');
});
test('UX module-dependent resource name overrides never provision disabled optional resources', () => {
    const resources=configuredResources(fixtureConfig().modules,[{key:'ATLAS',kind:'CHANNEL',name:'Map'},{key:'DISPATCH_DESK',kind:'CHANNEL',name:'Dispatches'}]);assert.ok(!resources.some(r=>r.key==='ATLAS'||r.key==='DISPATCH_DESK'));
});
test('UX Review then Back returns to the question being reviewed and preserves its answer',async()=>{
    const f=wizardFixture();await f.start();await f.act('guide-answer',[],'Example');await f.act('guide-review');assert.equal(f.draft.stage,'preview');await f.act('guide-back');assert.equal(f.draft.editor!.conversation!.step,'namespace');assert.equal(f.draft.config.organizationName,'Example');
});
test('UX Funds confirmation shows the concrete amount and rejects an undo after the ledger changes',async()=>{
    const f=panelFixture('LEVEL_2');await askConfirmation(commandInteraction(f.interaction(),'funds','set-balance',{amount:125,note:'Stock purchase'}));assert.match(f.response.content,/125/);assert.match(f.response.content,/Stock purchase/);
    let head='first';f.store.recentHistory=async()=>[{id:head}];await askConfirmation(commandInteraction(f.interaction(),'funds','undo-last',{}),f.store);head='new';let writes=0;await assert.rejects(handleConfirmation(f.interaction(f.response.components[0].components[0].custom_id),async()=>{writes++;}),/ledger changed/);assert.equal(writes,0);
});
test('UX repair inspection distinguishes matching permissions from mismatches without writing',async()=>{
    const view=PermissionFlagsBits.ViewChannel,manage=PermissionFlagsBits.ManageChannels;
    const guild:any={roles:{everyone:{id:'everyone'},async fetch(){return new Map([['staff',{}]]);}},members:{async fetchMe(){return {id:'bot'};}}};
    const inspect=new DiscordProvisioner(guild,[{guildId:'g',roleId:'staff',tier:'LEVEL_3'}]);const cache=new Map([['everyone',{allow:{bitfield:0n},deny:{bitfield:view}}],['staff',{allow:{bitfield:view},deny:{bitfield:0n}}],['bot',{allow:{bitfield:view|manage},deny:{bitfield:0n}}]]);
    const spec={key:'HQ_STRONGBOX' as const,name:'Private',kind:'CHANNEL' as const,minimumTier:'LEVEL_3' as const};assert.equal(await inspect.permissionsMatch({permissionOverwrites:{cache}},spec),true);cache.delete('staff');assert.equal(await inspect.permissionsMatch({permissionOverwrites:{cache}},spec),false);
});
test('UX preserves a pre-existing help organization namespace while reserving help for new setups',async()=>{
    const definitions=commandDefinitions('help') as any[];assert.equal(definitions.filter(c=>c.name==='help').length,1);assert.ok(definitions.find(c=>c.name==='help').options.some((s:any)=>s.name==='info'));
    const f=panelFixture('LEVEL_3');f.config.commandNamespace='help';await openPanel(f.interaction(),f.store,'help');assert.match(f.response.content,/organization hub/);
    await handlePanel(f.interaction('ux:actor:help'),f.store,async()=>{},async()=>{});assert.match(f.response.content,/Codex guide/);
    f.store.organization=async()=>{throw new Error('legacy member handler reached');};await assert.rejects(route(commandInteraction(f.interaction(),'help','info',{}),{} as any,f.store),/legacy member handler reached/);
    const wizard=wizardFixture(true);wizard.store.load=async()=>({...fixtureConfig(),commandNamespace:'help'});await wizard.start();await wizard.act('guide-answer',['identity']);await wizard.act('guide-answer',[],'Renamed');await wizard.act('guide-answer',[],'help');assert.equal(wizard.draft.config.commandNamespace,'help');
});
