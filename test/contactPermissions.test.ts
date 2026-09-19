import test from 'node:test';
import assert from 'node:assert/strict';
import {Collection} from 'discord.js';
import {testDatabase,fixtureConfig,fixtureOrganization} from './database.js';
import {SupabaseRepositories} from '../src/persistence/supabase.js';
import {handleNativeIntelligence} from '../src/runtime/nativeIntelligence.js';
import {handleIntelligence} from '../src/runtime/handlers/intelligence.js';
import {autocompleteNative} from '../src/runtime/nativeAutocomplete.js';
import {availableActions} from '../src/runtime/panels.js';
import {route} from '../src/runtime/bot.js';
import {registrationPlan} from '../src/runtime/registration.js';
import {askConfirmation,handleConfirmation,friendlyError} from '../src/runtime/confirmation.js';
import {handleFunds} from '../src/runtime/handlers/funds.js';
import type {LedgerEntry} from '../src/services.js';

function boundary(){
 const mappings:any[]=['BASELINE','LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4','LEVEL_1'].map((tier,n)=>({guildId:'g',roleId:'r'+n,tier}));
 const state={roles:['r1'],deleted:false,admin:false,output:null as any,modal:null as any};
 const channels=new Collection<string,any>();let sends=0;
 const forum={id:'forum',type:15,threads:{async create(payload:any){const starter={author:{id:'bot'},...payload.message,async edit(v:any){Object.assign(this,v);}};const thread={id:'thread-'+(++sends),isThread:()=>true,archived:false,fetchStarterMessage:async()=>starter};channels.set(thread.id,thread);return thread;}}};channels.set('forum',forum);
 const guild:any={id:'g',client:{user:{id:'bot'}},channels:{fetch:async(id:string)=>channels.get(id)},roles:{fetch:async()=>new Map(state.deleted?[]:mappings.map(r=>[r.roleId,{}]))},members:{fetch:async()=>({roles:{cache:new Map(state.roles.map(r=>[r,{}]))},permissions:{has:()=>state.admin}})}};
 let sequence=0;
 const interaction=(action:string):any=>({id:crypto.randomUUID(),guildId:'g',guild,user:{id:'actor'},commandName:'contact',memberPermissions:{has:()=>state.admin},options:{getSubcommand:()=>action,getString:((name:string)=>(k:string)=>k==='name'?name:null)('Synthetic contact '+(++sequence)),getBoolean:()=>null},isChatInputCommand:()=>true,isButton:()=>false,isAnySelectMenu:()=>false,isStringSelectMenu:()=>false,isModalSubmit:()=>false,deferReply:async()=>{},editReply:async(v:any)=>{state.output=v;},showModal:async(v:any)=>{state.modal=v;}});
 return {state,mappings,guild,interaction,sends:()=>sends};
}
test('Member Contact creation uses production handlers, SQL, Forum receipts and retry without duplicate creation',async()=>{
 const {db,client}=await testDatabase();try{
 const f=boundary(),repo=new SupabaseRepositories(client),config={...fixtureConfig(),modules:{...fixtureConfig().modules,intelligence:true}},org=fixtureOrganization();org.permissions=f.mappings;
 await repo.saveOrganization(config,org,'owner');
 const store:any=Object.assign(Object.create(repo),{load:async()=>config,permissionRoles:async()=> (await repo.organization('g')).permissions,list:async()=>[{guildId:'g',key:'CONTACTS',discordId:'forum',kind:'FORUM'}]});
 for(const role of ['r1','r2','r3','r4','r5','administrator']){f.state.roles=[role];f.state.admin=role==='administrator';for(const action of ['create','create-group']){const i=f.interaction(action);await route(i,{} as any,store);assert.match(f.state.output.content,/saved: <#thread/);await handleNativeIntelligence(i,store);}}
 assert.equal(f.sends(),12);
 const rows=(await db.query<any>('select * from contacts')).rows;assert.equal(rows.length,12);assert.equal(rows.filter(r=>r.kind==='GROUP').length,6);assert.ok(rows.every(r=>r.guild_id==='g'&&r.forum_thread_id));
 const audits=(await db.query<any>("select * from audit_events where event_type='INTEL_CONTACT-CREATE'")).rows;assert.equal(audits.length,12);assert.ok(audits.every(r=>r.actor_id==='actor'&&r.guild_id==='g'));
 assert.equal((await db.query<any>("select count(*)::int n from discord_deliveries where state='SENT'")).rows[0].n,12);
 // The receipt survives a failure between publishing and saving the Forum identity.
 f.state.admin=false;f.state.roles=['r1'];let fail=true;store.intelligence=async(...args:any[])=>{if(args[1]==='contact-thread'&&fail){fail=false;throw Error('Synthetic response loss');}return (repo.intelligence as any)(...args);};
 const retry=f.interaction('create-group');await handleNativeIntelligence(retry,store);assert.match(f.state.output.content,/recovery/);await handleNativeIntelligence(retry,store);assert.match(f.state.output.content,/saved: <#thread/);assert.equal(f.sends(),13);
 for(const role of ['r0','unmapped']){f.state.roles=[role];await assert.rejects(handleNativeIntelligence(f.interaction('create'),store),/Member permission/);}
 f.state.roles=['r1'];f.state.deleted=true;await assert.rejects(handleNativeIntelligence(f.interaction('create-group'),store),/Member permission/);f.state.deleted=false;
 await assert.rejects(handleNativeIntelligence({...f.interaction('create'),guildId:'foreign'},store));
 config.modules.intelligence=false;await assert.rejects(handleNativeIntelligence(f.interaction('create'),store),/not enabled/);config.modules.intelligence=true;
 for(const action of ['setup','repair','edit','list','archive','link-member','unlink-member','group-members'])await assert.rejects(handleNativeIntelligence(f.interaction(action),store),/LEVEL_3/);
 await assert.rejects(handleNativeIntelligence({...f.interaction('create'),customId:`native:contact-assessment:${rows[0].id}:good`},store),/LEVEL_3/);
 for(const action of ['edit-form','save-contact','group-save','member-add','archive'])await assert.rejects(handleIntelligence({...f.interaction('create'),customId:`intel:actor:contact:${action}:${rows[0].id}~0`},store),/LEVEL_3/);
 const names=(await availableActions(f.interaction('panel'),store,config,'contact')).map(a=>a.name);assert.deepEqual(names.sort(),['create','create-group']);
 for(const action of ['create','create-group']){
 await handleIntelligence(f.interaction(action),store);assert.equal(f.state.modal.custom_id,`intel:actor:contact:${action}:new~g`);
 const modal={...f.interaction(action),customId:f.state.modal.custom_id,isModalSubmit:()=>true,fields:{getTextInputValue:(k:string)=>k==='name'?'Compatibility '+action:'Details'}};
 f.state.roles=[];await assert.rejects(handleIntelligence(modal,store),/Member permission/);f.state.roles=['r1'];
 f.state.deleted=true;await assert.rejects(handleIntelligence(modal,store),/Member permission/);f.state.deleted=false;
 await assert.rejects(handleIntelligence({...modal,user:{id:'other'}},store),/belongs/);
 await assert.rejects(handleIntelligence({...modal,customId:`intel:actor:contact:${action}:new~foreign`},store),/another server/);
 await assert.rejects(handleIntelligence({...modal,customId:`intel:actor:contact:${action}:${rows[0].id}~0`},store),/stale/);
 await handleIntelligence(modal,store);await handleIntelligence(modal,store);
 }
 assert.equal(f.sends(),15);
 f.state.roles=['r3'];await assert.rejects(handleIntelligence({...f.interaction('edit'),customId:`intel:actor:contact:edit-form:${rows[0].id}~9999`},store),/changed/);
 }finally{await db.close();}
});

test('Member creation autocomplete exposes assignments only and rechecks feature, guild and roles',async()=>{
 const f=boundary(),config={...fixtureConfig(),modules:{...fixtureConfig().modules,intelligence:true}};let choices:any,lookups=0;
 const store:any={load:async()=>config,permissionRoles:async()=>f.mappings,organization:async()=>({groups:[{id:'group',name:'Region'}],entries:[{id:'entry',groupId:'group',name:'North'}]}),intelligence:async()=>{lookups++;throw Error('No Contact lookup allowed');}};
 const input=(key:string)=>({...f.interaction('create'),options:{getSubcommand:()=> 'create',getFocused:()=>({name:key,value:''})},respond:async(v:any)=>{choices=v;}});
 await autocompleteNative(input('assignment'),store);assert.deepEqual(choices,[{name:'Region: North',value:'entry'}]);
 for(const key of ['contact','group','person']){await autocompleteNative(input(key),store);assert.deepEqual(choices,[]);}assert.equal(lookups,0);
 f.state.roles=[];await autocompleteNative(input('assignment'),store);assert.deepEqual(choices,[]);f.state.roles=['r1'];
 await autocompleteNative({...input('assignment'),guildId:'foreign'},store);assert.deepEqual(choices,[]);
 config.modules.intelligence=false;await autocompleteNative(input('assignment'),store);assert.deepEqual(choices,[]);
});

test('Funds production mutations retain Advanced Member threshold, hierarchy, reads and revocation',async()=>{
 const f=boundary(),rows:LedgerEntry[]=[],store={permissionRoles:async()=>f.mappings,history:async()=>rows,append:async(row:LedgerEntry)=>{rows.push(row);}};
 const input=(action:string)=>{const i=f.interaction(action);i.commandName='funds';i.options={getSubcommand:()=>action,get:()=>({type:4}),getInteger:(k:string)=>k==='amount'?25:null,getString:()=> 'Synthetic note',getUser:()=>null};return i;};
 const mutations=['deposit','spend','set-balance','undo-last','refresh-summary'];
 for(const action of mutations)await assert.rejects(handleFunds(input(action),store),/^Error: Advanced Member permission/);assert.equal(rows.length,0);
 for(const role of ['r2','r3','r4','administrator']){f.state.roles=[role];f.state.admin=role==='administrator';for(const action of mutations)await handleFunds(input(action),store);}
 f.state.admin=false;f.state.roles=[];for(const action of mutations)await assert.rejects(handleFunds(input(action),store),/Advanced Member/);
 f.state.roles=['r2'];f.state.deleted=true;await assert.rejects(handleFunds(input('deposit'),store),/Advanced Member/);
 f.state.roles=[];for(const action of ['balance','history','monthly'])await handleFunds(input(action),store);
 assert.ok(rows.length>0);assert.ok(rows.every(r=>r.guildId==='g'&&r.actorId==='actor'));
});

test('Funds confirmation rechecks revoked roles and labels; command payloads preserve defaults',async()=>{
 const f=boundary(),rows:LedgerEntry[]=[],store:any={permissionRoles:async()=>f.mappings,history:async()=>rows,append:async(row:LedgerEntry)=>{rows.push(row);}};f.state.roles=['r2'];
 const i=f.interaction('set-balance');i.commandName='funds';i.options.getInteger=()=>25;i.options.getNumber=()=>25;i.options.get=()=>({type:4});i.reply=async(v:any)=>{f.state.output=v;};
 await askConfirmation(i,store);f.state.roles=[];
 await assert.rejects(handleConfirmation({...i,customId:f.state.output.components[0].components[0].custom_id},next=>handleFunds(next,store)),/Advanced Member/);assert.equal(rows.length,0);
 assert.equal(friendlyError(new Error('Advanced Member permission or Discord Administrator is required.')),'Advanced Member permission or Discord Administrator is required.');
 const contact=registrationPlan().find(c=>c.name==='contact');assert.equal(contact.default_member_permissions,undefined);for(const action of ['create','create-group'])assert.match(contact.options.find((o:any)=>o.name===action).description,/Member\+/);
 assert.deepEqual(registrationPlan('guild-placeholder','order').map(c=>c.name),['order']);
});
