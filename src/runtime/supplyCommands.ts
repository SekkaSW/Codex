import { SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
const assignment = (o: SlashCommandStringOption) => o.setName('assignment').setDescription('Supply assignment code').setRequired(true).setAutocomplete(true);
export function supplyCommand() {
    const c = new SlashCommandBuilder().setName('supply').setDescription('Create and track supply assignments');
    c.addSubcommand(s => {
        s.setName('create').setDescription('Create an auto-updating supply assignment board')
            .addStringOption(o => o.setName('name').setDescription('Assignment name').setRequired(true).setMaxLength(100))
            .addStringOption(o => o.setName('client').setDescription('Client receiving supplies').setRequired(true).setMaxLength(100))
            .addNumberOption(o => o.setName('sale_price').setDescription('Client price per item').setRequired(true).setMinValue(0).setMaxValue(1e9))
            .addNumberOption(o => o.setName('member_rate').setDescription('Member payout per item').setRequired(true).setMinValue(0).setMaxValue(1e9));
        for (let n = 1; n <= 4; n++)
            s.addStringOption(o => o.setName(`item_${n}`).setDescription(`Item ${n}`).setRequired(n === 1).setMaxLength(100)).addIntegerOption(o => o.setName(`quota_${n}`).setDescription(`Item ${n} quota`).setRequired(n === 1).setMinValue(1).setMaxValue(1e9));
        return s.addUserOption(o => o.setName('organizer').setDescription('Organizing member; defaults to you')).addStringOption(o => o.setName('notes').setDescription('Instructions or storage location').setMaxLength(1000));
    });
    c.addSubcommand(s => {
        s.setName('log').setDescription('Log items contributed to an active assignment.').addStringOption(assignment);
        for (let n = 1; n <= 4; n++) {
            const suffix = n === 1 ? '' : `_${n}`;
            s.addStringOption(o => o.setName(`item${suffix}`).setDescription(`Contributed item ${n}`).setRequired(n === 1).setAutocomplete(true)).addIntegerOption(o => o.setName(`quantity${suffix}`).setDescription(`Quantity of item ${n}`).setRequired(n === 1).setMinValue(1));
        }
        return s.addUserOption(o => o.setName('member').setDescription('Advisors: credit another member; defaults to you')).addStringOption(o => o.setName('note').setDescription('Contribution note').setMaxLength(500));
    });
    c.addSubcommand(s => s.setName('undo-last').setDescription('Undo the latest contribution').addStringOption(assignment).addUserOption(o => o.setName('member').setDescription('Advisors: undo another member’s contribution')));
    c.addSubcommand(s => s.setName('redistribute').setDescription('Redistribute contributor credit before a cutoff').addStringOption(assignment)
        .addStringOption(o => o.setName('source_id').setDescription('Former contributor Discord ID or mention').setRequired(true).setMaxLength(30))
        .addStringOption(o => o.setName('before').setDescription('ISO cutoff time').setRequired(true).setMaxLength(40))
        .addStringOption(o => o.setName('method').setDescription('Credit allocation method').setRequired(true).addChoices({ name: 'Weighted by contribution', value: 'weighted' }, { name: 'Evenly', value: 'even' }))
        .addStringOption(o => o.setName('reason').setDescription('Audit reason').setMaxLength(500)));
    for (const action of ['status', 'contributors', 'refresh', 'close', 'reopen', 'cancel'])
        c.addSubcommand(s => s.setName(action).setDescription(`${action} supply assignment`).addStringOption(assignment));
    return c;
}
