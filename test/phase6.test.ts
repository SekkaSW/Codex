import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase,fixtureConfig,fixtureOrganization} from './database.js';
import {FieldRepository} from '../src/persistence/field.js';
import {canonicalReport,DurableDelivery,IntelligencePipeline,type ContactRow,type ReportRow,type TopicRow} from '../src/intelligence.js';
import {mayTransfer,nativeAdapter,classifyReport} from '../src/reports.js';
import {handleIntelligence} from '../src/runtime/handlers/intelligence.js';
import {Collection} from 'discord.js';
async function fixture(){const {db,client}=await testDatabase(),store=new FieldRepository(client);await store.saveOrganization(fixtureConfig(),fixtureOrganization(),'admin');return {db,store,client};}
test('Phase 6 migration, canonical HQ pipeline, confidential local publication and direct/group deduplication',async()=>{
 const {db,store,client}=await fixture();try{
  const t=await store.trailmark('g','create','admin',undefined,{name:'Field',description:'Outpost'}),hq=await store.trailmark('g','create','admin',undefined,{name:'HQ',description:'Headquarters'});await store.trailmark('g','hq','admin',hq.id);
  const id=crypto.randomUUID(),immediate=crypto.randomUUID();await store.trailmark('g','report','reporter',t.id,{id,body:'Trade [confidential] information'});await store.trailmark('g','report','reporter',hq.id,{id:immediate,body:'General information'});
  await store.intelligence('g','topic-save','admin',undefined,{name:'Commerce',keywords:['trade'],priority:0});
  const contact=await store.intelligence<ContactRow>('g','contact-create','admin',crypto.randomUUID(),{name:'Local',kind:'CONTACT',description:'Details'}),group=await store.intelligence<ContactRow>('g','contact-create','admin',crypto.randomUUID(),{name:'Partners',kind:'GROUP'});
  await store.intelligence('g','contact-group','admin',group.id,{contacts:[contact.id]});await store.intelligence('g','report-links','reporter',id,{ids:[contact.id,group.id]});
  const sends:Array<{channel:string;key:string}>=[],publisher={async send(channel:string,key:string){sends.push({channel,key});return `message-${sends.length}`;},async recover(){return undefined;}};
  const destinations={async topic(topic?:TopicRow){return topic?.name??'catchall';},async contact(c:ContactRow){return c.id;}};
  let pipeline=new IntelligencePipeline(store,new DurableDelivery(store,publisher),destinations);
  assert.equal(await pipeline.process('g',id),false);assert.deepEqual(await store.intelligence('g','report-contacts','reporter',id),[]);assert.equal(sends.length,0);
  await pipeline.process('g',immediate);assert.equal(sends[0]?.channel,'catchall');
  await store.intelligence('g','report-hq','deliverer',id);await pipeline.process('g',id);assert.equal(sends.length,3);assert.equal(sends[1]?.channel,'Commerce');assert.equal(sends[2]?.channel,contact.id);
  pipeline=new IntelligencePipeline(new FieldRepository(client),new DurableDelivery(store,publisher),destinations);
  await pipeline.batch('g');await pipeline.process('g',id);assert.equal(sends.length,3);
  const row=await store.intelligence<ReportRow>('g','report-get','admin',id),canonical=canonicalReport(row,'[CONFIDENTIAL]');assert.equal(row.delivery_status,'PUBLISHED');assert.equal(canonical.authorId,'reporter');assert.equal(canonical.sourceTrailmarkId,t.id);assert.equal(canonical.confidential,true);assert.equal(mayTransfer(canonical,'[CONFIDENTIAL]'),false);assert.deepEqual(nativeAdapter.parse(nativeAdapter.serialize(canonical)),JSON.parse(JSON.stringify(canonical)));
  await assert.rejects(store.intelligence('other','report-get','admin',id));
  assert.deepEqual(await store.intelligence('g','pending','system'),[]);
  const second=await store.intelligence<ContactRow>('g','contact-create','admin',crypto.randomUUID(),{name:'Second contact',kind:'CONTACT'});
  await store.intelligence('g','contact-group','admin',group.id,{contacts:[contact.id,second.id]});
  assert.equal((await store.intelligence<ReportRow[]>('g','pending','system')).length,1);
  await pipeline.batch('g');assert.equal(sends.length,4);assert.equal(sends.at(-1)!.channel,second.id);
 }finally{await db.close();}
});
test('Phase 6 topics, Contacts, links, archives, revisions and guild isolation survive repository restart',async()=>{
 const {db,store}=await fixture();try{
  const topic=await store.intelligence<TopicRow>('g','topic-save','admin',undefined,{name:'Old',keywords:['one'],priority:1});await store.intelligence('g','topic-save','admin',topic.id,{name:'New',keywords:['two'],priority:0,revision:0});await assert.rejects(store.intelligence('g','topic-save','admin',topic.id,{name:'Stale',keywords:[],revision:0}));assert.equal(classifyReport('TWO',await store.intelligence('g','topics','admin')),'New');assert.equal(classifyReport('other',[{name:'Empty',keywords:['']}]),undefined);
  const c=await store.intelligence<ContactRow>('g','contact-create','admin',crypto.randomUUID(),{name:'Contact',kind:'CONTACT',description:'Original'});await store.intelligence('g','contact-edit','admin',c.id,{name:'Renamed',description:'Updated',revision:0});await store.intelligence('g','contact-thread','admin',c.id,{thread:'stored-id'});await store.intelligence('g','contact-link','admin',c.id,{member:'person'});
  let row=await store.intelligence<ContactRow>('g','contact-get','admin',c.id);assert.equal(row.forum_thread_id,'stored-id');assert.deepEqual(row.members,['person']);await store.intelligence('g','contact-unlink','admin',c.id,{member:'person'});await store.intelligence('g','contact-archive','admin',c.id);row=await store.intelligence<ContactRow>('g','contact-get','admin',c.id);assert.equal(row.active,false);assert.deepEqual(row.members,[]);assert.equal(row.description,'Updated');
  await store.saveOrganization(fixtureConfig('other'),{...fixtureOrganization('other'),ranks:[],edges:[],branches:[]},'admin');await assert.rejects(store.intelligence('other','contact-get','admin',c.id));
  await db.exec('set role anon');await assert.rejects(db.query("select codex_intelligence('g','contacts','attacker')"));await db.exec('reset role');
 }finally{await db.close();}
});
test('Phase 6 delivery response loss recovers original message without resend; unknown outcomes remain blocked',async()=>{
 const {db,store}=await fixture();try{
  let sends=0;const lost=new DurableDelivery(store,{async send(){sends++;throw new Error('response lost');},async recover(){return 'original-message';}});
  await assert.rejects(lost.deliver('g','report:test','channel','Body'));assert.equal(await lost.deliver('g','report:test','channel','Body'),'original-message');assert.equal(sends,1);
  const blocked=new DurableDelivery(store,{async send(){sends++;throw new Error('unknown');},async recover(){return undefined;}});await assert.rejects(blocked.deliver('g','report:unknown','channel','Body'));await assert.rejects(blocked.deliver('g','report:unknown','channel','Body'),/uncertain/);assert.equal(sends,2);
 }finally{await db.close();}
});
test('Phase 6 Discord modal persists forum thread and member selector; ownership and permission checks apply',async()=>{
 const {db,store}=await fixture();try{
  const channels=new Collection<string,any>(),resources:any[]=[];let threadCount=0;
  const guild:any={id:'g',client:{user:{id:'bot'}},roles:{async fetch(){return new Collection();}},members:{async fetch(){return {roles:{cache:new Collection()},permissions:{has:()=>true}};}},channels:{async fetch(id?:string){return id?channels.get(id):channels;},async create(input:any){const forum={...input,id:'forum',threads:{async create(){const thread={id:`thread-${++threadCount}`,isThread:()=>true,archived:false};channels.set(thread.id,thread);return thread;}}};channels.set(forum.id,forum);return forum;}}};
  const repos=Object.assign(store,{async list(){return resources;},async put(row:any){resources.push(row);},async permissionRoles(){return [];}});
  let output:any;const i:any={guild,guildId:'g',user:{id:'admin'},id:'modal-1',customId:'intel:admin:contact:create:new~g',fields:{getTextInputValue:(key:string)=>key==='name'?'Contact':'Description'},isModalSubmit:()=>true,async deferReply(){},async editReply(value:any){output=value;}};
  await handleIntelligence(i,repos as any);assert.equal(output.content,'Saved.');let contact=(await store.intelligence<ContactRow[]>('g','contacts','admin'))[0]!;assert.equal(contact.forum_thread_id,'thread-1');
  await handleIntelligence({...i,id:'modal-1'},repos as any);assert.equal(threadCount,1);
  contact=(await store.intelligence<ContactRow[]>('g','contacts','admin'))[0]!;
  await handleIntelligence({...i,isModalSubmit:()=>false,customId:`intel:admin:contact:member-add:${contact.id}~${contact.revision}`,values:['member']},repos as any);assert.deepEqual((await store.intelligence<ContactRow>('g','contact-get','admin',contact.id)).members,['member']);
  await assert.rejects(handleIntelligence({...i,user:{id:'intruder'}},repos as any),/belongs/);
 }finally{await db.close();}
});
