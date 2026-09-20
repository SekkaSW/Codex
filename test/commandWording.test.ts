import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,appendFile} from 'node:fs/promises';
import {commandDefinitions} from '../src/runtime/commands.js';
import {route} from '../src/runtime/bot.js';
import {choices,requireTier,replyText} from '../src/runtime/interactions.js';
import {friendlyError,handleConfirmation,redactedDiagnostic} from '../src/runtime/confirmation.js';
import {handleNativeWorkflow} from '../src/runtime/nativeWorkflows.js';
import {handleNativeOptional} from '../src/runtime/nativeOptional.js';
import {handleNativeIntelligence} from '../src/runtime/nativeIntelligence.js';
import {permissionLabels} from '../src/domain.js';

async function transcript(title:string,content:string){if(process.env.CODEX_COMMAND_TRANSCRIPT)await appendFile(process.env.CODEX_COMMAND_TRANSCRIPT,`\n## ${title}\n\n\`\`\`text\n${content}\n\`\`\`\n`);}

const config={guildId:'g',organizationName:'Example',commandNamespace:'organization',confidentialityMarker:'[LOCAL]',modules:{intelligence:true,trailmarks:true,supply:true,briefings:true,patrols:true,atlas:true}};
function fixture(){let output:any;const guild:any={id:'g',client:{user:{id:'bot'}},members:{fetch:async()=>({roles:{cache:new Map()},permissions:{has:()=>true}})},roles:{fetch:async()=>new Map()},channels:{fetch:async()=>{throw Error('Synthetic Discord failure');}}};const i:any={id:'synthetic',guildId:'g',guild,channelId:'commands',user:{id:'actor'},memberPermissions:{has:()=>true},isChatInputCommand:()=>true,isButton:()=>false,isModalSubmit:()=>false,isAnySelectMenu:()=>false,isStringSelectMenu:()=>false,options:{getSubcommand:()=>'',getString:()=>null,getBoolean:()=>null},deferReply:async()=>{},editReply:async(p:any)=>{output=p;},reply:async(p:any)=>{output=p;}};const store:any={load:async()=>config,permissionRoles:async()=>[],list:async()=>[{guildId:'g',key:'NOTICE_BOARD',discordId:'board',kind:'CHANNEL'}]};return {i,store,get output(){return output;}};}
test('runtime errors, permissions and first/last-page empty states have truthful recovery copy',async()=>{
 const f=fixture();f.i.guild.members.fetch=async()=>({roles:{cache:new Map()},permissions:{has:()=>false}});
 for(const [tier,label] of Object.entries(permissionLabels)){if(tier==='BASELINE')continue;await assert.rejects(requireTier(f.i,f.store,tier as any),(e:any)=>{assert.equal(friendlyError(e),`${label} permission or Discord Administrator is required.`);return true;});}
 const long=replyText('Synthetic '.repeat(500));assert.equal(long.files[0].attachment.toString(),'Synthetic '.repeat(500));assert.ok(long.content.length<2000);assert.deepEqual(long.allowedMentions,{parse:[]});
 assert.deepEqual(redactedDiagnostic(Object.assign(new Error('private payload credential=test'),{code:'23505'})),{category:'Error',code:'23505'});
 assert.doesNotMatch(choices('test',[]).content,/Previous/);assert.match(choices('test',[],2).content,/Previous/);
 assert.doesNotMatch(friendlyError(new Error('postgres constraint secret=test')),/postgres|constraint|secret=test/);
 assert.match(friendlyError(new Error('item_2 and quantity_2 must be supplied together.')),/Supply both/);
 assert.match(friendlyError(new Error('This optional module is disabled')),/disabled.*administrator/);
 assert.match(friendlyError(new Error('Record changed; revision mismatch')),/outdated.*refresh/);
 await handleConfirmation({...f.i,customId:'uxconfirm:missing:yes'},async()=>{throw Error('must not dispatch');});assert.match(f.output.content,/expired or was already used/);
 await transcript('Errors, expiry and empty results (production helpers)',[friendlyError(new Error('LEVEL_2 or Discord Administrator permission required')),friendlyError(new Error('This optional module is disabled')),friendlyError(new Error('Record changed; revision mismatch')),friendlyError(new Error('item_2 and quantity_2 must be supplied together.')),f.output.content,choices('test',[]).content,choices('test',[],2).content].join('\n\n'));
});
test('saved votes and assignment actions report Discord failure without repeating persisted mutations',async()=>{
 for(const family of ['ballot','assignment']){const f=fixture();let mutations=0;f.i.customId=`native:${family}:record:${family==='assignment'?'claim':''}`;f.i.values=['0'];f.store.workflow=async(_g:string,_s:string,action:string)=>{if(action!=='get')mutations++;return {id:'record',status:'OPEN',title:'Synthetic',options:['Yes','No'],voter_tier:'BASELINE',permission_snapshot:[],payload:{},channel_id:'board'};};await handleNativeWorkflow(f.i,f.store);assert.equal(mutations,1);assert.match(f.output.content,/recorded|saved/);assert.match(f.output.content,/could not be refreshed/);assert.match(f.output.content,/not vote again|not repeat/);await transcript(`Saved ${family}, failed public post (production handler)`,f.output.content);}
 const f=fixture();let saves=0;f.i.commandName='vote';f.i.options={getSubcommand:()=> 'open',getString:(key:string)=>key==='question'?'Synthetic question':null};f.store.native=async()=>{saves++;return {id:'vote-id',title:'Synthetic question',status:'OPEN',options:['Yes','No','Abstain'],channel_id:'board'};};await handleNativeWorkflow(f.i,f.store);assert.equal(saves,1);assert.match(f.output.content,/Vote vote-id saved.*Do not open a second vote/);await transcript('Saved new vote, failed delivery (production handler)',f.output.content);
});
test('Patrol suggestion and Intel backfill responses describe actual outcomes',async()=>{
 const f=fixture();f.i.commandName='patrol';f.i.options.getSubcommand=()=> 'suggest';f.store.organization=async()=>({entries:[]});f.store.member=async()=>undefined;f.store.native=async()=>[];await handleNativeOptional(f.i,f.store);assert.match(f.output.content,/route suggestion, not a saved assignment/);assert.match(f.output.content,/no eligible Trailmarks/);
 const patrol=f.output.content;f.i.commandName='intel';f.i.options.getSubcommand=()=> 'backfill';f.i.options.getInteger=()=>null;f.store.intelligence=async()=>[];await handleNativeIntelligence(f.i,f.store);assert.match(f.output.content,/0 persisted reports/);assert.match(f.output.content,/Unrecognized historical Discord messages are not imported/);
 if(process.env.CODEX_COMMAND_TRANSCRIPT)await appendFile(process.env.CODEX_COMMAND_TRANSCRIPT,`\n## Patrol and Intel (production handlers)\n\n\`\`\`text\n${patrol}\n\n${f.output.content}\n\`\`\`\n`);
});

