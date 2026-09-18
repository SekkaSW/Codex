import { ChannelType, PermissionFlagsBits } from "discord.js";
import type { Guild } from "discord.js";
import type { PermissionRole } from "../domain.js";
import type { ManagedResource, Provisioner, ResourceSpec } from "../resources.js";
export class DiscordProvisioner implements Provisioner {
    constructor(private readonly guild: Guild, private readonly mappings: PermissionRole[]) { }
    async exists(id: string): Promise<boolean> { try {
        return Boolean(await this.guild.channels.fetch(id));
    }
    catch (error) {
        if ((error as {
            code?: number;
        }).code === 10003)
            return false;
        throw error;
    } }
    async create(spec: ResourceSpec, parentId?: string,recoveryToken?:string): Promise<string> { const type = spec.kind === "CATEGORY" ? ChannelType.GuildCategory : spec.kind === "FORUM" ? ChannelType.GuildForum : ChannelType.GuildText; const overwrites = await this.overwrites(spec); const channel = await this.guild.channels.create({ name: spec.name, type,...(recoveryToken&&spec.kind!=='CATEGORY'?{topic:`codex-resource:${this.guild.id}:${recoveryToken}`} : {}), ...(parentId ? { parent: parentId } : {}), ...(overwrites ? { permissionOverwrites: overwrites } : {}) }); return channel.id; }
    async recover(spec:ResourceSpec,recoveryToken:string):Promise<string|undefined>{if(spec.kind==='CATEGORY')return undefined;const matches=(await this.guild.channels.fetch()).filter(c=>!!c&&'topic'in c&&c.topic===`codex-resource:${this.guild.id}:${recoveryToken}`);if(matches.size>1)throw new Error('Duplicate resource recovery tokens require explicit administrator binding');return matches.first()?.id;}
    async restorePermissions(resource: ManagedResource, spec: ResourceSpec): Promise<void> { const overwrites = await this.overwrites(spec); if (!overwrites)
        return; const channel = await this.guild.channels.fetch(resource.discordId); if (!channel || !("permissionOverwrites" in channel))
        throw new Error('Managed resource cannot receive permission overwrites'); await (channel as any).permissionOverwrites.set(overwrites); }
    private async overwrites(spec: ResourceSpec): Promise<any[] | undefined> { if (!spec.minimumTier)
        return undefined; const roles = await this.guild.roles.fetch(); const allowed = this.mappings.filter(mapping => roles.has(mapping.roleId) && tierValue(mapping.tier) >= tierValue(spec.minimumTier!)).map(mapping => ({ id: mapping.roleId, allow: [PermissionFlagsBits.ViewChannel] })); const bot = await this.guild.members.fetchMe(); return [{ id: this.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }, ...allowed, { id: bot.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] }]; }
}
function tierValue(tier: string): number { return ["BASELINE", "LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"].indexOf(tier); }
