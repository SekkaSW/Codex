import {test} from 'node:test';import assert from 'node:assert/strict';
import {testDatabase,fixtureConfig,fixtureOrganization} from './database.js';import {FieldRepository} from '../src/persistence/field.js';
import {BridgeCoordinator,type BridgeRow} from '../src/bridge.js';import {DurableDelivery,IntelligencePipeline,type ReportRow,type TopicRow} from '../src/intelligence.js';import {nativeAdapter,legacyWayfinderAdapter} from '../src/reports.js';
test('Phase 7 reciprocal native bridge persists retries, deduplicates delivery, maps topics and blocks confidentiality',async()=>{
 const {db,client}=await testDatabase(),store=new FieldRepository(client);try{
  await store.saveOrganization(fixtureConfig('a'),fixtureOrganization('a'),'admin');await store.saveOrganization(fixtureConfig('b'),{...fixtureOrganization('b'),ranks:[],branches:[],edges:[]},'admin');
  const a=await store.bridge<BridgeRow>('a','setup','admin',undefined,{remote:'b',name:'Remote',protocol:'codex-v1'});
  const topic=await store.intelligence<TopicRow>('b','topic-save','admin',undefined,{name:'Remote topic',keywords:[],priority:0});
  await store.bridge('a','group-set','admin',a.id,{group:'Information',topics:{'*':topic.name}});
  const hq=await store.trailmark('a','create','admin',undefined,{name:'HQ'});await store.trailmark('a','hq','admin',hq.id);
  const normal=crypto.randomUUID(),secret=crypto.randomUUID();await store.trailmark('a','report','author',hq.id,{id:normal,body:'News'});await store.trailmark('a','report','author',hq.id,{id:secret,body:'[cOnFiDeNtIaL] News'});
  const channels:string[]=[],publisher={async send(channel:string){channels.push(channel);return 'message-'+channels.length;},async recover(){return undefined;}},destinations={async topic(t?:TopicRow){return t?.name??'catchall';},async contact(){return 'contact';}};
  await new IntelligencePipeline(store,new DurableDelivery(store,publisher),destinations).batch('a');
  let coordinator=new BridgeCoordinator(store);assert.deepEqual(await coordinator.drain('a','[CONFIDENTIAL]'),{delivered:0,failed:1});
  await store.bridge('b','setup','admin',undefined,{remote:'a',name:'Local',protocol:'codex-v1'});coordinator=new BridgeCoordinator(new FieldRepository(client));assert.deepEqual(await coordinator.drain('a','[CONFIDENTIAL]'),{delivered:1,failed:0});assert.deepEqual(await coordinator.drain('a','[CONFIDENTIAL]'),{delivered:0,failed:0});
  const incoming=await store.intelligence<ReportRow[]>('b','reports','admin');assert.equal(incoming.length,1);assert.equal(incoming[0]!.adapter_metadata.originGuildId,'a');await new IntelligencePipeline(store,new DurableDelivery(store,publisher),destinations).batch('b');assert.equal(channels.at(-1),'Remote topic');assert.deepEqual(await coordinator.drain('b','[CONFIDENTIAL]'),{delivered:0,failed:0});
  assert.equal((await db.query<{status:string}>('select status from bridge_deliveries where report_id=$1',[secret])).rows[0]!.status,'BLOCKED');
  const envelope={version:1,type:'codex.report',report:{id:normal,originGuildId:'a',body:'News'}};await assert.rejects(store.bridge('a','deliver','admin',a.id,{envelope}),/identity/);
  await assert.rejects(store.bridge('b','get','admin',a.id),/not found/);
 }finally{await db.close();}
});
test('Phase 7 trusted legacy intake validates sender/channel, remains isolated, and replays once',async()=>{
 const {db,client}=await testDatabase(),store=new FieldRepository(client);try{
  await store.saveOrganization(fixtureConfig(),fixtureOrganization(),'admin');const b=await store.bridge<BridgeRow>('g','setup','admin',undefined,{remote:'legacy',name:'Partner',protocol:'legacy-wayfinder',channel:'intake',sender:'bot'}),coordinator=new BridgeCoordinator(store);
  const payload=JSON.stringify({id:'legacy-1',content:'Local intelligence',medals:['ignored']});assert.equal(await coordinator.ingest('g','intake','intruder','m1',payload,'[CONFIDENTIAL]'),undefined);
  const id=await coordinator.ingest('g','intake','bot','m1',payload,'[CONFIDENTIAL]');assert.equal(await new BridgeCoordinator(new FieldRepository(client)).ingest('g','intake','bot','m1',payload,'[CONFIDENTIAL]'),id);const r=await store.intelligence<ReportRow>('g','report-get','admin',id);assert.equal(r.source,'legacy-wayfinder');assert.equal(r.delivery_status,'AT_HQ');assert.equal(Object.hasOwn(r.adapter_metadata,'medals'),false);
  await assert.rejects(store.bridge('g','ingest','intruder',b.id,{channel:'elsewhere',sender:'bot'}),/Unauthorized/);await assert.rejects(coordinator.ingest('g','intake','bot','m2','{"body":"[confidential] blocked"}','[CONFIDENTIAL]'));
  await store.bridge('g','disable','admin',b.id);assert.equal(await coordinator.ingest('g','intake','bot','m3',payload,'[CONFIDENTIAL]'),undefined);
  assert.throws(()=>nativeAdapter.parse('{"type":"codex.report","version":2}'));assert.throws(()=>nativeAdapter.parse('{"type":"codex.report","version":1,"report":{}}'));assert.throws(()=>legacyWayfinderAdapter.parse('{"body":42}','legacy'));
 }finally{await db.close();}
});
