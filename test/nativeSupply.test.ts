import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase, fixtureConfig, fixtureOrganization } from './database.js';
import { SupabaseRepositories } from '../src/persistence/supabase.js';
import { handleSupply, autocompleteSupply, supplyPairs } from '../src/runtime/supply.js';
import { commandDefinitions } from '../src/runtime/commands.js';
import { readFile } from 'node:fs/promises';
const uid=()=>crypto.randomUUID();
test('native supply log matches independent source contract in all eleven ordered options',async()=>{
 const expected=JSON.parse(await readFile(new URL('../../test/fixtures/wayfinder-command-contracts.json',import.meta.url),'utf8')).commands.find((c:any)=>c.name==='supply').options.find((s:any)=>s.name==='log').options;
 const actual=(commandDefinitions() as any[]).find(c=>c.name==='supply').options.find((s:any)=>s.name==='log').options;
 const contract=(o:any)=>({name:o.name,type:o.type,required:o.required??false,autocomplete:o.autocomplete??false,min_value:o.min_value,max_length:o.max_length});assert.equal(actual.length,11);assert.deepEqual(actual.map(contract),expected.map(contract));
});
test('native Supply SQL and production handler: atomic four-item credit, retries, quotas, undo, redistribution and board failure',async()=>{
 const {db,client}=await testDatabase();try{
 const repo=new SupabaseRepositories(client);await repo.saveOrganization({...fixtureConfig(),modules:{...fixtureConfig().modules,supply:true}},fixtureOrganization(),'owner');
 await repo.saveOrganization({...fixtureConfig('other'),modules:{...fixtureConfig().modules,supply:true}},{...fixtureOrganization('other'),ranks:[],branches:[],edges:[]},'owner');
 const rpc=(action:string,key?:string,operation=uid(),data:any={})=>repo.supply<any>('g',action,'actor',key,operation,data);
 const create=()=>rpc('create',undefined,uid(),{name:'Synthetic supplies',client:'Example client',sale_price:5,member_rate:2,organizer:'actor',channel:'channel',items:['Iron','Leather','Wood','Cloth'].map(name=>({name,quantity:10}))});
 const order=await create();assert.equal(order.items.length,4);
 const roles=new Map([['member',{}],['staff',{}]]);let staff=false,board=0,reply:any;
 const store:any=Object.create(repo);store.load=async()=>({...fixtureConfig(),modules:{...fixtureConfig().modules,supply:true}});store.permissionRoles=async()=>[{guildId:'g',roleId:'member',tier:'BASELINE'},{guildId:'g',roleId:'staff',tier:'LEVEL_3'}];
 const guild={members:{fetch:async()=>({roles:{cache:new Map(staff?[['staff',{}]]:[['member',{}]])},permissions:{has:()=>false}})},roles:{fetch:async()=>roles}};
 const input=(values:any={},id=uid()):any=>({id,guildId:'g',guild,user:{id:'111'},options:{getSubcommand:()=>values.action??'log',getString:(k:string)=>values[k]??null,getInteger:(k:string)=>values[k]??null,getNumber:(k:string)=>values[k]??null,getUser:(k:string)=>values[k]?{id:values[k]}:null},deferReply:async()=>{},editReply:async(p:any)=>{reply=p;},showModal:()=>{throw Error('No modal allowed');}});
 const args={assignment:order.code,item:order.items[0].id,quantity:2,item_2:order.items[1].id,quantity_2:3,item_3:order.items[2].id,quantity_3:4,item_4:order.items[3].id,quantity_4:5,note:'Synthetic delivery'};
 const interaction=input(args);await handleSupply(interaction,store,async()=>{board++;});assert.equal(board,1);assert.match(reply.content,/Iron: 2 \/ 10/);await handleSupply(interaction,store,async()=>{board++;});
 let rows=await db.query<any>('select * from supply_contributions where guild_id=$1',['g']);assert.equal(rows.rows.length,4);assert.ok(rows.rows.every(r=>r.actor_id==='111'&&r.member_id==='111'&&r.note==='Synthetic delivery'));
 assert.deepEqual((await rpc('get',order.code)).credits.map((c:any)=>[c.quantity,c.payout]),[[14,28]]);
 await assert.rejects(handleSupply(input({...args,member:'222'}),store,async()=>{}),/LEVEL_3/);
 staff=true;await handleSupply(input({assignment:order.code,item:order.items[0].id,quantity:1,member:'222'}),store,async()=>{throw Error('Discord unavailable');});assert.match(reply.content,/operation is saved.*Board delivery needs recovery/s);
 for(const bad of [{...args,item_2:undefined},{...args,quantity:0},{...args,quantity:-1},{...args,quantity:1.5},{...args,item_2:order.items[0].name},{...args,item_4:uid()},{...args,quantity:100}])await assert.rejects(handleSupply(input(bad),store,async()=>{}));
 assert.equal((await db.query<any>('select count(*) n from supply_contributions')).rows[0]!.n,5);
 await assert.rejects(repo.supply('other','log','x',order.id,uid(),{member:'x',items:[{item:order.items[0].id,quantity:1}]}),/not found/);
 const redis=await rpc('redistribute',order.code,uid(),{source:'111',before:'2100-01-01T00:00:00Z',method:'even',reason:'Synthetic redistribution'});assert.deepEqual(redis.credits.map((c:any)=>[c.member_id,c.quantity]),[['222',15]]);
 await assert.rejects(rpc('undo-last',order.code,uid(),{member:'111'}),/redistributed/);
 await rpc('undo-last',order.code,uid(),{member:'222'});assert.equal((await rpc('get',order.code)).items[0].contributed,2);
 await rpc('close',order.code);await assert.rejects(rpc('log',order.code,uid(),{member:'111',items:[{item:order.items[0].id,quantity:1}]}),/not active/);await rpc('reopen',order.code);
 const complete=await create();await rpc('log',complete.code,uid(),{member:'111',items:complete.items.map((i:any)=>({item:i.id,quantity:10}))});assert.equal((await rpc('get',complete.code)).status,'Completed');
 let suggestions:any;for(const name of ['assignment','item','item_2','item_3','item_4']){const i=input({assignment:order.code});i.options.getFocused=()=>({name,value:''});i.respond=async(v:any)=>{suggestions=v;};await autocompleteSupply(i,store);assert.ok(suggestions.length);if(name!=='assignment')assert.equal(suggestions[0].value,order.items[0].id);}
 store.load=async()=>fixtureConfig();const i=input({assignment:order.code});i.options.getFocused=()=>({name:'assignment',value:''});i.respond=async(v:any)=>{suggestions=v;};await autocompleteSupply(i,store);assert.deepEqual(suggestions,[]);
 await db.exec('set role anon');await assert.rejects(db.query('select * from supply_contributions'),/permission denied/);await assert.rejects(db.query("select codex_supply('g','list','x')"),/permission denied/);await db.exec('reset role');
 }finally{await db.close();}
});
test('Supply additive migration preserves populated scalar campaign history',async()=>{const {db}=await testDatabase(async(db,file)=>{if(!file.startsWith('013'))return;await db.query("insert into server_config(guild_id,organization_name,command_namespace,confidentiality_marker) values('legacy','Synthetic','synthetic','[PRIVATE]')");await db.query("insert into supply_campaigns(id,guild_id,title,created_by) values('10000000-0000-4000-8000-000000000099','legacy','Historical stock','actor')");});try{assert.equal((await db.query<any>('select title from supply_campaigns')).rows[0]!.title,'Historical stock');}finally{await db.close();}});
