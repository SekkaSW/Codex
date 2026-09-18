import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { AdministrationService, PersistenceUncertainError, emptyOrganization, rosterCsv, validateOrganization, type AdministrationStore, type MemberState } from '../src/administration.js';
import { SetupWizard } from '../src/runtime/setupWizard.js';
import { commandDefinitions } from '../src/runtime/commands.js';
import type { StoredSetupDraft } from '../src/setup.js';
import { handleDuty } from '../src/runtime/handlers/duty.js';
import { handleFunds } from '../src/runtime/handlers/funds.js';
import { handleMembers } from '../src/runtime/handlers/members.js';
import { DiscordProvisioner } from '../src/runtime/discordProvisioner.js';
import { AdministrationRepository } from '../src/persistence/administration.js';
import type { SupabaseClientLike } from '../src/persistence/supabase.js';
import type { LedgerEntry } from '../src/services.js';
const config = { guildId: 'g', organizationName: 'Example', commandNamespace: 'example', confidentialityMarker: '[PRIVATE]', modules: { briefings: false, patrols: false, supply: false, atlas: false } };
const id1 = '00000000-0000-4000-8000-000000000001', id2 = '00000000-0000-4000-8000-000000000002', branch = '00000000-0000-4000-8000-000000000003', group = '00000000-0000-4000-8000-000000000004', entry = '00000000-0000-4000-8000-000000000005';
function organization() { const c = emptyOrganization(); c.ranks = [{ id: id1, guildId: 'g', name: 'First', roleId: 'rank1', tier: 'BASELINE' }, { id: id2, guildId: 'g', name: 'Second', roleId: 'rank2', tier: 'BASELINE' }]; c.branches = [{ id: branch, name: 'Branch' }]; c.edges = [{ guildId: 'g', branchId: branch, fromRankId: id1, toRankId: id2 }]; c.duties = [{ guildId: 'g', roleId: 'duty', displayName: 'Appointment' }]; c.groups = [{ id: group, guildId: 'g', name: 'Region', multiple: false, required: true }]; c.entries = [{ id: entry, groupId: group, name: 'North', roleId: 'north' }]; return c; }
const member = (): MemberState => ({ guildId: 'g', memberId: 'm', displayName: 'Member', rankId: id1, status: 'ACTIVE', version: 0, notes: [], dutyIds: ['duty'], entryIds: [entry] });

test('Funds production routing still writes the existing persistent ledger', async () => {
    const f=runtimeFixture(), rows:LedgerEntry[]=[];
    const i:any=f.interaction('deposit',{note:'Supplies'});i.options.getNumber=()=>25;
    await handleFunds(i,{permissionRoles:f.store.permissionRoles,async history(){return rows;},async append(row){rows.push(row);}});
    assert.equal(rows.length,1);assert.equal(rows[0]!.amount,25);assert.equal(rows[0]!.note,'Supplies');assert.match(f.response.content,/Deposited/);
});

