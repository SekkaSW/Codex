import { PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";
import { satisfies, type PermissionRole } from "../../domain.js";
import { FundsService, type LedgerStore } from "../../services.js";
export interface FundsRepositories extends LedgerStore {
    permissionRoles(guildId: string): Promise<PermissionRole[]>;
}
const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export async function handleFunds(interaction: ChatInputCommandInteraction, repositories: FundsRepositories,refreshSummary?:()=>Promise<void>): Promise<void> {
    if (!interaction.guildId)
        throw new Error("Funds commands can only be used in a server.");
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();
    const mutating = new Set(["deposit", "spend", "set-balance", "undo-last", "refresh-summary"]);
    if (mutating.has(subcommand))
        await requireLevel(interaction, repositories, "LEVEL_2");
    const funds = new FundsService(repositories);
    const guildId = interaction.guildId;
    const actorId = interaction.user.id;
    const summary=async()=>{if(refreshSummary)try{await refreshSummary();}catch{throw new Error('The ledger operation completed, but the public summary needs recovery. Use /funds refresh-summary after checking the configured Funds destination.');}};
    if (subcommand === "deposit" || subcommand === "spend") {
        const amount = interaction.options.getNumber("amount", true);
        const note = interaction.options.getString("note", true).trim();
        if (amount <= 0)
            throw new Error("Amount must be greater than zero.");
        if (!note)
            throw new Error("A transaction note is required.");
        const entry = await funds.record(guildId, amount, actorId, note, subcommand === "deposit" ? "DEPOSIT" : "SPEND");
        const balance = await funds.balance(guildId);
        await summary();
        await interaction.editReply({ content: `${subcommand === "deposit" ? "Deposited" : "Spent"} **${money.format(Math.abs(entry.amount))}**. New balance: **${money.format(balance)}**.\nReference: \`${entry.id}\`` });
        return;
    }
    if (subcommand === "set-balance") {
        const target = interaction.options.getNumber("amount", true);
        const note = interaction.options.getString("note", true).trim();
        const entry = await funds.setBalance(guildId, target, actorId, note);
        await summary();
        await interaction.editReply({ content: entry ? `Balance adjusted to **${money.format(target)}**.\nReference: \`${entry.id}\`` : `Balance is already **${money.format(target)}**; no ledger entry was created.` });
        return;
    }
    if (subcommand === "undo-last") {
        const entry = await funds.undoLast(guildId, actorId);
        await summary();
        await interaction.editReply({ content: `Reversed the last unreversed transaction by **${money.format(entry.amount)}**. New balance: **${money.format(await funds.balance(guildId))}**.\nReference: \`${entry.id}\`` });
        return;
    }
    if (subcommand === "balance" || subcommand === "refresh-summary") {
        if(subcommand==='refresh-summary')await summary();
        const content = `Current organization balance: **${money.format(await funds.balance(guildId))}**.`;
        await interaction.editReply({ content: subcommand === "refresh-summary" ? `${content}\nThe summary was refreshed from the persisted ledger.` : content });
        return;
    }
    if (subcommand === "history") {
        const limit = interaction.options.getInteger("limit") ?? 10;
        const rows = (await repositories.history(guildId)).slice(-limit).reverse();
        const content = rows.length ? rows.map(row => `• <t:${Math.floor(Date.parse(row.createdAt) / 1000)}:d> **${signed(row.amount)}** — ${row.note} (<@${row.actorId}>)`).join("\n") : "No fund transactions have been recorded.";
        await interaction.editReply(content.length>1900?{content:"Fund history is attached.",files:[{attachment:Buffer.from(content),name:"fund-history.txt"}],allowedMentions:{parse:[]}}:{content,allowedMentions:{parse:[]}});
        return;
    }
    if (subcommand === "monthly") {
        const now = new Date();
        const year = interaction.options.getInteger("year") ?? now.getUTCFullYear();
        const month = interaction.options.getInteger("month") ?? now.getUTCMonth() + 1;
        const summary = await funds.monthly(guildId, year, month);
        await interaction.editReply({ content: `**Funds summary — ${year}-${String(month).padStart(2, "0")}**\nDeposits: **${money.format(summary.deposits)}**\nSpending: **${money.format(summary.spending)}**\nAdjustments: **${signed(summary.adjustments)}**\nNet: **${signed(summary.net)}**\nTransactions: **${summary.count}**` });
        return;
    }
    throw new Error(`Unsupported funds operation: ${subcommand}`);
}
async function requireLevel(interaction: ChatInputCommandInteraction, repositories: FundsRepositories, tier: "LEVEL_2"): Promise<void> {
    const administrator = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
    const member = interaction.guild ? await interaction.guild.members.fetch(interaction.user.id) : interaction.member;
    const roleIds = member && "roles" in member ? (Array.isArray(member.roles) ? member.roles : [...member.roles.cache.keys()]) : [];
    const liveRoles = await interaction.guild?.roles.fetch();
    const mappings = (await repositories.permissionRoles(interaction.guildId!)).filter(mapping => liveRoles?.has(mapping.roleId));
    if (!satisfies(roleIds, tier, mappings, administrator))
        throw new Error(`${tier} permission or Discord Administrator is required.`);
}
function signed(amount: number): string { return `${amount >= 0 ? "+" : "−"}${money.format(Math.abs(amount))}`; }
