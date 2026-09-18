import { createClient } from "@supabase/supabase-js";
import { createBot } from "./bot.js";
import { SupabaseRepositories } from "../persistence/supabase.js";
const token=process.env.DISCORD_TOKEN,url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!token||!url||!key)throw new Error("DISCORD_TOKEN, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required");
const base=new SupabaseRepositories(createClient(url,key,{auth:{persistSession:false}}) as any);
const repositories=Object.assign(base,{load:(guildId:string)=>base.server(guildId),save:(config:any)=>base.saveServer(config),async permissionRoles(guildId:string){const result=await(createClient(url,key) as any).from("permission_roles").select().eq("guild_id",guildId);if(result.error)throw result.error;return result.data.map((row:any)=>({guildId:row.guild_id,roleId:row.discord_role_id,tier:row.tier}));}});
await createBot(repositories).login(token);
