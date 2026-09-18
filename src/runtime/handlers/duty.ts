import { PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { satisfies, type DutyRole, type PermissionRole } from "../../domain.js";

export interface DutyRepositories {
  permissionRoles(guildId:string):Promise<PermissionRole[]>;
  dutyRoles(guildId:string):Promise<DutyRole[]>;
  memberDuties(guildId:string,memberId:string):Promise<DutyRole[]>;
  addMemberDuty(guildId:string,memberId:string,roleId:string):Promise<void>;
  removeMemberDuty(guildId:string,memberId:string,roleId:string):Promise<boolean>;
  audit(guildId:string,actorId:string,subjectId:string,eventType:string,detail:Record<string,unknown>):Promise<void>;
}

export async function handleDuty(interaction:ChatInputCommandInteraction,repositories:DutyRepositories):Promise<void>{
  const guildId=interaction.guildId;if(!guildId||!interaction.guild)throw new Error("Duty commands can only be used in a server");
  const actor=interaction.member as any;const mappings=await repositories.permissionRoles(guildId);
  if(!satisfies(actor.roles.cache.keys(),"LEVEL_3",mappings,interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)??false))throw new Error("LEVEL_3 or Discord Administrator permission is required");
  const sub=interaction.options.getSubcommand();const target=interaction.options.getMember("member") as any;
  if(sub==="list"){
    const member=target??actor;const duties=await repositories.memberDuties(guildId,member.id);
    await interaction.reply({content:`Duties for <@${member.id}>: ${duties.length?duties.map(d=>`<@&${d.roleId}>`).join(", "):"none"}.`,ephemeral:true});return;
  }
  if(!target)throw new Error("Select a server member");const role=interaction.options.getRole("role");if(!role)throw new Error("Select a duty role");
  const configured=(await repositories.dutyRoles(guildId)).find(item=>item.roleId===role.id);if(!configured)throw new Error("That role is not configured as a duty");
  if(!interaction.guild.roles.cache.has(role.id))throw new Error("The configured duty role was deleted; update duty configuration");
  if(sub==="assign"){
    if((await repositories.memberDuties(guildId,target.id)).some(item=>item.roleId===role.id))throw new Error("That member already has this duty");
    await repositories.addMemberDuty(guildId,target.id,role.id);
    try{await target.roles.add(role.id,"Codex duty assignment");}catch(error){await repositories.removeMemberDuty(guildId,target.id,role.id);throw new Error(`Discord could not add the duty role. Check the bot role hierarchy. ${String(error)}`);}
    await repositories.audit(guildId,interaction.user.id,target.id,"DUTY_ASSIGNED",{roleId:role.id});await interaction.reply({content:`Assigned ${role} to ${target}.`,ephemeral:true});return;
  }
  const existing=(await repositories.memberDuties(guildId,target.id)).some(item=>item.roleId===role.id);if(!existing)throw new Error("That member does not have this duty");
  await target.roles.remove(role.id,"Codex duty removal");const removed=await repositories.removeMemberDuty(guildId,target.id,role.id);if(!removed)throw new Error("Duty persistence changed during removal; run member synchronization");await repositories.audit(guildId,interaction.user.id,target.id,"DUTY_REMOVED",{roleId:role.id});await interaction.reply({content:`Removed ${role} from ${target}.`,ephemeral:true});
}
