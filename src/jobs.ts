import type { ServerConfig } from "./domain.js";
import { AtlasService, TrailmarkService } from "./services.js";
export interface JobGuildAdapter { revokeTrailmark(guildId:string,trailmarkId:string,memberId:string):Promise<void>; grantAtlasAccess(guildId:string,trailmarkId:string,memberId:string):Promise<void>; publishAtlasDrop(guildId:string,trailmarkId:string,payload:unknown):Promise<void> }
export function startBackgroundJobs(configs:()=>Promise<ServerConfig[]>,trailmarks:TrailmarkService,atlas:AtlasService,adapter:JobGuildAdapter):()=>void{
  const expire=setInterval(()=>void trailmarks.expire(undefined,s=>adapter.revokeTrailmark(s.guildId,s.trailmarkId,s.memberId)).catch(console.error),60_000);
  const poll=setInterval(()=>void configs().then(async rows=>{for(const config of rows)if(config.modules.atlas)await atlas.poll(config.guildId,true,r=>adapter.grantAtlasAccess(r.guildId,r.trailmarkId,r.memberId),d=>adapter.publishAtlasDrop(d.guildId,d.trailmarkId,d.payload));}).catch(console.error),5_000);
  return()=>{clearInterval(expire);clearInterval(poll);};
}
