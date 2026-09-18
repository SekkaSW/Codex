import { PGlite } from '@electric-sql/pglite';
import { readFile,readdir } from 'node:fs/promises';
import type { SupabaseClientLike } from '../src/persistence/supabase.js';
import { emptyOrganization } from '../src/administration.js';
export async function testDatabase(){
 const db=new PGlite();await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 const dir=new URL('../../migrations/',import.meta.url);for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
 const client:SupabaseClientLike={from(){throw new Error('Unexpected table call in RPC test');},async rpc<T>(name:string,args:Record<string,unknown>={}){
  try{if(!/^[a-z_]+$/.test(name)||Object.keys(args).some(k=>!/^p_[a-z_]+$/.test(k)))throw new Error('Invalid test SQL identifier');
   const result=await db.query<{value:T}>(`select ${name}(${Object.keys(args).map((key,index)=>`${key} => $${index+1}`).join(',')}) as value`,Object.values(args));return {data:result.rows[0]!.value,error:null};
  }catch(error){return {data:null,error:{message:String(error),code:(error as {code?:string}).code} as any};}
 }};return {db,client};
}
export const rankA='10000000-0000-4000-8000-000000000001',rankB='10000000-0000-4000-8000-000000000002',branch='10000000-0000-4000-8000-000000000003';
export function fixtureOrganization(guildId='g') {const c=emptyOrganization();c.ranks=[{id:rankA,guildId,name:'First',tier:'BASELINE',roleId:'rank-a'},{id:rankB,guildId,name:'Second',tier:'BASELINE',roleId:'rank-b'}];c.branches=[{id:branch,name:'Branch'}];c.edges=[{guildId,branchId:branch,fromRankId:rankA,toRankId:rankB}];c.permissions=[{guildId,roleId:'voter',tier:'LEVEL_1'},{guildId,roleId:'admin',tier:'LEVEL_3'}];return c;}
export const fixtureConfig=(guildId='g')=>({guildId,organizationName:'Example',commandNamespace:'example',confidentialityMarker:'[CONFIDENTIAL]',modules:{briefings:false,patrols:false,supply:false,atlas:false}});
