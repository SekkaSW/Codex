import { SlashCommandBuilder } from "discord.js";

const subcommands: Record<string,string[]> = {
  trailmark:["panel","leave","list","sessions","create","edit","deactivate","set-atlas","clear-atlas","report"],
  atlas:["link","unlink","status"], roster:["info","assignments","audit","inactive-review","sync-member","sync-all","status","retire-left","note"],
  recruit:["invite","welcome"], funds:["deposit","spend","set-balance","refresh-summary","balance","history","undo-last","monthly"],
  intel:["set-hq","topic-add","topic-edit","topic-list","catchall-set","catchall-clear","refresh","repair-reporters","backfill"],
  strongbox:["submit","history"], reference:["get","list"], supply:["create","log","undo-last","redistribute","status","contributors","refresh","close","reopen","cancel"],
  duty:["assign","remove","list"], application:["apply","withdraw","list","setup"], apprenticeship:["looking-for","withdraw-looking","propose","sponsor","assign","end","info","requests"],
  contact:["setup","repair","create","create-group","edit","list","link-member","unlink-member","archive"], vote:["open","close","audit"], briefing:["setup","send","settings"],
  assignment:["open","claim","close","cancel","set-member","clear-member","sync-roles"], patrol:["suggest","list","resolve"], alliance:["setup","sync","status","group-add","group-topics","group-remove","headquarters-remove"]
};
export const genericCommandNames = ["ping","server",...Object.keys(subcommands)] as const;
export function commandDefinitions(namespace?: string): unknown[] {
  const commands: any[]=[new SlashCommandBuilder().setName("ping").setDescription("Check Codex availability")];
  commands.push(new SlashCommandBuilder().setName("server").setDescription("Configure this Codex server").setDefaultMemberPermissions("8").addSubcommand((s:any)=>s.setName("setup").setDescription("Start or resume the setup wizard")));
  for(const [name,subs] of Object.entries(subcommands)){
    if(name==="funds"){commands.push(fundsCommand());continue;}
    const command=new SlashCommandBuilder().setName(name).setDescription(`${name[0]!.toUpperCase()}${name.slice(1)} operations`);for(const sub of subs)command.addSubcommand((s:any)=>s.setName(sub).setDescription(`${sub.replaceAll("-"," ")} operation`));commands.push(command);
  }
  if(namespace){const command=new SlashCommandBuilder().setName(namespace).setDescription("Organization member management");for(const sub of ["info","assignments","audit","inactive-review","sync-member","sync-all","sync-join-history","status","retire-left","note","promote"])command.addSubcommand((s:any)=>s.setName(sub).setDescription(`${sub.replaceAll("-"," ")} member operation`));commands.push(command);}
  return commands.map(command=>command.toJSON());
}

function fundsCommand(): any {
  const command=new SlashCommandBuilder().setName("funds").setDescription("Manage the organization ledger");
  for(const name of ["deposit","spend"] as const) command.addSubcommand((sub:any)=>sub.setName(name).setDescription(`${name} organization funds`).addNumberOption((option:any)=>option.setName("amount").setDescription("Positive transaction amount").setRequired(true).setMinValue(0.01)).addStringOption((option:any)=>option.setName("note").setDescription("Auditable reason for the transaction").setRequired(true).setMaxLength(500)));
  command.addSubcommand((sub:any)=>sub.setName("set-balance").setDescription("Adjust the ledger to a specific balance").addNumberOption((option:any)=>option.setName("amount").setDescription("New ledger balance").setRequired(true)).addStringOption((option:any)=>option.setName("note").setDescription("Auditable reason for the adjustment").setRequired(true).setMaxLength(500)));
  command.addSubcommand((sub:any)=>sub.setName("balance").setDescription("Show the current balance"));
  command.addSubcommand((sub:any)=>sub.setName("history").setDescription("Show recent ledger transactions").addIntegerOption((option:any)=>option.setName("limit").setDescription("Transactions to show").setMinValue(1).setMaxValue(25)));
  command.addSubcommand((sub:any)=>sub.setName("undo-last").setDescription("Reverse the most recent unreversed transaction"));
  command.addSubcommand((sub:any)=>sub.setName("monthly").setDescription("Summarize a UTC calendar month").addIntegerOption((option:any)=>option.setName("year").setDescription("Four-digit year").setMinValue(1970).setMaxValue(9999)).addIntegerOption((option:any)=>option.setName("month").setDescription("Month number").setMinValue(1).setMaxValue(12)));
  command.addSubcommand((sub:any)=>sub.setName("refresh-summary").setDescription("Refresh the ledger summary"));
  return command;
}
