import { SlashCommandBuilder } from "discord.js";
const subcommands: Record<string, string[]> = {
    advancement: ['setup','eligible','status','open','close','approve','deny','ballots'],
    trailmark: ["panel", "leave", "list", "sessions", "create", "edit", "deactivate", "set-atlas", "clear-atlas", "report"],
    atlas: ["link", "unlink", "status"], roster: ["info", "assignments", "audit", "inactive-review", "sync-member", "sync-all", "status", "retire-left", "note"],
    recruit: ["invite", "welcome"], funds: ["deposit", "spend", "set-balance", "refresh-summary", "balance", "history", "undo-last", "monthly"],
    intel: ["set-hq", "topic-add", "topic-edit", "topic-list", "catchall-set", "catchall-clear", "refresh", "repair-reporters", "backfill"],
    strongbox: ["submit", "history"], reference: ["get", "list"], supply: ["create", "log", "undo-last", "redistribute", "status", "contributors", "refresh", "close", "reopen", "cancel"],
    duty: ["assign", "remove", "list"], application: ["apply", "withdraw", "list", "setup"], apprenticeship: ["looking-for", "withdraw-looking", "propose", "sponsor", "assign", "end", "info", "requests"],
    contact: ["setup", "repair", "create", "create-group", "edit", "list", "link-member", "unlink-member", "archive"], vote: ["open", "close", "audit"], briefing: ["setup", "send", "settings"],
    assignment: ["open", "claim", "close", "cancel", "set-member", "clear-member", "sync-roles"], patrol: ["suggest", "list", "resolve"], alliance: ["setup", "sync", "status", "group-add", "group-topics", "group-remove", "headquarters-remove"]
};
export const genericCommandNames = ["ping", "server", ...Object.keys(subcommands)] as const;
export function commandDefinitions(namespace?: string): unknown[] {
    const commands: any[] = [new SlashCommandBuilder().setName("ping").setDescription("Check Codex availability")];
    commands.push(new SlashCommandBuilder().setName("server").setDescription("Configure this Codex server").setDefaultMemberPermissions("8").addSubcommand((s: any) => s.setName("setup").setDescription("Start or resume the setup wizard")));
    for (const [name, subs] of Object.entries(subcommands)) {
        if(name==='alliance'){const c=new SlashCommandBuilder().setName(name).setDescription('Authorized cross-server intelligence bridges');for(const action of [...subs,'archive-category'])c.addSubcommand((s:any)=>{s.setName(action).setDescription(action.replaceAll('-',' '));if(action==='archive-category')s.addChannelOption((o:any)=>o.setName('category').setDescription('Legacy category to retain with staff-only access').setRequired(true).addChannelTypes(4));if(action==='setup'){for(const key of ['name','remote'])s.addStringOption((o:any)=>o.setName(key).setDescription(key==='name'?'Remote organization name':'Remote Discord server ID').setRequired(true).setMaxLength(100));s.addStringOption((o:any)=>o.setName('protocol').setDescription('Bridge protocol').setRequired(true).addChoices({name:'Native Codex',value:'codex-v1'},{name:'Legacy intake',value:'legacy-wayfinder'}));s.addChannelOption((o:any)=>o.setName('intake').setDescription('Legacy intake text channel').addChannelTypes(0));s.addUserOption((o:any)=>o.setName('sender').setDescription('Trusted legacy bot sender'));}return s;});commands.push(c);continue;}
        if(name==='intel'||name==='contact'){commands.push(intelligenceCommand(name));continue;}
        if(name==='advancement'||name==='trailmark'){commands.push(fieldCommand(name));continue;}
        if (name === "funds") {
            commands.push(fundsCommand());
            continue;
        }
        if (name === "duty") {
            commands.push(dutyCommand());
            continue;
        }
        if (name === 'roster') {
            commands.push(memberCommand('roster'));
            continue;
        }
        if (name === 'assignment') {
            const command = new SlashCommandBuilder().setName(name).setDescription('Assignment board and member administration');
            for (const sub of subs)
                command.addSubcommand((s: any) => { s.setName(sub).setDescription(sub.replaceAll('-', ' ')); if (['set-member', 'clear-member', 'sync-roles'].includes(sub))
                    s.addUserOption((o: any) => o.setName('member').setDescription('Server member').setRequired(true)); return s; });
            commands.push(command);
            continue;
        }
        const command = new SlashCommandBuilder().setName(name).setDescription(`${name[0]!.toUpperCase()}${name.slice(1)} operations`);
        for (const sub of subs)
            command.addSubcommand((s: any) => s.setName(sub).setDescription(`${sub.replaceAll("-", " ")} operation`));
        commands.push(command);
    }
    if (namespace) {
        if (genericCommandNames.includes(namespace as any))
            throw new Error('Organization namespace conflicts with a core command');
        commands.push(memberCommand(namespace));
    }
    return commands.map(command => command.toJSON());
}
function intelligenceCommand(name:string):any {
 const c=new SlashCommandBuilder().setName(name).setDescription('Intelligence reports and local Contacts');
 const names=name==='intel'?[...subcommands.intel!,'reports','deliver','link-report','recover-delivery']:[...subcommands.contact!,'group-members'];
 for(const action of names)c.addSubcommand((s:any)=>{s.setName(action).setDescription(action.replaceAll('-',' '));if(action==='catchall-set')s.addChannelOption((o:any)=>o.setName('channel').setDescription('Local catch-all text channel').setRequired(true).addChannelTypes(0));if(action==='backfill'||action==='repair')s.addIntegerOption((o:any)=>o.setName('page').setDescription('Batch page, starting at zero').setMinValue(0));if(action==='recover-delivery')for(const key of ['key','message'])s.addStringOption((o:any)=>o.setName(key).setDescription(key==='key'?'Delivery key from recovery error':'Original bot message ID').setRequired(true).setMaxLength(150));return s;});return c;
}
function fieldCommand(name:string):any {
 const c=new SlashCommandBuilder().setName(name).setDescription(name==='advancement'?'Advancement cases and ballots':'Trailmark access and field information');
 const names=name==='advancement'?['setup','eligible','status','open','close','approve','deny','ballots']:['panel','leave','list','sessions','create','edit','deactivate','set-atlas','clear-atlas','report','hq','repair','configure'];
 for(const action of names)c.addSubcommand((s:any)=>{s.setName(action).setDescription(action.replaceAll('-',' '));if(name==='advancement'&&['open','eligible'].includes(action))s.addUserOption((o:any)=>o.setName('member').setDescription('Candidate').setRequired(true));if(name==='advancement'&&action==='setup'){s.addStringOption((o:any)=>o.setName('voter-tier').setDescription('Minimum voter permission tier').setRequired(true).addChoices(...['BASELINE','LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4'].map(v=>({name:v,value:v}))));s.addIntegerOption((o:any)=>o.setName('minimum-yes').setDescription('Minimum affirmative votes; majority is also required').setRequired(true).setMinValue(1).setMaxValue(10000));}return s;});return c;
}
function memberCommand(name: string): any {
    const command = new SlashCommandBuilder().setName(name).setDescription('Persisted organization member administration');
    for (const sub of ['info', 'export', 'assignments', 'audit', 'inactive-review', 'sync-member', 'sync-all', 'sync-join-history', 'status', 'retire-left', 'note', 'notes', 'promote', 'rank'])
        command.addSubcommand((s: any) => {
            s.setName(sub).setDescription(`${sub.replaceAll('-', ' ')} member records`);
            if (!['export', 'inactive-review', 'sync-all', 'retire-left'].includes(sub))
                s.addUserOption((o: any) => o.setName('member').setDescription('Member').setRequired(sub !== 'info'));
            if (sub === 'status')
                s.addStringOption((o: any) => o.setName('value').setDescription('Membership status').setRequired(true).addChoices(...['ACTIVE', 'INACTIVE', 'RETIRED', 'LEFT'].map(value => ({ name: value, value }))));
            if (sub === 'note') {
                s.addStringOption((o: any) => o.setName('body').setDescription('Authored note').setRequired(true).setMaxLength(2000));
                s.addStringOption((o: any) => o.setName('visibility').setDescription('Intended audience; retrieval remains administrator-only').addChoices({ name: 'Administrator', value: 'ADMIN' }, { name: 'Member', value: 'MEMBER' }));
            }
            if (['status', 'sync-member', 'sync-join-history'].includes(sub))
                s.addStringOption((o: any) => o.setName('reason').setDescription('Audit reason').setMaxLength(500));
            return s;
        });
    return command;
}
function dutyCommand(): any {
    const command = new SlashCommandBuilder().setName("duty").setDescription("Manage configured organization duties");
    for (const name of ["assign", "remove"] as const)
        command.addSubcommand((sub: any) => sub.setName(name).setDescription(`${name} a configured duty`).addUserOption((o: any) => o.setName("member").setDescription("Server member").setRequired(true)).addRoleOption((o: any) => o.setName("role").setDescription("Configured duty role").setRequired(true)));
    command.addSubcommand((sub: any) => sub.setName("list").setDescription("List a member's duties").addUserOption((o: any) => o.setName("member").setDescription("Member; defaults to you")));
    return command;
}
function fundsCommand(): any {
    const command = new SlashCommandBuilder().setName("funds").setDescription("Manage the organization ledger");
    for (const name of ["deposit", "spend"] as const)
        command.addSubcommand((sub: any) => sub.setName(name).setDescription(`${name} organization funds`).addNumberOption((option: any) => option.setName("amount").setDescription("Positive transaction amount").setRequired(true).setMinValue(0.01)).addStringOption((option: any) => option.setName("note").setDescription("Auditable reason for the transaction").setRequired(true).setMaxLength(500)));
    command.addSubcommand((sub: any) => sub.setName("set-balance").setDescription("Adjust the ledger to a specific balance").addNumberOption((option: any) => option.setName("amount").setDescription("New ledger balance").setRequired(true)).addStringOption((option: any) => option.setName("note").setDescription("Auditable reason for the adjustment").setRequired(true).setMaxLength(500)));
    command.addSubcommand((sub: any) => sub.setName("balance").setDescription("Show the current balance"));
    command.addSubcommand((sub: any) => sub.setName("history").setDescription("Show recent ledger transactions").addIntegerOption((option: any) => option.setName("limit").setDescription("Transactions to show").setMinValue(1).setMaxValue(25)));
    command.addSubcommand((sub: any) => sub.setName("undo-last").setDescription("Reverse the most recent unreversed transaction"));
    command.addSubcommand((sub: any) => sub.setName("monthly").setDescription("Summarize a UTC calendar month").addIntegerOption((option: any) => option.setName("year").setDescription("Four-digit year").setMinValue(1970).setMaxValue(9999)).addIntegerOption((option: any) => option.setName("month").setDescription("Month number").setMinValue(1).setMaxValue(12)));
    command.addSubcommand((sub: any) => sub.setName("refresh-summary").setDescription("Refresh the ledger summary"));
    return command;
}
