import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction, Interaction } from "discord.js";
import type { ServerConfig } from "../domain.js";
import { desiredResources, repairResources, type Registry } from "../resources.js";
import { DiscordProvisioner } from "./discordProvisioner.js";
import { SetupWizard, type SetupStore } from "./setupWizard.js";
import { handleFunds, type FundsRepositories } from "./handlers/funds.js";

export interface RuntimeRepositories extends Registry,SetupStore,FundsRepositories {}
export function createBot(repositories:RuntimeRepositories):Client {
  const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
  const wizard=new SetupWizard(repositories,async(config:ServerConfig)=>{const guild=await client.guilds.fetch(config.guildId);const mappings=await repositories.permissionRoles(config.guildId);const result=await repairResources(config.guildId,desiredResources(config.modules),repositories,new DiscordProvisioner(guild,mappings));return`Provisioned ${result.created.length}; retained ${result.retained.length}.`;});
  client.once(Events.ClientReady,(ready:any)=>console.info(`Codex ready as ${ready.user.tag}`));
  client.on(Events.InteractionCreate,(interaction:any)=>void route(interaction,wizard,repositories,client).catch(async error=>{console.error(error);if(interaction.isRepliable())await(interaction.replied||interaction.deferred?interaction.followUp({content:"Codex could not complete that request.",ephemeral:true}):interaction.reply({content:"Codex could not complete that request.",ephemeral:true}));}));
  return client;
}
async function route(interaction:Interaction,wizard:SetupWizard,repositories:RuntimeRepositories,client:Client):Promise<void>{
  if(interaction.isChatInputCommand()){if(!interaction.guildId)throw new Error("Guild only command");if(interaction.commandName==="ping"){await interaction.reply({content:"Codex is ready.",ephemeral:true});return;}if(interaction.commandName==="server"&&interaction.options.getSubcommand()==="setup"){if(!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))throw new Error("Administrator permission required");await interaction.reply(await wizard.start(interaction.guildId));return;}const config=await repositories.load(interaction.guildId);if(!config)throw new Error("Run /server setup first");if(isDisabled(interaction,config))throw new Error("This optional module is disabled");if(interaction.commandName==="funds"){await handleFunds(interaction,repositories);return;}throw new Error(`/${interaction.commandName} is registered but its production workflow is not implemented yet.`);}
  if(interaction.isButton()&&interaction.guildId&&interaction.customId.startsWith("setup:")){const action=interaction.customId.slice(6);if(action==="cancel"){await interaction.update({content:"Setup cancelled.",components:[]});return;}if(action==="view"){await interaction.reply({content:wizard.view(interaction.guildId),ephemeral:true});return;}if(action==="repair"){const config=await repositories.load(interaction.guildId);if(!config)throw new Error("No configuration to repair");const guild=await client.guilds.fetch(interaction.guildId);const result=await repairResources(interaction.guildId,desiredResources(config.modules),repositories,new DiscordProvisioner(guild,await repositories.permissionRoles(interaction.guildId)));await interaction.reply({content:`Repair created ${result.created.length} missing resources.`,ephemeral:true});return;}await interaction.showModal(wizard.modal(interaction.guildId));return;}
  if(interaction.isModalSubmit()&&interaction.guildId&&interaction.customId.startsWith("setup:stage:")){const values:Record<string,string>={};for(const row of interaction.components)for(const component of row.components)values[component.customId]=component.value;await interaction.reply({...await wizard.submit(interaction.guildId,values),ephemeral:true});}
}
function isDisabled(interaction:ChatInputCommandInteraction,config:ServerConfig):boolean{const map:Record<string,keyof ServerConfig["modules"]>={atlas:"atlas",briefing:"briefings",patrol:"patrols",supply:"supply"};const module=map[interaction.commandName];return Boolean(module&&!config.modules[module]);}