test('restricted resources are created private and repair retains their name and ID',async()=>{
    let created:any,overwrites:any;const channel={id:'stored',name:'renamed-by-admin',permissionOverwrites:{async set(value:any){overwrites=value;}}};
    const guild:any={roles:{everyone:{id:'everyone'},async fetch(){return new Map([['senior',{}]]);}},members:{async fetchMe(){return {id:'bot'};}},channels:{async create(value:any){created=value;return channel;},async fetch(){return channel;}}};
    const p=new DiscordProvisioner(guild,[{guildId:'g',roleId:'senior',tier:'LEVEL_3'},{guildId:'g',roleId:'deleted',tier:'LEVEL_4'}]);
    const spec={key:'HQ_STRONGBOX' as const,kind:'CHANNEL' as const,name:'hq-strongbox',minimumTier:'LEVEL_3' as const};
    assert.equal(await p.create(spec),'stored');assert.ok(created.permissionOverwrites.some((r:any)=>r.id==='everyone'&&r.deny.length));assert.equal(created.permissionOverwrites.some((r:any)=>r.id==='deleted'),false);
    await p.restorePermissions({guildId:'g',key:'HQ_STRONGBOX',discordId:'stored',kind:'CHANNEL'},spec);assert.equal(channel.name,'renamed-by-admin');assert.deepEqual(overwrites,created.permissionOverwrites);
});
test('promotion preserves unrelated, duty and assignment roles; persistence failure rolls back', async () => {
    const c = organization(), before = member(), roles = new Set(['rank1', 'duty', 'north', 'unrelated']);
    let saved: MemberState | undefined;
    let fail = false;
    const service = new AdministrationService({ async commitMember(_before: MemberState | undefined, after: MemberState) { if (fail)
            throw new Error('database failed'); saved = after; } } as unknown as AdministrationStore);
    const adapter = { roles, async add(id: string) { roles.add(id); }, async remove(id: string) { roles.delete(id); } };
    const next = service.promote(before, c);
    await service.change(before, next, c, 'actor', 'MEMBER_PROMOTED', 'Test', adapter);
    assert.deepEqual([...roles].sort(), ['duty', 'north', 'rank2', 'unrelated']);
    assert.equal(saved?.rankId, id2);
    roles.delete('rank2');
    roles.add('rank1');
    fail = true;
    await assert.rejects(() => service.change(before, next, c, 'actor', 'MEMBER_PROMOTED', 'Test', adapter), /database failed/);
    assert.deepEqual([...roles].sort(), ['duty', 'north', 'rank1', 'unrelated']);
});
test('Discord failure does not commit member state and compensates completed mutations', async () => {
    let commits = 0;
    const roles = new Set(['rank1']);
    const service = new AdministrationService({ async commitMember() { commits++; } } as unknown as AdministrationStore);
    const c = organization(), before = member(), after = service.promote(before, c);
    await assert.rejects(() => service.change(before, after, c, 'a', 'MEMBER_PROMOTED', 'test', { roles, async add(id) { if (id === 'duty')
            throw new Error('hierarchy'); roles.add(id); }, async remove(id) { roles.delete(id); } }), /hierarchy/);
    assert.equal(commits, 0);
    assert.deepEqual([...roles], ['rank1']);
});
test('ambiguous persistence responses retain roles for reconciliation rather than claiming rollback', async () => {
    const c = organization(), before = member(), roles = new Set(['rank1', 'duty', 'north']);
    const service = new AdministrationService({ async commitMember() { throw new PersistenceUncertainError('Run member synchronization'); } } as unknown as AdministrationStore);
    await assert.rejects(() => service.change(before, service.promote(before, c), c, 'a', 'MEMBER_PROMOTED', 'test', { roles, async add(id) { roles.add(id); }, async remove(id) { roles.delete(id); } }), /synchronization/);
    assert.equal(roles.has('rank2'), true);
    assert.equal(roles.has('rank1'), false);
});
test('required assignments and explicit branching reject invalid mutations', async () => {
    const c = organization(), m = member(), service = new AdministrationService({ async commitMember() { } } as unknown as AdministrationStore);
    await assert.rejects(() => service.change(m, service.assignment(m, c, entry, true), c, 'a', 'ASSIGNMENT_REMOVED', 'test'), /requires a membership/);
    assert.throws(() => service.promote(m, c, 'duty'), /not connected/);
    c.ranks.push({ id: 'third', guildId: 'g', name: 'Third', tier: 'BASELINE' });
    c.edges.push({ guildId: 'g', branchId: branch, fromRankId: id1, toRankId: 'third' });
    assert.throws(() => service.promote(m, c), /Select one/);
    assert.equal(service.promote(m, c, 'third').rankId, 'third');
    c.edges.push({ guildId: 'g', branchId: branch, fromRankId: 'third', toRankId: id1 });
    assert.throws(() => validateOrganization('g', c), /cycle/);
});
test('roster CSV uses configured dimensions and neutralizes spreadsheet formulas', () => {
    const m = member();
    m.displayName = '=HYPERLINK("bad")';
    const csv = rosterCsv([m], organization());
    assert.match(csv, /Region/);
    assert.match(csv, /North/);
    assert.match(csv, /"'=HYPERLINK/);
    assert.match(csv, /Appointment/);
});
test('all command definitions serialize with actual Discord builders', () => {
    const commands = commandDefinitions('example') as any[];
    assert.ok(commands.find(c => c.name === 'example').options.some((o: any) => o.name === 'promote'));
    assert.throws(() => commandDefinitions('roster'), /conflicts/);
});
function runtimeFixture() {
    const c = organization();
    let current: MemberState | undefined = member();
    const roles = new Map(['rank1', 'rank2', 'duty', 'north', 'unrelated', 'admin'].map(id => [id, { id, editable: true }]));
    const memberRoles = new Map(['rank1', 'duty', 'north', 'unrelated'].map(id => [id, roles.get(id)]));
    let fail = false, missing = false;
    const actions: string[] = [];
    const target = { id: 'm', displayName: 'Member', user: { bot: false }, joinedAt: new Date('2026-01-01'), roles: { cache: memberRoles, async add(id: string) { memberRoles.set(id, roles.get(id)); }, async remove(id: string) { memberRoles.delete(id); } } };
    const actor = { id: 'actor', permissions: { has: () => false }, roles: { cache: new Map([['admin', roles.get('admin')]]) } };
    const store: any = { async permissionRoles() { return [{ guildId: 'g', roleId: 'admin', tier: 'LEVEL_3' }]; }, async organization() { return c; }, async member() { return current ? structuredClone(current) : undefined; }, async members() { return current ? [structuredClone(current)] : []; }, async commitMember(_before: MemberState | undefined, after: MemberState, _actor: string, action: string) { if (fail)
            throw new Error('write failed'); current = { ...structuredClone(after), version: after.version + 1 }; actions.push(action); } };
    const guild = { roles: { async fetch() { return roles; } }, members: { async fetch(arg: any) { if (arg === 'actor')
                return actor; if (!arg)
                return new Map(missing ? [] : [['m', target]]); if (missing)
                throw Object.assign(new Error('Unknown Member'), { code: 10007 }); return target; } } };
    let response: any;
    const interaction = (sub: string, strings: Record<string, string> = {}, customId?: string) => ({ guildId: 'g', guild, user: { id: 'actor' }, memberPermissions: { has: () => true }, ...(customId ? { customId, values: [id2] } : {}), options: { getSubcommand: () => sub, getUser: () => sub === 'sync-all' || sub === 'export' ? null : { id: 'm' }, getRole: () => ({ id: 'duty' }), getString: (key: string) => strings[key] ?? null }, async deferReply() { }, async deferUpdate() { }, async editReply(value: any) { response = value; } });
    return { c, roles, memberRoles, store, interaction, actions, get response() { return response; }, get current() { return current; }, setMissing() { missing = true; }, setFailure() { fail = true; }, clear() { current = undefined; } };
}
test('duty production handler persists, audits, preserves status and compensates removal failure', async () => {
    const f = runtimeFixture();
    await handleDuty(f.interaction('remove'), f.store);
    assert.deepEqual(f.current?.dutyIds, []);
    assert.equal(f.current?.status, 'ACTIVE');
    assert.equal(f.memberRoles.has('rank1'), true);
    assert.equal(f.actions[0], 'DUTY_REMOVED');
    await handleDuty(f.interaction('assign'), f.store);
    assert.equal(f.memberRoles.has('duty'), true);
    f.setFailure();
    await assert.rejects(() => handleDuty(f.interaction('remove'), f.store), /write failed/);
    assert.equal(f.memberRoles.has('duty'), true);
    assert.deepEqual(f.current?.dutyIds, ['duty']);
});
test('member production selectors promote through explicit edges and reject unauthorized/stale targets', async () => {
    const f = runtimeFixture();
    await handleMembers(f.interaction('promote'), f.store);
    assert.equal(f.response.components[0].components[0].options[0].value, id2);
    await handleMembers(f.interaction('promote', {}, 'member:actor:promote:m:select'), f.store);
    assert.equal(f.current?.rankId, id2);
    assert.equal(f.memberRoles.has('rank1'), false);
    assert.equal(f.memberRoles.has('unrelated'), true);
    await assert.rejects(() => handleMembers(f.interaction('promote', {}, 'member:actor:promote:m:select'), f.store), /no configured next/);
    f.roles.delete('admin');
    await assert.rejects(() => handleMembers(f.interaction('sync-member'), f.store), /LEVEL_3/);
});
test('member synchronization imports mapped roles, reconciles departure and exports persisted roster', async () => {
    const f = runtimeFixture();
    f.clear();
    await handleMembers(f.interaction('sync-member'), f.store);
    assert.equal(f.current?.status, 'INACTIVE');
    assert.equal(f.current?.rankId, id1);
    assert.deepEqual(f.current?.entryIds, [entry]);
    assert.deepEqual(f.current?.dutyIds, ['duty']);
    await handleMembers(f.interaction('status', { value: 'ACTIVE' }), f.store);
    assert.equal(f.current?.status, 'ACTIVE');
    f.setMissing();
    await handleMembers(f.interaction('sync-all'), f.store);
    assert.equal(f.current?.status, 'LEFT');
    await handleMembers(f.interaction('export'), f.store);
    assert.match(f.response.files[0].attachment.toString(), /LEFT/);
    assert.match(f.response.files[0].attachment.toString(), /North/);
});
test('assignment member handler synchronizes only configured roles and enforces cardinality', async () => {
    const f = runtimeFixture();
    f.c.entries.push({ id: id2, groupId: group, name: 'South', roleId: 'south' });
    f.roles.set('south', { id: 'south', editable: true });
    await handleMembers(f.interaction('set-member', {}, 'member:actor:set-member:m:select'), f.store);
    assert.deepEqual(f.current?.entryIds, [id2]);
    assert.equal(f.memberRoles.has('north'), false);
    assert.equal(f.memberRoles.has('south'), true);
    assert.equal(f.memberRoles.has('duty'), true);
    await assert.rejects(() => handleMembers(f.interaction('clear-member', {}, 'member:actor:clear-member:m:select'), f.store), /requires a membership/);
    assert.equal(f.memberRoles.has('south'), true);
});
test('repair does not interpret permission/network errors as deleted channels', async () => {
    const guild: any = { channels: { async fetch() { throw Object.assign(new Error('Forbidden'), { code: 50013 }); } } };
    const provisioner = new DiscordProvisioner(guild, []);
    await assert.rejects(() => provisioner.exists('id'), /Forbidden/);
    guild.channels.fetch = async () => { throw Object.assign(new Error('Unknown Channel'), { code: 10003 }); };
    assert.equal(await provisioner.exists('id'), false);
});
test('intended two-branch organization is configuration data; appointment never becomes a rank', () => {
    const c = emptyOrganization();
    const names = ['Aspirant', 'Acolyte', 'Spinner', 'Graht-Spinner', 'Guardian', 'Warden', 'Sentinel', 'Keeper of the Green'];
    c.ranks = names.map((name, index) => ({ id: name, guildId: 'g', name, roleId: `role-${index}`, tier: index === 0 ? 'BASELINE' : index === 1 || index === 4 ? 'LEVEL_1' : index === 3 || index === 7 ? 'LEVEL_4' : 'LEVEL_2' }));
    c.branches = [{ id: 'weaver', name: 'Weaver' }, { id: 'shear', name: 'Shear' }];
    c.edges = [['weaver', 'Aspirant', 'Acolyte'], ['weaver', 'Acolyte', 'Spinner'], ['weaver', 'Spinner', 'Graht-Spinner'], ['shear', 'Aspirant', 'Guardian'], ['shear', 'Guardian', 'Warden'], ['shear', 'Guardian', 'Sentinel'], ['shear', 'Warden', 'Keeper of the Green'], ['shear', 'Sentinel', 'Keeper of the Green']].map(([branchId, fromRankId, toRankId]) => ({ guildId: 'g', branchId: branchId!, fromRankId: fromRankId!, toRankId: toRankId! }));
    c.permissions = [{ guildId: 'g', roleId: 'appointed-aide', tier: 'LEVEL_3' }];
    c.groups = [{ id: 'holds', guildId: 'g', name: 'Holds', multiple: false, required: false }, { id: 'temples', guildId: 'g', name: 'Temples', multiple: true, required: false }];
    assert.doesNotThrow(() => validateOrganization('g', c));
    const service = new AdministrationService({} as AdministrationStore);
    const m = { ...member(), rankId: 'Guardian' };
    assert.throws(() => service.promote(m, c), /Select one/);
    assert.equal(service.promote(m, c, 'Sentinel').rankId, 'Sentinel');
    assert.throws(() => service.promote(m, c, 'appointed-aide'), /not connected/);
});
test('wizard reloads durable drafts; owner, expiry and stale-panel checks apply to components', async () => {
    let saved: StoredSetupDraft | undefined;
    const store: any = { async load() { return undefined; }, async organization() { return emptyOrganization(); }, async loadSetupDraft() { return saved ? structuredClone(saved) : undefined; }, async saveSetupDraft(d: StoredSetupDraft) { saved = structuredClone(d); }, async deleteSetupDraft() { saved = undefined; } };
    const wizard = new SetupWizard(store, async () => 'done');
    await wizard.start('g', 'owner');
    const interaction = (actor: string, revision: number, action: string) => ({ guildId: 'g', user: { id: actor }, memberPermissions: { has: () => true }, customId: `setup:${revision}:${action}`, values: ['permissions'], async update() { }, async deferUpdate() { }, async editReply() { }, isModalSubmit: () => false });
    await assert.rejects(() => wizard.handle(interaction('other', 0, 'section')), /owner/);
    await wizard.handle(interaction('owner', 0, 'section'));
    assert.equal(saved?.editor?.section, 'permissions');
    await assert.rejects(() => wizard.handle(interaction('owner', 0, 'section')), /stale/);
    const replacement = new SetupWizard(store, async () => 'done');
    const panel = await replacement.start('g', 'owner');
    assert.match(panel.content, /permissions/);
    saved!.expiresAt = '2000-01-01';
    await assert.rejects(() => replacement.handle(interaction('owner', 1, 'cancel')), /expired/);
    await replacement.start('g', 'owner');
    await replacement.handle(interaction('owner', 0, 'cancel'));
    assert.equal(saved, undefined);
});
test('rich setup persists all configuration areas without JSON and provisions only after preview', async () => {
    let draft: StoredSetupDraft | undefined;
    let saved: any;
    let provisions = 0;
    const store: any = { async load() { return saved?.config; }, async organization() { return saved?.organization ?? emptyOrganization(); }, async loadSetupDraft() { return structuredClone(draft); }, async saveSetupDraft(d: StoredSetupDraft) { draft = structuredClone(d); }, async deleteSetupDraft() { draft = undefined; }, async saveOrganization(config: any, organization: any, actor: string) { saved = { config, organization, actor }; } };
    const wizard = new SetupWizard(store, async () => { provisions++; return 'done'; });
    await wizard.start('g', 'owner');
    const guild = { id: 'g', roles: { async fetch(id?: string) { return id ? { id, name: 'Duty' } : new Map(['rank1', 'rank2', 'duty', 'north', 'admin'].map(id => [id, { id, editable: true }])); } }, members: { async fetchMe() { return { id: 'bot' }; } }, channels: { async fetch() { return { type: 0 }; } } };
    const act = async (action: string, values: string[] = [], name = '') => wizard.handle({ guildId: 'g', guild, user: { id: 'owner' }, memberPermissions: { has: () => true }, customId: `setup:${draft!.revision}:${action}`, values, fields: { getTextInputValue: () => name }, isModalSubmit: () => action === 'create' || action === 'save-text', async deferReply() { }, async deferUpdate() { }, async editReply(payload: any) { for (const row of payload.components ?? [])
            assert.ok(row.components.length <= 5); assert.ok((payload.components ?? []).length <= 5); } });
    await act('save-text', [], 'Example');
    await act('section', ['namespace']);
    await act('save-text', [], 'example');
    await act('section', ['permissions']);
    await act('pick', ['LEVEL_3']);
    await act('permission', ['admin']);
    await act('section', ['ranks']);
    await act('create', [], 'First');
    const first = draft!.editor!.selected!;
    await act('role', ['rank1']);
    await act('create', [], 'Second');
    const second = draft!.editor!.selected!;
    await act('role', ['rank2']);
    await act('section', ['branches']);
    await act('create', [], 'Branch');
    const b = draft!.editor!.selected!;
    await act('section', ['progression']);
    await act('pick', [`${b}/${first}`]);
    await act('edge', [second]);
    await act('section', ['duties']);
    await act('duty', ['duty']);
    await act('section', ['groups']);
    await act('create', [], 'Region');
    await act('rules', ['required']);
    await act('section', ['entries']);
    await act('create', [], 'North');
    await act('role', ['north']);
    await act('section', ['modules']);
    await act('modules', ['atlas']);
    await act('section', ['destinations']);
    await act('pick', ['BOT_LOGS']);
    await act('channel', ['logs']);
    await act('section', ['integration']);
    await act('save-text', [], '[PRIVATE]');
    assert.equal(provisions, 0);
    await act('section', ['preview']);
    await act('confirm');
    assert.equal(provisions, 1);
    assert.equal(saved.actor, 'owner');
    assert.equal(saved.organization.edges[0].toRankId, second);
    assert.equal(saved.organization.entries.length, 1);
    assert.equal(saved.organization.resources[0].discordId, 'logs');
    assert.equal(saved.config.modules.atlas, true);
    assert.equal(draft, undefined);
});
test('setup selectors paginate large rank and group configurations within Discord limits', () => {
    const c = organization();
    for (let index = 0; index < 40; index++) {
        c.ranks.push({ id: `r${index}`, guildId: 'g', name: `Rank ${index}`, roleId: `role${index}`, tier: 'BASELINE' });
        c.groups.push({ id: `g${index}`, guildId: 'g', name: `Group ${index}`, multiple: false, required: false });
    }
    const wizard = new SetupWizard({} as any, async () => '');
    for (const section of ['ranks', 'progression', 'entries', 'groups'])
        for (const page of [0, 1]) {
            const d: StoredSetupDraft = { config, stage: 'ranks', guildId: 'g', ownerId: 'a', revision: 0, updatedAt: 'now', expiresAt: 'later', organization: c, editor: { section, page, ...(section === 'progression' ? { selected: `${branch}/${id1}` } : section === 'entries' ? { selected: entry } : {}) } };
            const panel = wizard.render(d);
            assert.ok(panel.components.length <= 5);
            for (const row of panel.components)
                for (const component of row.components)
                    if (component.options)
                        assert.ok(component.options.length <= 25 && component.options.length > 0);
        }
});
test('real PostgreSQL migrations persist configuration, member history, audit, notes and guard concurrent writes', async () => {
    const db = new PGlite();
    try {
        await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
        for (const name of ['001_codex_core.sql', '002_production_features.sql', '003_administration_backbone.sql', '004_phase4_administration.sql'])
            await db.exec(await readFile(new URL(`../../migrations/${name}`, import.meta.url), 'utf8'));
        const c = organization();
        await db.query('select codex_save_organization($1,$2,$3)', [config, c, 'admin']);
        assert.equal((await db.query<{
            allowed: boolean;
        }>("select has_function_privilege('anon','codex_members(text,text)','execute') as allowed")).rows[0]!.allowed, false);
        await db.exec('set role service_role');
        const client: SupabaseClientLike = { from() { throw new Error('Unexpected table query'); }, async rpc<T>(name: string, args: Record<string, unknown> = {}) { try {
                const keys = Object.keys(args);
                const result = await db.query<{
                    value: T;
                }>(`select ${name}(${keys.map((key, index) => `${key} => $${index + 1}`).join(',')}) as value`, Object.values(args));
                return { data: result.rows[0]!.value, error: null };
            }
            catch (error) {
                return { data: null, error: { message: String(error), code: (error as {
                            code?: string;
                        }).code } as any };
            } } };
        const repository = new AdministrationRepository(client);
        assert.equal((await repository.organization('g')).ranks.length, 2);
        const org = (await db.query<{
            value: any;
        }>('select codex_organization($1) as value', ['g'])).rows[0]!.value;
        assert.equal(org.ranks.length, 2);
        assert.ok(org.ownedRoleIds.includes('rank1'));
        const m = member();
        await db.query('select codex_commit_member($1,$2,$3,$4,$5)', [-1, m, 'admin', 'MEMBER_CREATED', 'test']);
        await db.query('select codex_commit_member($1,$2,$3,$4,$5)', [0, { ...m, rankId: id2 }, 'admin', 'MEMBER_PROMOTED', 'test']);
        await assert.rejects(() => db.query('select codex_commit_member($1,$2,$3,$4,$5)', [0, m, 'admin', 'MEMBER_UPDATED', 'stale']), /concurrently/);
        const rows = (await db.query<{
            value: any;
        }>('select codex_members($1) as value', ['g'])).rows[0]!.value;
        assert.equal(rows[0].rankId, id2);
        assert.deepEqual(rows[0].dutyIds, ['duty']);
        assert.equal(rows[0].version, 1);
        assert.equal((await db.query<{
            count: number;
        }>('select count(*)::int as count from member_rank_history')).rows[0]!.count, 2);
        await db.query('select codex_add_note($1,$2,$3,$4,$5)', ['g', 'm', 'author', 'A note', 'ADMIN']);
        assert.equal((await db.query<{
            count: number;
        }>('select count(*)::int as count from audit_events')).rows[0]!.count, 4);
        const invalid = organization();
        invalid.ranks = [];
        await assert.rejects(() => db.query('select codex_save_organization($1,$2,$3)', [config, invalid, 'admin']), /still assigned/);
        await assert.rejects(() => db.query('select codex_commit_member($1,$2,$3,$4,$5)', [1, { ...m, entryIds: [] }, 'admin', 'MEMBER_UPDATED', 'invalid']), /cardinality/);
        assert.equal((await db.query<{
            value: any;
        }>('select codex_members($1) as value', ['other'])).rows[0]!.value.length, 0);
        const before = await repository.member('g', 'm');
        assert.ok(before);
        await repository.commitMember(before, { ...before!, status: 'RETIRED' }, 'admin', 'MEMBER_STATUS_CHANGED', 'retirement');
        assert.equal((await repository.member('g', 'm'))?.status, 'RETIRED');
        assert.equal((await db.query<{
            count: number;
        }>('select count(*)::int as count from codex_member_operations')).rows[0]!.count, 1);
        const draft = { guildId: 'g', ownerId: 'owner', stage: 'permissions', revision: 0, config, organization: c, updatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() };
        await db.query('select codex_save_draft($1)', [draft]);
        await assert.rejects(() => db.query('select codex_save_draft($1)', [{ ...draft, ownerId: 'other', revision: 1 }]), /concurrently/);
        await db.query('select codex_save_draft($1)', [{ ...draft, revision: 1 }]);
        await assert.rejects(() => db.query('select codex_save_draft($1)', [{ ...draft, revision: 1 }]), /concurrently/);
        const cross = organization();
        cross.ranks.forEach(r => r.guildId = 'other');
        cross.groups.forEach(g => g.guildId = 'other');
        cross.duties.forEach(d => d.guildId = 'other');
        cross.edges.forEach(e => e.guildId = 'other');
        await assert.rejects(() => repository.saveOrganization({ ...config, guildId: 'other' }, cross, 'admin'), /another guild/);
    }
    finally {
        await db.close();
    }
});
