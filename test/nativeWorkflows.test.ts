import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase,fixtureConfig,fixtureOrganization } from './database.js';
import { SupabaseRepositories } from '../src/persistence/supabase.js';
import { registrationPlan } from '../src/runtime/registration.js';
import { handleNativeOptional } from '../src/runtime/nativeOptional.js';
const uid=()=>crypto.randomUUID();
test('registration separates global core and guild roots without bulk replacement',()=>{assert.ok(registrationPlan().some(c=>c.name==='supply'));assert.deepEqual(registrationPlan('g','order').map(c=>c.name),['order']);assert.throws(()=>registrationPlan(undefined,'order'),/guild-only/);assert.throws(()=>registrationPlan('g'),/configured/);assert.throws(()=>registrationPlan('g','funds'),/collides|conflicts/);});
test('native workflow SQL enforces form ownership, feature gates, private briefing audiences and per-member read receipts',async()=>{
 const {db,client}=await testDatabase();try{
 const repo=new SupabaseRepositories(client),config=fixtureConfig();await repo.saveOrganization({...config,modules:{...config.modules,briefings:true,patrols:true,trailmarks:true}},fixtureOrganization(),'owner');
 const call=(action:string,actor='actor',id?:string,data:any={})=>repo.native<any>('g',action,actor,id,data);
 const form=uid();await call('form-create','actor',form,{system:'briefing',input:{audience:'individual',recipient:'recipient',kind:'ic'}});await assert.rejects(call('form-get','other',form),/another member/);
 const dispatch=uid();await call('briefing-send','actor',dispatch,{title:'Private dispatch',body:'Synthetic body',audience:'individual',recipient:'recipient',kind:'ic'});
 assert.equal((await call('briefing-inbox','other',undefined,{audiences:['apprentice_plus']})).dispatches.length,0);
 assert.equal((await call('briefing-inbox','recipient',undefined,{audiences:[]})).dispatches.length,1);
 await call('briefing-preference','recipient',undefined,{dm_enabled:false});assert.equal((await call('briefing-inbox','recipient',undefined,{audiences:[]})).dm_enabled,false);
 await call('briefing-read','recipient',undefined,{ids:[dispatch]});assert.equal((await call('briefing-inbox','recipient',undefined,{audiences:[]})).dispatches.length,0);
 await call('briefing-send','actor',dispatch,{title:'Private dispatch',body:'Synthetic body',audience:'individual',recipient:'recipient',kind:'ic'});assert.equal((await db.query<any>('select count(*) n from briefings')).rows[0]!.n,1);
 await assert.rejects(call('briefing-send','actor',uid(),{title:'Bad',body:'Body',audience:'individual',kind:'ic'}),/recipient/);
 assert.deepEqual(await call('patrol-locations'),[]);
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(db.query('select * from native_forms'),/permission denied/);await assert.rejects(db.query("select codex_native('g','briefing-inbox','recipient')"),/permission denied/);await db.exec('reset role');}
 await db.query("update server_modules set enabled=false where guild_id='g' and module_key='briefings'");await assert.rejects(call('briefing-inbox','recipient',undefined,{audiences:[]}),/disabled/);
 }finally{await db.close();}
});
test('native briefing settings handler persists actor preference without a dashboard or generic input form',async()=>{
 const {db,client}=await testDatabase();try{const repo=new SupabaseRepositories(client),config=fixtureConfig();await repo.saveOrganization({...config,modules:{...config.modules,briefings:true}},fixtureOrganization(),'owner');let reply:any;
 const i:any={id:'private-history',guildId:'g',user:{id:'actor'},commandName:'briefing',guild:{members:{fetch:async()=>({roles:{cache:new Map()},permissions:{has:()=>true}})},roles:{fetch:async()=>new Map()}},options:{getSubcommand:()=> 'settings',getBoolean:()=>false},deferReply:async()=>{},editReply:async(v:any)=>{reply=v;},showModal:async()=>{throw Error('No settings modal');}};
 assert.equal(await handleNativeOptional(i,Object.assign(Object.create(repo),{permissionRoles:async()=>[],load:async()=>({...config,modules:{...config.modules,briefings:true}})})),true);assert.match(reply.content,/preference is saved/);assert.equal((await repo.native<any>('g','briefing-inbox','actor',undefined,{audiences:[]})).dm_enabled,false);
 }finally{await db.close();}
});

