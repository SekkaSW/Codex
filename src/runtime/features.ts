import type { ServerConfig } from '../domain.js';
export function disabledFeature(config: ServerConfig | undefined, system: string): string | undefined {
    if (config?.modules.intelligence === false && ['intel', 'contact', 'alliance'].includes(system))
        return 'Intelligence is not enabled for this group.';
    if (config?.modules.trailmarks === false && ['trailmark', 'patrol'].includes(system))
        return 'Trailmarks are not enabled for this group.';
    return undefined;
}
export async function requireFeature(store: object, guild: string, system: string): Promise<void> {
    if (!['intel', 'contact', 'alliance', 'trailmark', 'patrol'].includes(system)) return;
    const loader = (store as {
        load?: (guild: string) => Promise<ServerConfig | undefined>;
    }).load;
    const error = disabledFeature(await loader?.call(store, guild), system);
    if (error)
        throw new Error(error);
}
export function backgroundFeatures(config: ServerConfig) {
    return { atlas: config.modules.atlas && config.modules.trailmarks !== false, trailmarks: config.modules.trailmarks !== false, intelligence: config.modules.intelligence !== false };
}
