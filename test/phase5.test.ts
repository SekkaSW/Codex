import test from 'node:test';import assert from 'node:assert/strict';
import { testDatabase,fixtureConfig,fixtureOrganization,rankA,rankB } from './database.js';
import { FieldRepository } from '../src/persistence/field.js';
import { AdvancementService,TrailmarkLifecycle,type AccessSession,type FieldTrailmark } from '../src/field.js';
import type { MemberState } from '../src/administration.js';
import { handleField } from '../src/runtime/handlers/field.js';
import { Collection } from 'discord.js';
import { DiscordTrailmarkAccess } from '../src/runtime/trailmarkAccess.js';

test('advancement ballots persist across repository replacement; approval atomically changes rank, history and decision once',async()=>{
 const {db,client}=await testDatabase();try{
  const store=new FieldRepository(client);await store.saveOrganization(fixtureConfig(),fixtureOrganization(),'admin');
  const member:MemberState={guildId:'g',memberId:'candidate',displayName:'Candidate',rankId:rankA,status:'ACTIVE',version:0,notes:[],entryIds:[],dutyIds:[]};await store.commitMember(undefined,member,'admin','MEMBER_CREATED','test');
  assert.deepEqual((await new AdvancementService(store).eligible('g','candidate')).map(r=>r.id),[rankB]);
  const record=await store.advancement('g','open','admin',undefined,{candidate_id:'candidate',to_rank_id:rankB});
  await assert.rejects(()=>store.advancement('g','vote','candidate',record.id,{approve:true}),/Candidates cannot vote/);
  await store.advancement('g','vote','voter1',record.id,{approve:true});await assert.rejects(()=>store.advancement('g','vote','voter1',record.id,{approve:true}),/duplicate key/);
  const restarted=new FieldRepository(client);await restarted.advancement('g','close','admin',record.id,{revision:0});
  await assert.rejects(()=>restarted.advancement('g','vote','voter2',record.id,{approve:true}),/closed/);
  const roles=new Set(['rank-a','unrelated']);const adapter={roles,async add(id:string){roles.add(id);},async remove(id:string){roles.delete(id);}};
  await new AdvancementService(restarted).approve('g',record.id,'admin',adapter);await new AdvancementService(restarted).approve('g',record.id,'admin',adapter);
  assert.equal((await store.member('g','candidate'))?.rankId,rankB);assert.equal((await store.advancement('g','get','admin',record.id)).status,'APPROVED');assert.deepEqual([...roles],['unrelated','rank-b']);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from member_rank_history')).rows[0]!.n,2);
  await assert.rejects(()=>store.advancement('other','get','admin',record.id),/not found/);
 }finally{await db.close();}
});
test('advancement deny, insufficient ballots, candidate drift and immutable snapshots fail safely',async()=>{
 const {db,client}=await testDatabase();try{
  const s=new FieldRepository(client);await s.saveOrganization(fixtureConfig(),fixtureOrganization(),'admin');const m:MemberState={guildId:'g',memberId:'c',displayName:'C',rankId:rankA,status:'ACTIVE',version:0,notes:[],entryIds:[],dutyIds:[]};await s.commitMember(undefined,m,'admin','MEMBER_CREATED','test');
  const c=await s.advancement('g','open','admin',undefined,{candidate_id:'c',to_rank_id:rankB});await s.advancement('g','close','admin',c.id);const adapter={roles:new Set(['rank-a']),async add(){throw new Error('must not mutate');},async remove(){throw new Error('must not mutate');}};
  await assert.rejects(()=>new AdvancementService(s).approve('g',c.id,'admin',adapter),/minimum approvals/);
  await s.advancement('g','deny','admin',c.id);assert.equal((await s.advancement('g','get','admin',c.id)).status,'DENIED');
  const next=await s.advancement('g','open','admin',undefined,{candidate_id:'c',to_rank_id:rankB});await s.advancement('g','vote','v',next.id,{approve:true});await s.advancement('g','close','admin',next.id);
  const config=fixtureOrganization();config.ranks[1]!.roleId='new-role';await s.saveOrganization(fixtureConfig(),config,'admin');
  await assert.rejects(()=>new AdvancementService(s).approve('g',next.id,'admin',adapter),/mapping changed/);assert.equal((await s.advancement('g','get','admin',next.id)).snapshot.organization.ranks[1]!.roleId,'rank-b');
 }finally{await db.close();}
});
test('Trailmarks persist HQ, report confidentiality and recover pending grants, leave, expiry and deactivation across guilds',async()=>{
 const {db,client}=await testDatabase();try{
  const store=new FieldRepository(client);await store.saveOrganization(fixtureConfig(),fixtureOrganization(),'admin');await store.saveOrganization(fixtureConfig('other'),{...fixtureOrganization(),ranks:[],branches:[],edges:[],permissions:[]},'admin');
  const a=await store.trailmark('g','create','admin',undefined,{name:'Camp',description:'A camp'}),b=await store.trailmark('g','create','admin',undefined,{name:'Base',description:'HQ'});
  await store.trailmark('g','hq','admin',b.id);await store.trailmark('g','atlas','admin',a.id,{atlas_id:'location',coordinates:{x:1,y:2}});assert.equal((await store.trailmark('g','get','admin',a.id)).atlas_id,'location');
  const report=await store.trailmark<{id:string;status:string}>('g','report','member',a.id,{id:crypto.randomUUID(),body:'[confidential] local report'});assert.equal(report.status,'CAPTURED');
  const hq=await store.trailmark<{id:string;status:string}>('g','report','member',b.id,{id:crypto.randomUUID(),body:'Normal report'});assert.equal(hq.status,'AT_HQ');
  assert.equal((await db.query<{confidential:boolean}>('select confidential from intel_reports where id=$1',[report.id])).rows[0]!.confidential,true);
  const granted=new Set<string>();let fail=true;
  const adapter={async ensure(t:FieldTrailmark){return t;},async eligible(){return true;},async grant(t:FieldTrailmark,m:string){if(fail)throw new Error('Discord unavailable');granted.add(`${t.id}:${m}`);},async revoke(t:FieldTrailmark,m:string){granted.delete(`${t.id}:${m}`);}};
  const lifecycle=new TrailmarkLifecycle(store,adapter);await assert.rejects(()=>lifecycle.access('g',a.id,'member'),/saved but Discord/);assert.equal((await store.trailmark<AccessSession[]>('g','sessions','member'))[0]!.state,'PENDING');
  fail=false;await new TrailmarkLifecycle(new FieldRepository(client),adapter).reconcile('g');assert.equal(granted.has(`${a.id}:member`),true);
  await lifecycle.access('g',b.id,'member');assert.equal(granted.has(`${a.id}:member`),false);assert.equal(granted.has(`${b.id}:member`),true);
  await lifecycle.leave('g','member');assert.equal(granted.size,0);
  await lifecycle.access('g',a.id,'member');await db.query("update trailmark_sessions set expires_at=now()-interval '1 minute' where guild_id='g' and active");await lifecycle.reconcile('other');assert.equal(granted.size,1);await lifecycle.reconcile('g');assert.equal(granted.size,0);
  await lifecycle.access('g',a.id,'member');await store.trailmark('g','deactivate','admin',a.id);await lifecycle.reconcile('g');assert.equal(granted.size,0);await assert.rejects(()=>lifecycle.access('g',a.id,'member'),/not eligible/);
 }finally{await db.close();}
});
test('Trailmark access selector uses real orchestration and channel repair preserves renamed resources',async()=>{
 const {db,client}=await testDatabase();try{
  const repo=new FieldRepository(client);await repo.saveOrganization(fixtureConfig(),fixtureOrganization(),'admin');const mark=await repo.trailmark('g','create','admin',undefined,{name:'Camp'});
  const channels=new Collection<string,any>();let sequence=0;
  const guild:any={id:'g',roles:{async fetch(){return new Map([['voter',{}],['admin',{}]]);}},members:{async fetch(){return {roles:{cache:new Map([['voter',{}]])},permissions:{has:()=>false}};},async fetchMe(){return {id:'bot'};}},channels:{async fetch(id?:string){return id?channels.get(id)??null:channels;},async create(data:any){const cache=new Map<string,any>();const channel:any={id:`c${++sequence}`,name:data.name,type:0,topic:data.topic,permissionOverwrites:{cache,async edit(id:string){cache.set(id,{id,type:1});},async delete(id:string){cache.delete(id);}}};channels.set(channel.id,channel);return channel;}}};
  const store:any=Object.assign(repo,{async permissionRoles(){return fixtureOrganization().permissions;},async list(){return [];}});
  const adapter=new DiscordTrailmarkAccess(guild,store);const created=await adapter.ensure(mark);channels.get(created.channel_id)!.name='custom-name';await adapter.ensure(created);assert.equal(sequence,1);assert.equal(channels.get(created.channel_id)!.name,'custom-name');
  let response:any;const i:any={guildId:'g',guild,user:{id:'member'},customId:`field:member:trail:panel:`,values:[`${mark.id}/0`],isModalSubmit:()=>false,async deferUpdate(){},async editReply(value:any){response=value;}};
  await handleField(i,store);assert.match(response.content,/Access granted/);assert.equal(channels.get(created.channel_id)!.permissionOverwrites.cache.has('member'),true);
  channels.delete(created.channel_id);const repaired=await adapter.ensure(created);assert.notEqual(repaired.channel_id,created.channel_id);assert.equal(sequence,2);
 }finally{await db.close();}
});
