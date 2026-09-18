declare module "discord.js" {
  export const SlashCommandBuilder:any,ActionRowBuilder:any,ButtonBuilder:any,ButtonStyle:any,ModalBuilder:any,TextInputBuilder:any,TextInputStyle:any,ChannelType:any,PermissionFlagsBits:any,Events:any,GatewayIntentBits:any,REST:any,Routes:any;
  export class Client { constructor(options:any); guilds:any; once(...args:any[]):any; on(...args:any[]):any; login(token:string):Promise<any> }
  export type Guild=any; export type Interaction=any; export type ChatInputCommandInteraction=any;
}
declare module "@supabase/supabase-js" { export function createClient(url:string,key:string,options?:any):any; }
declare const process: { env: Record<string,string|undefined> };
