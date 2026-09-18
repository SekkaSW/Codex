import { REST, Routes } from "discord.js";
import { commandDefinitions } from "./commands.js";
const token=process.env.DISCORD_TOKEN,applicationId=process.env.DISCORD_APPLICATION_ID,guildId=process.env.DISCORD_GUILD_ID,namespace=process.env.ORGANIZATION_NAMESPACE;
if(!token||!applicationId)throw new Error("DISCORD_TOKEN and DISCORD_APPLICATION_ID are required");
const rest=new REST({version:"10"}).setToken(token);const body=commandDefinitions(namespace);
await rest.put(guildId?Routes.applicationGuildCommands(applicationId,guildId):Routes.applicationCommands(applicationId),{body});
console.info(`Deployed ${body.length} commands${guildId?` to guild ${guildId}`:" globally"}.`);
