import { requireTier } from './interactions.js';
import type { MemberRepositories } from './handlers/members.js';
import type { PermissionTier } from '../domain.js';

/** Creation does not grant listing, editing, assessment or group-administration access. */
export function contactRequirement(action: string): PermissionTier {
    return action === 'create' || action === 'create-group' ? 'LEVEL_1' : 'LEVEL_3';
}
export function assertContactCreationContext(i: any): void {
    if (!i.guildId || i.guild?.id !== i.guildId)
        throw new Error('Use Contact creation in its original server.');
}
export async function requireContactPermission(i: any, store: Pick<MemberRepositories, 'permissionRoles'>, action: string): Promise<void> {
    try {
        await requireTier(i, store, contactRequirement(action));
    } catch (error) {
        if (contactRequirement(action) === 'LEVEL_1' && error instanceof Error && error.message === 'LEVEL_1 or Discord Administrator permission is required')
            throw new Error('Member permission or Discord Administrator is required.');
        throw error;
    }
}
