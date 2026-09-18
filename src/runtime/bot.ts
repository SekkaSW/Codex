import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import type { ServerConfig } from '../domain.js';
import { desiredResources, repairResources, type Registry } from '../resources.js';
import { DiscordProvisioner } from './discordProvisioner.js';
import { SetupWizard, type SetupStore } from './setupWizard.js';
import { handleFunds, type FundsRepositories } from './handlers/funds.js';
import { handleDuty, type DutyRepositories } from './handlers/duty.js';
import { handleMembers, type MemberRepositories } from './handlers/members.js';
import { commandDefinitions } from './commands.js';
import { handleField, type FieldRepositories } from './handlers/field.js';
import { TrailmarkLifecycle } from '../field.js';
import { DiscordTrailmarkAccess } from './trailmarkAccess.js';
import { handleIntelligence,type IntelligenceRepositories } from './handlers/intelligence.js';
import { DiscordIntelligence } from './intelligenceDiscord.js';
import {handleBridge,type BridgeRepositories} from './handlers/bridge.js';
import {BridgeCoordinator} from '../bridge.js';
export interface RuntimeRepositories extends Registry, SetupStore, FundsRepositories, DutyRepositories, MemberRepositories,FieldRepositories,IntelligenceRepositories,BridgeRepositories {
}
export function createBot(repositories: RuntimeRepositories): Client {
    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
    const wizard = new SetupWizard(repositories, async (config: ServerConfig, actorId: string) => {
        const guild = await client.guilds.fetch(config.guildId), organization = await repositories.organization(config.guildId);
        const specs = [...desiredResources(config.modules), ...organization.additionalResources].map(s => s.key === 'ORGANIZATION_CATEGORY' ? { ...s, name: config.organizationName } : s);
        const result = await repairResources(config.guildId, specs, repositories, new DiscordProvisioner(guild, await repositories.permissionRoles(config.guildId)));
        // Register only the organization tree at guild scope. Global generic commands stay intact.
        const definitions = commandDefinitions(config.commandNamespace) as any[];
        const commands = await guild.commands.fetch();
        const owned = commands.filter(c => c.description === 'Persisted organization member administration' && c.name !== 'roster');
        await guild.commands.create(definitions.find(c => c.name === config.commandNamespace));
        for (const command of owned.values())
            if (command.name !== config.commandNamespace)
                await command.delete();
        await repositories.audit(config.guildId, actorId, config.guildId, 'RESOURCES_REPAIRED', result);
        return `Created ${result.created.length}; retained ${result.retained.length}. Organization commands synchronized.`;
    });
    client.once(Events.ClientReady, ready => console.info(`Codex ready as ${ready.user.tag}`));
    // Serialize guild writes in this process, including configuration and member role mutations.
    const pending = new Map<string, Promise<void>>();
    const intelligencePages=new Map<string,number>();
    client.on(Events.MessageCreate,message=>{
        if(!message.guildId||!message.guild||!message.author.bot||message.author.id===client.user?.id)return;
        const key=message.guildId;
        const work=(pending.get(key)??Promise.resolve()).then(async()=>{const config=await repositories.load(key);if(!config)return;const id=await new BridgeCoordinator(repositories).ingest(key,message.channelId,message.webhookId??message.author.id,message.id,message.content,config.confidentialityMarker);if(id)await new DiscordIntelligence(message.guild,repositories).pipeline.process(key,id);}).catch(error=>console.error('Bridge intake rejected or requires recovery',key,error instanceof Error?error.message:'Intake failure'));
        pending.set(key,work);void work.finally(()=>{if(pending.get(key)===work)pending.delete(key);});
    });
    client.once(Events.ClientReady,()=>{
        let running=false;
        const tick=async()=>{if(running)return;running=true;try{for(const guild of client.guilds.cache.values()){
            if(pending.has(guild.id))continue;
            const work=(async()=>{if(!await repositories.load(guild.id))return;const result=await new TrailmarkLifecycle(repositories,new DiscordTrailmarkAccess(guild,repositories)).reconcile(guild.id,client.user!.id);if(result.failures.length)console.error('Trailmark reconciliation requires retry',guild.id,result.failures);const page=intelligencePages.get(guild.id)??0;const intel=await new DiscordIntelligence(guild,repositories).pipeline.batch(guild.id,page);intelligencePages.set(guild.id,intel.processed+intel.failures.length===0?0:page+1);if(intel.failures.length)console.error('Intelligence recovery requires retry',guild.id,intel.failures);const config=await repositories.load(guild.id);if(config)await new BridgeCoordinator(repositories).drain(guild.id,config.confidentialityMarker);})().catch(error=>console.error('Field recovery failed',guild.id,error));
            pending.set(guild.id,work);await work;if(pending.get(guild.id)===work)pending.delete(guild.id);
        }}finally{running=false;}};
        const timer=setInterval(()=>void tick(),30_000);timer.unref();void tick();
    });
    client.on(Events.InteractionCreate, i => {
        const key = i.guildId ?? i.id;
        if (pending.has(key)) {
            if (i.isRepliable())
                void i.reply({ content: 'A Codex operation is still running for this server. Retry when it finishes.', ephemeral: true }).catch(console.error);
            return;
        }
        const run = (pending.get(key) ?? Promise.resolve()).then(async () => {
            await route(i, wizard, repositories);
            if (!i.guildId || !i.isRepliable() || !i.replied)
                return;
            try {
                const destination = (await repositories.list(i.guildId)).find(r => r.key === 'BOT_LOGS');
                if (!destination)
                    return;
                const channel = await i.guild?.channels.fetch(destination.discordId);
                if (!channel || !channel.isTextBased() || !('send' in channel))
                    throw new Error('Configured log destination is unavailable');
                const action = i.isChatInputCommand() ? `/${i.commandName} ${i.options.getSubcommand(false) ?? ''}` : 'administration interaction';
                await channel.send({ content: `Codex: ${action} completed by ${i.user.id}. Detailed mutation records remain in the private database audit.`, allowedMentions: { parse: [] } });
            }
            catch (logError) {
                console.error('Codex log delivery failed', logError);
                await i.followUp({ content: 'The operation completed, but delivery to the configured log channel failed. An administrator should check its stored destination and bot permissions.', ephemeral: true });
            }
        }).catch(async (error) => {
            console.error(error);
            if (!i.isRepliable())
                return;
            const payload = { content: (error instanceof Error ? error.message : 'Codex could not complete this request.').slice(0, 1900), ephemeral: true, allowedMentions: { parse: [] as never[] } };
            try {
                if (i.deferred)
                    await i.editReply(payload);
                else if (i.replied)
                    await i.followUp(payload);
                else
                    await i.reply(payload);
            }
            catch (replyError) {
                console.error(replyError);
            }
        });
        pending.set(key, run);
        void run.finally(() => { if (pending.get(key) === run)
            pending.delete(key); });
    });
    return client;
}
export async function route(i: any, wizard: SetupWizard, repositories: RuntimeRepositories): Promise<void> {
    if (!i.guildId)
        throw new Error('Use Codex inside a server');
    if((i.isButton()||i.isAnySelectMenu()||i.isModalSubmit())&&i.customId.startsWith('bridge:')){await handleBridge(i,repositories);return;}
    if((i.isButton()||i.isAnySelectMenu()||i.isModalSubmit())&&i.customId.startsWith('intel:')){await handleIntelligence(i,repositories);return;}
    if((i.isButton()||i.isAnySelectMenu()||i.isModalSubmit())&&i.customId.startsWith('field:')){await handleField(i,repositories);return;}
    if ((i.isButton() || i.isAnySelectMenu() || i.isModalSubmit()) && i.customId.startsWith('setup:')) {
        await wizard.handle(i);
        return;
    }
    if (i.isStringSelectMenu() && i.customId.startsWith('member:')) {
        await handleMembers(i, repositories);
        return;
    }
    if (!i.isChatInputCommand())
        return;
    if (i.commandName === 'ping') {
        await i.reply({ content: 'Codex is ready.', ephemeral: true });
        return;
    }
    if (i.commandName === 'server') {
        if (!i.memberPermissions?.has(PermissionFlagsBits.Administrator))
            throw new Error('Discord Administrator permission required');
        await i.deferReply({ ephemeral: true });
        const payload = await wizard.start(i.guildId, i.user.id);
        delete payload.ephemeral;
        await i.editReply(payload);
        return;
    }
    const config = await repositories.load(i.guildId);
    if (!config)
        throw new Error('Run /server setup first');
    const commandDestination = (await repositories.list(i.guildId)).find(r => r.key === 'BOT_COMMANDS');
    if (commandDestination && i.channelId !== commandDestination.discordId && !i.memberPermissions?.has(PermissionFlagsBits.Administrator))
        throw new Error(`Use Codex commands in <#${commandDestination.discordId}>. An administrator can update this destination in /server setup.`);
    const modules: Record<string, keyof ServerConfig['modules']> = { atlas: 'atlas', briefing: 'briefings', patrol: 'patrols', supply: 'supply' };
    const module = modules[i.commandName];
    if (module && !config.modules[module])
        throw new Error('This optional module is disabled');
    if (i.commandName === 'funds') {
        await handleFunds(i, repositories);
        return;
    }
    if (i.commandName === 'duty') {
        await handleDuty(i, repositories);
        return;
    }
    if(i.commandName==='advancement'||i.commandName==='trailmark'){await handleField(i,repositories);return;}
    if(i.commandName==='intel'||i.commandName==='contact'){await handleIntelligence(i,repositories);return;}
    if(i.commandName==='alliance'){await handleBridge(i,repositories);return;}
    if (i.commandName === 'roster' || i.commandName === config.commandNamespace || (i.commandName === 'assignment' && ['set-member', 'clear-member', 'sync-roles'].includes(i.options.getSubcommand()))) {
        await handleMembers(i, repositories);
        return;
    }
    throw new Error(`/${i.commandName} is registered but its production workflow is not implemented yet.`);
}
