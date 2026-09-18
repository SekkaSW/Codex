import { commandInteraction, projectInteraction } from './panels.js';
import { commandDefinitions } from './commands.js';
import type { RuntimeRepositories } from './bot.js';

type Pending = { guild: string; owner: string; expires: number; command?: string; sub?: string; options?: any; fields?: any; customId?: string; values?: string[]; check?: () => Promise<void>; kind: 'button' | 'select' | 'command' | 'modal' };
const pending = new Map<string, Pending>();
const confirmed = new WeakSet<object>();
const componentActions = new Set(['deactivate', 'approve', 'deny', 'close', 'cancel', 'process', 'reject', 'archive', 'end', 'withdraw', 'withdraw-looking', 'clear-atlas', 'repair', 'clear-member', 'headquarters-remove', 'undo-last']);

export function needsConfirmation(i: any): boolean {
    if (confirmed.has(i)) return false;
    if (i.isChatInputCommand()) {
        const action = i.options.getSubcommand(false);
        return (i.commandName === 'funds' && ['set-balance', 'undo-last'].includes(action)) || (i.commandName === 'atlas' && action === 'unlink') ||
            (i.commandName === 'intel' && ['catchall-clear', 'refresh', 'repair-reporters', 'backfill'].includes(action)) || (i.commandName === 'contact' && ['setup', 'repair'].includes(action)) ||
            (i.commandName === 'alliance' && action === 'archive-category') || action === 'retire-left' || (i.commandName === 'duty' && action === 'remove') || (['roster'].includes(i.commandName) && action === 'status');
    }
    const parts = i.customId?.split(':') ?? [];
    if (parts[0] === 'bridge' && parts[2] === 'remove' && i.isModalSubmit()) return true;
    if (parts[0] === 'setup' || parts.includes('page') || !i.values?.length) return false;
    const action = ['member', 'bridge'].includes(parts[0]) ? parts[2] : parts[3];
    return componentActions.has(action);
}
export async function askConfirmation(i: any, store?: RuntimeRepositories): Promise<void> {
    for (const [key, item] of pending) if (item.expires < Date.now()) pending.delete(key);
    if (pending.size >= 5000) pending.delete(pending.keys().next().value!);
    const key = crypto.randomUUID(), command = i.isChatInputCommand();
    pending.set(key, { guild: i.guildId, owner: i.user.id, expires: Date.now() + 10 * 60000, kind: command ? 'command' : i.isModalSubmit() ? 'modal' : i.isAnySelectMenu() ? 'select' : 'button', ...(command ? { command: i.commandName, sub: i.options.getSubcommand(), options: i.options } : { customId: i.customId, values: [...(i.values ?? [])], ...(i.isModalSubmit() ? { fields: i.fields } : {}) }) });
    if (store && command && i.commandName === 'funds' && i.options.getSubcommand() === 'undo-last') {
        const head = async () => store.recentHistory ? (await store.recentHistory(i.guildId, 1))[0]?.id : (await store.history(i.guildId)).at(-1)?.id;
        const expected = await head();
        pending.get(key)!.check = async () => { if (await head() !== expected) throw new Error('The ledger changed since confirmation opened. Refresh Funds and review its history before trying again.'); };
    }
    const action = command ? i.options.getSubcommand().replaceAll('-', ' ') : (i.customId.split(':')[/^(member|bridge):/.test(i.customId) ? 2 : 3] ?? 'change').replaceAll('-', ' ');
    const selectedLabel = i.values?.map((v: string) => i.component?.options?.find((o: any) => o.value === v)?.label ?? v).join(', ');
    const fields = command ? (commandDefinitions() as any[]).find(c => c.name === i.commandName)?.options?.find((o: any) => o.name === i.options.getSubcommand())?.options ?? [] : [];
    const details = fields.flatMap((o: any) => { const getter = ({ 3: 'getString', 4: 'getInteger', 6: 'getUser', 7: 'getChannel', 8: 'getRole', 10: 'getNumber' } as Record<number, string>)[o.type]; const value = getter ? i.options[getter]?.(o.name) : undefined; return value == null ? [] : [`${o.description}: ${typeof value === 'object' ? value.name ?? value.username ?? value.id : value}`]; }).join('\n');
    await i.reply({ content: `Confirm **${action}**${selectedLabel ? ` for **${selectedLabel}**` : ''}?\n${details ? `${details}\n` : ''}This can change saved state or managed Discord resources. Current permissions and record checks will run again.`.slice(0,1900), ephemeral: true, allowedMentions: { parse: [] }, components: [{ type: 1, components: [{ type: 2, style: 4, label: 'Confirm', custom_id: `uxconfirm:${key}:yes` }, { type: 2, style: 2, label: 'Cancel', custom_id: `uxconfirm:${key}:no` }] }] });
}
export async function handleConfirmation(i: any, dispatch: (i: any) => Promise<void>): Promise<void> {
    const [, key, choice] = i.customId.split(':'), item = pending.get(key);
    if (!item || item.expires <= Date.now()) { await i.reply({ content: 'This confirmation expired or was already used. Open /help and choose the action again.', ephemeral: true, components: [] }); return; }
    if (item.guild !== i.guildId || item.owner !== i.user.id) throw new Error('This confirmation belongs to another member. Open /help for your own panel.');
    pending.delete(key);
    if (choice !== 'yes') { await i.update({ content: 'Action cancelled.', components: [] }); return; }
    await item.check?.();
    const next = item.kind === 'command' ? projectInteraction(commandInteraction(i, item.command!, item.sub!, {}), { options: item.options }) : projectInteraction(i, { customId: item.customId, values: item.values, fields: item.fields, isChatInputCommand: () => false, isButton: () => item.kind === 'button', isAnySelectMenu: () => item.kind === 'select', isStringSelectMenu: () => item.kind === 'select', isModalSubmit: () => item.kind === 'modal' });
    confirmed.add(next);
    await dispatch(next);
}

export function friendlyError(error: unknown): string {
    const text = error instanceof Error ? error.message : '';
    if (/stale|changed|concurrent|revision|VERSION_CONFLICT/i.test(text)) return 'This panel is outdated. Open /help to refresh, or run /server setup and press Resume to load your saved draft.';
    if (/foreign key|duplicate key|constraint|postgres|postgrest|sql|schema|relation|column|token|credential|api.?key|jwt/i.test(text)) return 'Codex could not save this change. Refresh the panel and check the selected records. If it happens again, ask an administrator to check the bot logs.';
    if (/permission|required.*tier|LEVEL_[1-4]|Administrator|not authorized|access denied/i.test(text)) return 'You do not currently have permission for this action. Open /help to see your available actions, or ask a server administrator.';
    if (/module.*disabled/i.test(text)) return 'This module is disabled. Ask an administrator to enable it in /server setup.';
    if (/^(Choose|Select|Enter|That |This |Your |You |Only |Open |Run |Use |Start |Setup |Another administrator|Move the bot|A configured|A selected|No |Not |Record |Saved |The ledger|Database response was interrupted|Database commit could not be confirmed|An active|Request access|Configure|Confirm|Complete|Action|Trailmark changed|Each rank|Names must|Rank progression|Name cannot|Duration must|Provide)/i.test(text) && text.length <= 1900) return text;
    return 'Codex could not complete this action. Open a fresh panel with /help and try again. If it continues, ask an administrator to check the bot logs.';
}