import {rankA,rankB} from './database.js';
import { handleNativeWorkflow } from '../src/runtime/nativeWorkflows.js';
import { handleNativeIntelligence } from '../src/runtime/nativeIntelligence.js';
test('native promotion, contact, reference, vote, assignment and mentorship persist real records and reject foreign selections',async()=>{
 const {db,client}=await testDatabase();try{
 const repo=new SupabaseRepositories(client);await repo.saveOrganization({...fixtureConfig(),modules:{...fixtureConfig().modules,intelligence:true,trailmarks:true}},fixtureOrganization(),'owner');
 for(const memberId of ['candidate','mentor','mentee'])await repo.commitMember(undefined,{guildId:'g',memberId,displayName:memberId,rankId:rankA,status:'ACTIVE',version:0,notes:[],entryIds:[],dutyIds:[]},'owner','MEMBER_CREATED','Synthetic fixture');
 const call=(a:string,id?:string,data:any={},actor='owner')=>repo.native<any>('g',a,actor,id,data);
 await call('promotion-progress',undefined,{candidate:'candidate',progress:'field_trial'});assert.equal((await call('promotion-progress-list'))[0].progress,'field_trial');
 const operation=uid(),data={candidate_id:'candidate',to_rank_id:rankB,reason:'Synthetic context',mentions:[]},promotion=await call('promotion-open',operation,data);assert.equal((await call('promotion-open',operation,data)).id,promotion.id);await assert.rejects(call('promotion-open',operation,{...data,reason:'Different'}),/conflict/);
 await call('promotion-abstain',promotion.id,{},'voter');assert.deepEqual(await call('promotion-ballots',promotion.id),[{voter:'voter',selection:'Abstain'}]);await assert.rejects(call('promotion-abstain',promotion.id,{},'candidate'),/candidate/);
 const contact=await call('contact-save',uid(),{name:'Synthetic contact',kind:'CONTACT',description:'Profile',detail:{occupation:'Scholar'}});assert.equal(contact.detail.occupation,'Scholar');await call('contact-assessment',contact.id,{assessment:'archive'});assert.equal((await repo.intelligence<any>('g','contact-get','owner',contact.id)).active,true);assert.equal((await db.query<any>("select count(*) n from audit_events where event_type='CONTACT_ASSESSMENT'")).rows[0]!.n,1);
 const ref=uid();await call('reference-save',ref,{title:'Synthetic reference',body:'Exact source text',metadata:{confidentiality:'captain_plus'}});assert.equal((await call('reference-get',ref)).body,'Exact source text');await assert.rejects(call('reference-save',uid(),{title:'Bad',body:'Text',metadata:{supersedes:uid()}}),/not found/);
 const vote=await call('vote-open',uid(),{title:'Question',context:'Context',channel:'channel',options:['Yes','No','Abstain'],tier:'BASELINE'});await repo.workflow('g','vote','cast','voter',vote.id,{selection:'Abstain'});assert.equal((await repo.workflow<any>('g','vote','get','owner',vote.id)).counts.Abstain,1);
 const assignment=await call('assignment-open',uid(),{title:'Synthetic assignment',description:'Objective',minimum_rank:rankA,objective:'Observe'});assert.equal(assignment.payload.minimum_rank,rankA);await assert.rejects(call('assignment-open',uid(),{title:'Bad',description:'Text',assignment:uid()}),/not found/);
 const proposal=await call('mentorship-pair',uid(),{mentor:'mentor',mentee:'mentee',assign:false},'mentor');await assert.rejects(call('mentorship-accept',proposal.id,{},'other'),/recipient/);assert.equal((await call('mentorship-accept',proposal.id,{},'mentee')).status,'ACTIVE');
 const strong=await repo.workflow<any>('g','strongbox','submit','owner',uid(),{contents:'x'.repeat(4000),source:'synthetic'});assert.equal(strong.contents.length,4000);
 }finally{await db.close();}
});
test('production native contact handler keeps saved profile when Forum delivery fails; private reference view enforces Leader label',async()=>{
 const {db,client}=await testDatabase();try{const repo=new SupabaseRepositories(client),config={...fixtureConfig(),modules:{...fixtureConfig().modules,intelligence:true}};await repo.saveOrganization(config,fixtureOrganization(),'owner');let reply:any;
 const store:any=Object.assign(Object.create(repo),{load:async()=>config,permissionRoles:async()=>[{guildId:'g',roleId:'advisor',tier:'LEVEL_3'}],list:async()=>[]});
 const guild:any={id:'g',client:{user:{id:'bot'}},members:{fetch:async()=>({roles:{cache:new Map([['advisor',{}]])},permissions:{has:()=>false}})},roles:{fetch:async()=>new Map([['advisor',{}]])},channels:{fetch:async()=>{throw Error('Discord unavailable');}}};
 const input:any={id:'native-contact',guildId:'g',guild,user:{id:'owner'},commandName:'contact',options:{getSubcommand:()=> 'create',getString:(k:string)=>({name:'New contact',occupation:'Scholar'} as any)[k]??null,getBoolean:()=>null},deferReply:async()=>{},editReply:async(v:any)=>{reply=v;}};assert.equal(await handleNativeIntelligence(input,store),true);assert.match(reply.content,/saved.*recovery/);assert.equal((await repo.intelligence<any[]>('g','contacts','owner'))[0]!.name,'New contact');
 const id=uid();await repo.native('g','reference-save','owner',id,{title:'Private',body:'Secret fixture text',metadata:{confidentiality:'captain_plus'}});await assert.rejects(handleNativeWorkflow({...input,commandName:'reference',options:{getSubcommand:()=> 'view',getString:()=>id}},store),/LEVEL_4/);assert.ok(!JSON.stringify(reply).includes('Secret fixture text'));
 }finally{await db.close();}
});
test('native workflow additive upgrade retains populated dispatches, ballots and existing reference entries',async()=>{
 const oldId=uid();const {db}=await testDatabase(async(db,file)=>{if(!file.startsWith('014'))return;await db.query("insert into server_config(guild_id,organization_name,command_namespace,confidentiality_marker) values('upgrade','Synthetic','upgrade','[PRIVATE]')");await db.query("insert into briefings(id,guild_id,actor_id,title,body) values($1,'upgrade','actor','Historical dispatch','Original body')",[oldId]);await db.query("insert into reference_entries(guild_id,key,title,body) values('upgrade','old','Historical reference','Original text')");});try{const row=(await db.query<any>('select * from briefings where id=$1',[oldId])).rows[0]!;assert.equal(row.body,'Original body');assert.equal(row.audience,'apprentice_plus');assert.equal((await db.query<any>('select count(*) n from reference_entries')).rows[0]!.n,1);assert.equal((await db.query<any>('select count(*) n from reference_archive')).rows[0]!.n,0);}finally{await db.close();}
});
import { createBot } from '../src/runtime/bot.js';
import { MessageSetupWizard } from '../src/runtime/messageSetup.js';
import { Events } from 'discord.js';
test('Discord event queue acknowledges both rapid rank selectors and executes them in order',async()=>{
 const original=MessageSetupWizard.prototype.handle;const seen:string[]=[],acks:string[]=[],replies:string[]=[];let release!:()=>void;const gate=new Promise<void>(r=>release=r);let finished!:()=>void;const done=new Promise<void>(r=>finished=r);
 MessageSetupWizard.prototype.handle=async function(i:any){assert.equal(i.deferred,true);seen.push(i.customId);if(seen.length===1)await gate;else finished();};
 const client=createBot({} as any);try{const event=(suffix:string):any=>({id:suffix,guildId:'g',user:{id:'actor'},customId:'setup:1:refine-'+suffix,replied:false,deferred:false,isAutocomplete:()=>false,isAnySelectMenu:()=>true,isRepliable:()=>true,isChatInputCommand:()=>false,isButton:()=>false,isModalSubmit:()=>false,isStringSelectMenu:()=>true,async deferUpdate(){this.deferred=true;acks.push(suffix);},async reply(v:any){replies.push(v.content);}});
 client.emit(Events.InteractionCreate,event('role'));client.emit(Events.InteractionCreate,event('tier'));await Promise.resolve();assert.deepEqual(acks,['role','tier']);release();await done;assert.deepEqual(seen,['setup:1:refine-role','setup:1:refine-tier']);assert.deepEqual(replies,[]);
 }finally{release();MessageSetupWizard.prototype.handle=original;await client.destroy();}
});
import { handleOptional } from '../src/runtime/handlers/optional.js';
test('compatibility briefing history cannot reveal or publicly republish individual dispatches',async()=>{
 const {db,client}=await testDatabase();try{const repo=new SupabaseRepositories(client),config={...fixtureConfig(),modules:{...fixtureConfig().modules,briefings:true}};await repo.saveOrganization(config,fixtureOrganization(),'owner');const id=uid();await repo.native('g','briefing-send','owner',id,{title:'Private fixture',body:'For recipient only',audience:'individual',recipient:'recipient',kind:'ic'});let reply:any;const store:any=Object.assign(Object.create(repo),{load:async()=>config,permissionRoles:async()=>[{guildId:'g',roleId:'member-role',tier:'LEVEL_1'}]});const i:any={guildId:'g',user:{id:'actor'},commandName:'briefing',guild:{roles:{fetch:async()=>new Map([['member-role',{}]])},members:{fetch:async()=>({roles:{cache:new Map([['member-role',{}]])},permissions:{has:()=>false}})}},options:{getSubcommand:()=> 'history'},isModalSubmit:()=>false,deferReply:async()=>{},editReply:async(v:any)=>{reply=v;}};await handleOptional(i,store);assert.ok(!JSON.stringify(reply).includes('Private fixture'));await assert.rejects(handleOptional({...i,id:'private-history',customId:'optional:actor:briefing:history:'+id},store),/another member/);
 }finally{await db.close();}
});
