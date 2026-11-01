import type { IJoinInfo, JoinRole } from './api';

/**
 * Margin before token expiry in which a cached token is not used anymore.
 */
export const JOIN_CACHE_MARGIN_MS = 5 * 60 * 1000;

/**
 * Reads the {@code exp} claim of a JWT without checking the signature.
 *
 * @param {string} jwt - The token.
 * @returns {number|undefined} Expiry in ms since epoch.
 */
export function jwtExpiry(jwt: string): number | undefined {
    const part = jwt.split('.')[1];
    const decode = (globalThis as { atob?: (s: string) => string; }).atob;

    if (!part || !decode) {
        return;
    }

    try {
        const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(decode(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));

        return typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
    } catch {
        return;
    }
}

/**
 * Expiry of the token in join info, in ms since epoch.
 *
 * @param {IJoinInfo} info - Join info.
 * @returns {number|undefined}
 */
function expiryOf(info: IJoinInfo): number | undefined {
    const fromField = info.jwtExpires ? Date.parse(info.jwtExpires) : NaN;

    return Number.isNaN(fromField) ? jwtExpiry(info.jwt) : fromField;
}

/**
 * In-memory cache of join tokens per room secret and role. The join API has a
 * rate limit, so a client reuses a token until shortly before it expires.
 * Never write the content of this cache to disk.
 */
export class JoinCache {
    private _entries = new Map<string, { expires: number; info: IJoinInfo; }>();

    private _now: () => number;

    /**
     * Initializes a new {@code JoinCache}.
     *
     * @param {Function} now - Clock, for tests.
     */
    constructor(now: () => number = Date.now) {
        this._now = now;
    }

    /**
     * Gets a token that is valid for at least the margin.
     *
     * @param {string} key - Room secret.
     * @param {JoinRole} role - Role.
     * @returns {IJoinInfo|undefined}
     */
    get(key: string, role: JoinRole): IJoinInfo | undefined {
        const id = `${role}:${key}`;
        const entry = this._entries.get(id);

        if (!entry) {
            return;
        }
        if (entry.expires - JOIN_CACHE_MARGIN_MS <= this._now()) {
            this._entries.delete(id);

            return;
        }

        return entry.info;
    }

    /**
     * Stores a token. Tokens without a known expiry are not stored.
     *
     * @param {string} key - Room secret.
     * @param {IJoinInfo} info - Join info.
     * @returns {void}
     */
    set(key: string, info: IJoinInfo): void {
        const expires = expiryOf(info);

        if (expires !== undefined && expires - JOIN_CACHE_MARGIN_MS > this._now()) {
            this._entries.set(`${info.role}:${key}`, { expires, info });
        }
    }

    /**
     * Removes all tokens of a room secret, e.g. after new links or delete.
     *
     * @param {string} key - Room secret.
     * @returns {void}
     */
    forget(key: string): void {
        for (const id of [ ...this._entries.keys() ]) {
            if (id.endsWith(`:${key}`)) {
                this._entries.delete(id);
            }
        }
    }

    /**
     * Removes all tokens.
     *
     * @returns {void}
     */
    clear(): void {
        this._entries.clear();
    }
}
