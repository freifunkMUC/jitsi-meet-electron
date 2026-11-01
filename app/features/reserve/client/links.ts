/**
 * Kind of a reserve link.
 *
 * - host: {@code <base>/h/<secret>} joins as moderator.
 * - speaker: {@code <base>/s/<secret>} joins as speaker.
 * - manage: {@code <base>/#k=<secret>} (or v1 {@code #m=<token>}) manages the room.
 */
export type ReserveLinkKind = 'host' | 'manage' | 'speaker';

export interface IReserveLink {

    /**
     * Reserve service base URL, e.g. {@code https://meet.ffmuc.net/reserve}.
     */
    baseURL: string;

    /**
     * The secret (host or speaker) or, for v1 manage links, the v1 token.
     */
    key: string;
    kind: ReserveLinkKind;

    /**
     * True for v1 manage links ({@code #m=}). Their key is not a host secret.
     */
    legacy?: boolean;
}

export const DEFAULT_BASE_PATH = '/reserve';

const SECRET = '[A-Za-z0-9_-]{22}';

/**
 * Escapes a string for use in a RegExp.
 *
 * @param {string} s - Input.
 * @returns {string}
 */
function escape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * Brings user input into {@code https://host/path} form. Custom app schemes
 * (e.g. {@code ffmuc-meet://}) become {@code https://}.
 *
 * @param {string} input - Raw input.
 * @returns {string}
 */
export function normalizeLinkInput(input: string): string {
    const trimmed = input.trim();
    const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(trimmed);

    if (!scheme) {
        return `https://${trimmed}`;
    }

    const s = scheme[1].toLowerCase();

    if (s === 'http' || s === 'https') {
        return trimmed;
    }

    return `https://${trimmed.substring(scheme[0].length)}`;
}

/**
 * Parses a reserve link. Returns undefined for anything else (e.g. a normal
 * meeting link). Does not use {@code URL} so it runs in any JS runtime.
 *
 * @param {string} input - The pasted link or deep link.
 * @param {string} basePath - Path of the reserve service on the server.
 * @returns {IReserveLink|undefined}
 */
export function parseReserveLink(input: string, basePath: string = DEFAULT_BASE_PATH): IReserveLink | undefined {
    if (!input?.trim()) {
        return;
    }

    const link = normalizeLinkInput(input);
    const origin = '(https?:\\/\\/[^/?#\\s]+)';
    const base = escape(`/${basePath.replace(/^\/+|\/+$/g, '')}`);

    const join = new RegExp(`^${origin}${base}\\/(h|s)\\/(${SECRET})\\/?(?:[?#].*)?$`, 'i').exec(link);

    if (join) {
        return {
            baseURL: `${join[1].toLowerCase()}${basePath}`,
            key: join[3],
            kind: join[2].toLowerCase() === 'h' ? 'host' : 'speaker'
        };
    }

    const manage = new RegExp(`^${origin}${base}\\/?(?:\\?[^#]*)?#(?:.*&)?(k|m)=([^&#\\s]+)`, 'i').exec(link);

    if (manage) {
        return {
            baseURL: `${manage[1].toLowerCase()}${basePath}`,
            key: manage[3],
            kind: 'manage',
            ...manage[2].toLowerCase() === 'm' ? { legacy: true } : {}
        };
    }
}

/**
 * Builds the short join link for a secret.
 *
 * @param {string} baseURL - Reserve service base URL.
 * @param {string} secret - Host or speaker secret.
 * @param {'host'|'speaker'} role - Role.
 * @returns {string}
 */
export function joinLink(baseURL: string, secret: string, role: 'host' | 'speaker' = 'host'): string {
    return `${baseURL}/${role === 'host' ? 'h' : 's'}/${secret}`;
}

/**
 * Builds the manage link for a host secret.
 *
 * @param {string} baseURL - Reserve service base URL.
 * @param {string} secret - Host secret.
 * @returns {string}
 */
export function manageLink(baseURL: string, secret: string): string {
    return `${baseURL}/#k=${secret}`;
}

/**
 * Returns the host secret of a room view's manage URL.
 *
 * @param {string} manageURL - The {@code manage_url} of a room view.
 * @returns {string|undefined}
 */
export function hostSecretFromManageURL(manageURL: string): string | undefined {
    const m = new RegExp(`#k=(${SECRET})$`).exec(manageURL);

    return m ? m[1] : undefined;
}
