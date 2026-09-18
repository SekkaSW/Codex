import { ChannelType, PermissionFlagsBits } from "discord.js";
import type { Guild } from "discord.js";
import type { PermissionRole } from "../domain.js";
import type { ManagedResource, Provisioner, ResourceSpec } from "../resources.js";

export class DiscordProvisioner implements Provisioner {
  constructor(private readonly guild:Guild,private readonly mappings:PermissionRole[]){}
  async exists(id:string):Promise<boolean>{return Boolean(await this.guild.channels.fetch(id).catch(()=>null));}
  async create(spec:ResourceSpec,parentId?:string):Promise<string>{const type=spec.kind==="CATEGORY"?ChannelType.GuildCategory:spec.kind==="FORUM"?ChannelType.GuildForum:ChannelType.GuildText;const channel=await this.guild.channels.create({name:spec.name,type,...(parentId?{parent:parentId}:{})});return channel.id;}
  async restorePermissions(resource:ManagedResource,spec:ResourceSpec):Promise<void>{const minimum=spec.minimumTier;if(!minimum)return;const channel=await this.guild.channels.fetch(resource.discordId);if(!channel||!("permissionOverwrites" in channel))return;const allowed=this.mappings.filter(mapping=>tierValue(mapping.tier)>=tierValue(minimum)).map(mapping=>({id:mapping.roleId,allow:[PermissionFlagsBits.ViewChannel]}));await (channel as any).permissionOverwrites.set([{id:this.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},...allowed]);}
}
function tierValue(tier:string):number{return["BASELINE","LEVEL_1","LEVEL_2","LEVEL_3","LEVEL_4"].indexOf(tier);}
