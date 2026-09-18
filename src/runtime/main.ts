import { createClient } from "@supabase/supabase-js";
import { createBot } from "./bot.js";
import { SupabaseRepositories } from "../persistence/supabase.js";
const token=process.env.DISCORD_TOKEN,url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!token||!url||!key)throw new Error("DISCORD_TOKEN, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required");
const base=new SupabaseRepositories(createClient(url,key,{auth:{persistSession:false}}) as any);
// Keep StrongboxStore.save intact: setup uses saveOrganization, not this legacy alias.
const repositories=Object.assign(base,{load:(guildId:string)=>base.server(guildId)});
await createBot(repositories).login(token);
