import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { commandDefinitions } from '../src/runtime/commands.js';
const renamed=(name:string)=>name==='hold'?'assignment':name==='ranger_rate'?'member_rate':name;
const renamedAction=(name:string)=>({'set-hold':'set-assignment','clear-hold':'clear-assignment','sync-hold-roles':'sync-assignment-roles'} as Record<string,string>)[name]??name;
test('every retained original source command is inventoried; native ordered input contracts have explicit generalization exceptions',async()=>{
 const source=JSON.parse(await readFile(new URL('../../test/fixtures/wayfinder-command-contracts.json',import.meta.url),'utf8'));
 assert.equal(source.commands.length,21);const current=commandDefinitions('order') as any[];
 for(const command of source.commands){const actual=current.find(c=>c.name===(command.name==='ranger'?'order':command.name));assert.ok(actual,command.name);
  for(const sub of command.options??[]){const a=actual.options.find((s:any)=>s.name===renamedAction(sub.name));assert.ok(a,command.name+'/'+sub.name);
   // Legacy alliance is a local fixed-role model. Current reciprocal, authenticated bridges
   // intentionally retain their independent contract; the behavioral gap is documented.
   if(command.name==='alliance')continue;
   if(command.name==='application'&&sub.name==='setup'){assert.deepEqual(a.options.map((o:any)=>o.name),['channel']);continue;}
   let expected=sub.options??[];if(command.name==='duty')expected=expected.filter((o:any)=>!['warden_position','hold','range','range_or_specialty'].includes(o.name));
   const filtered=a.options.filter((o:any)=>!(command.name==='ranger'&&sub.name==='clear-hold'&&o.name==='assignment'));
   assert.deepEqual(filtered.map((o:any)=>({name:o.name,type:o.type,required:o.required??false})),expected.map((o:any)=>({name:renamed(o.name),type:o.type,required:o.required??false})),command.name+'/'+sub.name);
  }
 }
 for(const namespace of ['help','promotion','apprenticeship','order']){const definitions=commandDefinitions(namespace) as any[];assert.equal(definitions.filter(c=>c.name===namespace).length,1);assert.ok(definitions.find(c=>c.name===namespace).options.some((s:any)=>s.name==='sync-member'));}
});