test('reference attachment uses human handling labels and retains structured authored metadata',async()=>{
 const f=fixture();f.i.commandName='reference';f.i.options={getSubcommand:()=> 'view',getString:()=> 'record'};
 f.store.native=async()=>({title:'Example reference',metadata:{confidentiality:'marshal_plus',context:{note:'Officer is an authored rank'}},body:'Synthetic body'});
 await handleNativeWorkflow(f.i,f.store);const text=f.output.files[0].attachment.toString();assert.match(text,/confidentiality: Advisors/);assert.match(text,/Officer is an authored rank/);assert.doesNotMatch(text,/marshal_plus|\[object Object\]/);await transcript('Reference attachment (production handler)',text);
});
test('every registered operation and component family is present in the wording inventory',async()=>{
 const inventory=JSON.parse(await readFile(new URL('../../docs/COMMAND_WORDING_INVENTORY.json',import.meta.url),'utf8'));
 const definitions=commandDefinitions('organization') as any[],operations=definitions.flatMap(c=>(c.options?.length?c.options:[{name:''}]).map((s:any)=>`/${c.name}${s.name?' '+s.name:''}`));assert.equal(definitions.length,25);assert.equal(operations.length,202);assert.deepEqual(inventory.operations.map((r:any)=>r.command),operations);assert.equal(inventory.components.length,22);
 for(const c of definitions)for(const s of c.options?.length?c.options:[{name:'',description:c.description}]){const entry=inventory.operations.find((r:any)=>r.command===`/${c.name}${s.name?' '+s.name:''}`);assert.equal(entry.description,s.description);assert.deepEqual(entry.orderedInputs,(s.options??[]).map((o:any)=>`${o.name}${o.required?'!':''}: ${o.description}`));}
 for(const c of definitions){assert.ok(c.description.length<=100);for(const s of c.options??[]){assert.ok(s.description.length<=100);for(const o of s.options??[]){assert.ok(o.description.length<=100);for(const choice of o.choices??[])assert.ok(choice.name.length<=100);}}}
 assert.doesNotMatch(JSON.stringify(definitions),/Send order or|Commander:|Recruit\+: edit|Move the organization fund summary|Scan old Trailmark messages|Default: marshal_plus/);
 const sub=(root:string,action:string)=>definitions.find(c=>c.name===root).options.find((s:any)=>s.name===action);
 assert.match(sub('contact','create').description,/Member\+/);assert.match(sub('contact','edit').description,/Advisors\+/);assert.match(sub('funds','deposit').description,/Advanced Member\+/);assert.match(sub('promotion','setup').description,/Discord Administrator/);assert.match(sub('assignment','create').description,/Advisors\+/);
 assert.deepEqual(sub('supply','log').options.map((o:any)=>o.name),['assignment','item','quantity','item_2','quantity_2','item_3','quantity_3','item_4','quantity_4','member','note']);
});
test('all 22 inventoried interaction families reach their production route or safe expiry response',async()=>{
 const cases:[string,string][]=[['setup:1:resume','setup'],['ux:actor:help','roles'],['uxform:missing:0:answer','outdated'],['uxbrowse:missing:0:next','roles'],['uxconfirm:missing:yes','expired'],['member:actor:rank:member:select','roles'],['field:actor:trail:list:','roles'],['intel:actor:contact:list:new','roles'],['bridge:actor:status','roles'],['flow:actor:vote:list:new','roles'],['optional:actor:reference:list:new','roles'],['native:contact-assessment:record:good','roles'],['native:promotion:record:yes','advancement'],['native:briefing-collect','roles'],['native:briefing-form:record','roles'],['native:access','roles'],['native:access-page:0','roles'],['native:trail-report:record','roles'],['native:form:record','native'],['native:ballot:record','workflow'],['native:assignment:record:claim','workflow'],['native:mentorship:record:accept','roles']];
 for(const [customId,expected]of cases){const f=fixture(),trace:string[]=[];const reached=(name:string)=>{trace.push(name);throw Error('boundary '+name);};f.i.customId=customId;f.i.commandName=undefined;f.i.values=['record'];f.i.deferUpdate=async()=>{};f.i.isChatInputCommand=()=>false;f.i.isButton=()=>!customId.startsWith('member:');f.i.isStringSelectMenu=()=>customId.startsWith('member:');f.i.isAnySelectMenu=f.i.isStringSelectMenu;f.i.guild.members.fetch=async()=>reached('roles');f.store.native=async()=>reached('native');f.store.workflow=async()=>reached('workflow');f.store.advancement=async()=>reached('advancement');try{await route(f.i,{handle:async()=>reached('setup')} as any,f.store);}catch(e){assert.match(String(e),/boundary/);}if(['expired','outdated'].includes(expected))assert.match(f.output.content,new RegExp(expected));else assert.ok(trace.includes(expected),customId+' '+trace);}
});
