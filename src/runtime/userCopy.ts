import { permissionLabels, type Requirement } from '../domain.js';

export const commandNameQuestion = 'What do you want your command to be?\nFor example: enter Order for /order.\nSend your answer here.';
export function normalizeSetupCommand(value: string, reserved: readonly string[], current?: string): string {
    const name = value.trim().replace(/^\//, '').toLowerCase();
    if (!/^[a-z0-9_-]{1,32}$/.test(name))
        throw new Error('Enter a command name of 1–32 letters, digits, hyphens or underscores, with no spaces. For example: Order.');
    if (reserved.includes(name) && !(['help', 'promotion', 'apprenticeship'].includes(name) && current === name))
        throw new Error('Choose another command name; this one is already used by a core command. Your saved draft is retained.');
    return name;
}
export const setupAreaLabels: Record<string, string> = {identity:'Group Name',namespace:'Command',permissions:'Permissions',ranks:'Ranks',branches:'Branches',progression:'Progression',duties:'Duties',groups:'Assignment Groups',entries:'Assignment Entries',modules:'Optional Features',resources:'Channels & Categories',destinations:'Command & Log Channels',integration:'Local Report Marker',preview:'Review'};
export function permissionName(tier: Requirement): string { return tier === 'ADMIN' ? 'Discord Administrator' : permissionLabels[tier]; }
export function permissionDenied(tier: Requirement): string { return tier === 'ADMIN' ? 'Discord Administrator permission is required.' : `${permissionName(tier)} permission or Discord Administrator is required.`; }
export function destinationName(key: string): string { return ({HQ_STRONGBOX:'private Strongbox review channel',STRONGBOX_DROP:'Strongbox receipt channel',NOTICE_BOARD:'notice board',ASSIGNMENTS:'assignment board',APPLICATIONS:'application review channel',DISPATCH_DESK:'dispatch desk',ADVANCEMENT:'Promotions channel',FUNDS:'Funds summary channel',ROSTER:'roster channel'} as Record<string,string>)[key] ?? 'selected destination'; }
/** Display labels only; never apply substitutions to user-authored text or stored keys. */
export function audienceName(value: string): string { return ({apprentice_plus:'Recruit+',ranger_plus:'Member+',marshal_plus:'Advisors+',captain_plus:'Leader+',corps:'Organization',individual:'Individual'} as Record<string,string>)[value] ?? value; }
