import { referenceCategories, referenceAuthorities, referenceContexts, referenceConfidentialities, contactOccupations, contactGroups } from './nativeConstants.js';
import { SlashCommandBuilder, type APIApplicationCommandBasicOption, type APIApplicationCommandSubcommandOption } from 'discord.js';
import { nativeContracts } from './nativeContracts.js';
/** Real Discord builders validate each curated native option before serialization. */
export function buildNative(name: string, contractName = name) {
    const spec = nativeContracts.find(c => c.name === contractName);
    if (!spec)
        throw new Error(`Missing native contract ${contractName}`);
    const c = new SlashCommandBuilder().setName(name).setDescription(spec.description);
    for (const sub of ('options' in spec ? spec.options : []) as unknown as APIApplicationCommandSubcommandOption[]) {
        c.addSubcommand(s => {
            s.setName(sub.name).setDescription(sub.description);
            for (const o of sub.options ?? []) {
                const values = name === 'reference' ? ({ category: referenceCategories, authority: referenceAuthorities, context: referenceContexts, confidentiality: referenceConfidentialities } as Record<string, string[]>)[o.name] : name === 'contact' ? (o.name === 'occupation' ? contactOccupations : ['category', 'group_category'].includes(o.name) && o.type === 3 ? contactGroups : undefined) : undefined;
                if (values && o.type === 3)
                    o.choices = values.map(value => ({ name: value.replace('marshal_plus', 'Advisors+').replace('captain_plus', 'Leader+').replace('corps', 'Organization'), value }));
                const basic = <T extends {
                    setName(v: string): T;
                    setDescription(v: string): T;
                    setRequired(v: boolean): T;
                }>(b: T) => b.setName(o.name).setDescription(o.description).setRequired(o.required ?? false);
                switch (o.type) {
                    case 3:
                        s.addStringOption(b => { basic(b); if (o.autocomplete)
                            b.setAutocomplete(true); if (o.choices)
                            b.addChoices(...o.choices); if (o.min_length !== undefined)
                            b.setMinLength(o.min_length); if (o.max_length !== undefined)
                            b.setMaxLength(o.max_length); return b; });
                        break;
                    case 4:
                        s.addIntegerOption(b => { basic(b); if (o.autocomplete)
                            b.setAutocomplete(true); if (o.choices)
                            b.addChoices(...o.choices); if (o.min_value !== undefined)
                            b.setMinValue(o.min_value); if (o.max_value !== undefined)
                            b.setMaxValue(o.max_value); return b; });
                        break;
                    case 10:
                        s.addNumberOption(b => { basic(b); if (o.min_value !== undefined)
                            b.setMinValue(o.min_value); if (o.max_value !== undefined)
                            b.setMaxValue(o.max_value); return b; });
                        break;
                    case 5:
                        s.addBooleanOption(b => basic(b));
                        break;
                    case 6:
                        s.addUserOption(b => basic(b));
                        break;
                    case 8:
                        s.addRoleOption(b => basic(b));
                        break;
                    case 11:
                        s.addAttachmentOption(b => basic(b));
                        break;
                    case 7:
                        s.addChannelOption(b => { basic(b); if (o.channel_types?.length)
                            b.addChannelTypes(...o.channel_types.filter((t): t is Exclude<typeof t, 1 | 3> => t !== 1 && t !== 3)); return b; });
                        break;
                    default: throw new Error(`Unsupported native option ${o.name}`);
                }
            }
            return s;
        });
    }
    return c;
}
// This list expands only when the corresponding production handler consumes the native contract.
export const restoredNativeSystems = new Set(['advancement', 'briefing', 'patrol', 'ping', 'funds', 'atlas', 'roster', 'recruit', 'strongbox', 'duty', 'application', 'contact', 'intel', 'trailmark', 'vote', 'assignment', 'reference', 'mentorship']);
export function restoreNativeDefinitions(current: any[], namespace?: string): any[] {
    const result = current.map(c => {
        if (c.name !== namespace && !restoredNativeSystems.has(c.name))
            return c;
        const native = buildNative(c.name, c.name === namespace ? 'ranger' : c.name === 'mentorship' ? 'apprenticeship' : c.name === 'advancement' ? 'promotion' : c.name).toJSON();
        native.options ??= [];
        if (c.name === namespace) {
            native.description = c.description;
            const status = native.options.find(o => o.name === 'status') as any;
            status.options.find((o: any) => o.name === 'status').choices = ['ACTIVE', 'INACTIVE', 'RETIRED', 'LEFT'].map(value => ({ name: value, value }));
            const clear = native.options.find(o => o.name === 'clear-assignment') as any;
            clear.options.push({ type: 3, name: 'assignment', description: 'Configured assignment to remove', required: true, autocomplete: true });
        }
        // Codex maintenance operations and optional compatibility panels remain available.
        for (const old of c.options ?? [])
            if (!native.options.some(o => o.name === old.name))
                native.options.push(old);
        return native;
    });
    const advancement = result.find(c => c.name === 'advancement');
    advancement.options.push({ type: 1, name: 'refresh', description: 'Recover the persisted promotion board', options: [{ type: 3, name: 'vote', description: 'Promotion case', required: true, autocomplete: true }] });
    if (namespace !== 'promotion')
        result.push({ ...advancement, name: 'promotion' });
    if (namespace !== 'apprenticeship')
        result.push(buildNative('apprenticeship').toJSON());
    return result;
}
