import { REST, Routes } from 'discord.js';
import { registrationPlan } from './registration.js';
const token=process.env.DISCORD_TOKEN,applicationId=process.env.DISCORD_APPLICATION_ID,guildId=process.env.DISCORD_GUILD_ID,namespace=process.env.ORGANIZATION_NAMESPACE;
const definitions=registrationPlan(guildId,namespace);
if(!token||!applicationId)throw new Error('DISCORD_TOKEN and DISCORD_APPLICATION_ID are required');
const rest=new REST({version:'10'}).setToken(token);
const route=guildId?Routes.applicationGuildCommands(applicationId,guildId):Routes.applicationCommands(applicationId);
for(const body of definitions)await rest.post(route,{body});
console.info(`Upserted ${definitions.length} commands ${guildId?'for the selected guild':'globally'}. Other command registrations were preserved.`);
