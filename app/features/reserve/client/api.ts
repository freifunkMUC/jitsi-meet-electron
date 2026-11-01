import { ReserveError, mapError, mapGone } from './errors';
import { IReserveLink, hostSecretFromManageURL, joinLink } from './links';
import { PowProgressFn, solvePow } from './pow';
import { HashFn } from './sha256';

/**
 * Minimal fetch response used by the client. The global {@code fetch} of
 * Node, browsers and React Native satisfies it.
 */
export interface IFetchResponse {
    headers: { get: (name: string) => string | null; };
    ok: boolean;
    status: number;
    text: () => Promise<string>;
}

export interface IFetchInit {
    body?: string;
    cache?: 'no-store';
    headers?: Record<string, string>;
    method?: string;
    redirect?: 'follow' | 'manual';
}

export type FetchFn = (url: string, init?: IFetchInit) => Promise<IFetchResponse>;

export type RoomStatus = 'active' | 'deleted' | 'expired';

/**
 * Response of {@code GET /api/challenge}.
 */
export interface IChallenge {
    challenge: string;
    default: number;
    difficulty: number;
    durations: number[];
    max_ahead_h: number;
}

/**
 * Room view returned by reserve, extend, manage and rotate. All URLs carry
 * secrets except {@code guest_url}.
 */
export interface IRoomView {
    durations: number[];
    expires: string;
    guest_url: string;
    host_url: string;
    manage_url: string;
    max_ahead_h: number;
    migrated?: boolean;
    room: string;
    speaker_url: string;
    status: RoomStatus;
}

export type JoinRole = 'host' | 'speaker';

/**
 * What a client needs to join a reserved room. Never persist {@code jwt}.
 */
export interface IJoinInfo {
    jwt: string;
    jwtExpires?: string;
    role: JoinRole;
    room: string;
    roomExpires?: string;

    /**
     * Meeting server URL with scheme, e.g. {@code https://meet.ffmuc.net}.
     */
    serverURL: string;
}

export interface IPowOptions {
    onProgress?: PowProgressFn;
    signal?: { aborted: boolean; };
}

export interface IReserveClientOptions {

    /**
     * Reserve service base URL, e.g. {@code https://meet.ffmuc.net/reserve}.
     */
    baseURL: string;

    /**
     * Hashes per solver chunk.
     */
    chunkSize?: number;

    /**
     * Defaults to the global {@code fetch}.
     */
    fetch?: FetchFn;

    /**
     * Faster native SHA-256, if the host has one.
     */
    hash?: HashFn;
}

/**
 * Returns the {@code scheme://host} part of a URL.
 *
 * @param {string} url - URL.
 * @returns {string}
 */
function originOf(url: string): string {
    const m = /^https?:\/\/[^/?#]+/i.exec(url);

    return m ? m[0] : url;
}

/**
 * Parses a JSON body; returns undefined for non-JSON bodies.
 *
 * @param {string} text - Body text.
 * @returns {unknown}
 */
function parseJSON(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

/**
 * Client of the meet-reserve service. It has no Electron, DOM or Node
 * dependencies, so desktop and mobile apps can share it.
 */
export class ReserveClient {
    readonly baseURL: string;
    private _chunkSize?: number;
    private _fetch: FetchFn;
    private _hash?: HashFn;

    /**
     * Initializes a new {@code ReserveClient}.
     *
     * @param {IReserveClientOptions} options - Options.
     */
    constructor(options: IReserveClientOptions) {
        this.baseURL = options.baseURL.replace(/\/+$/, '');
        this._chunkSize = options.chunkSize;
        this._fetch = options.fetch ?? ((url, init) => (globalThis as any).fetch(url, init));
        this._hash = options.hash;
    }

    /**
     * Fetches a fresh proof of work challenge.
     *
     * @returns {Promise<IChallenge>}
     */
    challenge(): Promise<IChallenge> {
        return this._request<IChallenge>('GET', '/api/challenge');
    }

    /**
     * Reserves a new room.
     *
     * @param {number} hours - One of the offered durations.
     * @param {IPowOptions} options - Progress and abort.
     * @returns {Promise<IRoomView>}
     */
    reserve(hours: number, options: IPowOptions = {}): Promise<IRoomView> {
        return this._withPow('/api/reserve', { hours }, options);
    }

    /**
     * Extends a room.
     *
     * @param {string} key - Host secret or manage/host link.
     * @param {number} hours - One of the offered durations.
     * @param {IPowOptions} options - Progress and abort.
     * @returns {Promise<IRoomView>}
     */
    extend(key: string, hours: number, options: IPowOptions = {}): Promise<IRoomView> {
        return this._withPow('/api/extend', { key, hours }, options);
    }

    /**
     * Reads the room state. Also migrates v1 rooms.
     *
     * @param {string} key - Host secret or manage/host link.
     * @returns {Promise<IRoomView>}
     */
    manage(key: string): Promise<IRoomView> {
        return this._request<IRoomView>('POST', '/api/manage', { key });
    }

    /**
     * Replaces all links of a room. Old links stop working.
     *
     * @param {string} key - Host secret.
     * @returns {Promise<IRoomView>}
     */
    rotate(key: string): Promise<IRoomView> {
        return this._request<IRoomView>('POST', '/api/rotate', { key });
    }

    /**
     * Deletes a room. The service returns no room view here.
     *
     * @param {string} key - Host secret.
     * @returns {Promise<Object>}
     */
    delete(key: string): Promise<{ deleted: boolean; }> {
        return this._request<{ deleted: boolean; }>('POST', '/api/delete', { key });
    }

    /**
     * Gets a fresh token through {@code POST /api/join}. Throws a
     * {@code not_supported} error when the server does not have this endpoint.
     *
     * @param {string} key - Host or speaker secret.
     * @param {JoinRole} role - Role of the secret.
     * @returns {Promise<IJoinInfo>}
     */
    async join(key: string, role?: JoinRole): Promise<IJoinInfo> {
        const r = await this._request<{
            jwt: string; jwt_expires?: string; role?: JoinRole; room: string; room_expires?: string; server?: string;
        }>('POST', '/api/join', role ? { key, role } : { key });
        let serverURL = r.server ? r.server.replace(/\/+$/, '') : originOf(this.baseURL);

        if (!/^https?:\/\//i.test(serverURL)) {
            serverURL = `https://${serverURL}`;
        }

        if (!r.jwt || !r.room) {
            throw new ReserveError('internal', 200, 'incomplete join response');
        }

        return {
            jwt: r.jwt,
            jwtExpires: r.jwt_expires,
            role: r.role ?? role ?? 'host',
            room: r.room,
            roomExpires: r.room_expires,
            serverURL
        };
    }

    /**
     * Gets a token by following the short join link once, without following
     * the redirect. Needs a fetch that exposes manual redirects (Node does).
     *
     * @param {string} secret - Host or speaker secret.
     * @param {JoinRole} role - Role of the secret.
     * @returns {Promise<IJoinInfo>}
     */
    async joinViaRedirect(secret: string, role: JoinRole): Promise<IJoinInfo> {
        const res = await this._send(joinLink(this.baseURL, secret, role), {
            cache: 'no-store',
            method: 'GET',
            redirect: 'manual'
        });
        const location = res.headers.get('location');

        if (res.status === 429) {
            throw mapError(429, undefined);
        }

        if (res.status < 300 || res.status >= 400 || !location) {
            throw new ReserveError('not_supported', res.status, 'no redirect');
        }

        const gone = /#gone=([a-z_]+)/.exec(location);

        if (gone) {
            throw mapGone(gone[1]);
        }

        const m = /^(https?:\/\/[^/?#]+)\/([^/?#]+)\?(?:[^#]*&)?jwt=([^&#]+)/i.exec(location);

        if (!m) {
            throw new ReserveError('internal', res.status, 'unexpected redirect');
        }

        return {
            jwt: decodeURIComponent(m[3]),
            role,
            room: decodeURIComponent(m[2]),
            serverURL: m[1]
        };
    }

    /**
     * Resolves any reserve link to join info. Uses the join API and falls back
     * to the short link redirect on servers without it.
     *
     * @param {IReserveLink} link - Parsed link.
     * @returns {Promise<IJoinInfo>}
     */
    async resolveJoin(link: IReserveLink): Promise<IJoinInfo> {
        let key = link.key;
        const role: JoinRole = link.kind === 'speaker' ? 'speaker' : 'host';

        if (link.legacy) {
            const view = await this.manage(key);
            const secret = hostSecretFromManageURL(view.manage_url);

            if (!secret) {
                throw new ReserveError('invalid', 0, 'no host secret');
            }
            key = secret;
        }

        try {
            return await this.join(key, role);
        } catch (e) {
            if (e instanceof ReserveError && e.reason === 'not_supported') {
                return this.joinViaRedirect(key, role);
            }
            throw e;
        }
    }

    /**
     * Runs a request that needs proof of work. Retries once with a new
     * challenge when the server rejects the proof (e.g. it timed out).
     *
     * @param {string} path - API path.
     * @param {Object} body - Request body without PoW fields.
     * @param {IPowOptions} options - Progress and abort.
     * @returns {Promise<IRoomView>}
     */
    private async _withPow(path: string, body: object, options: IPowOptions): Promise<IRoomView> {
        for (let attempt = 0; ; attempt++) {
            const c = await this.challenge();
            const nonce = await solvePow(c.challenge, c.difficulty, {
                chunkSize: this._chunkSize,
                hash: this._hash,
                onProgress: options.onProgress,
                signal: options.signal
            });

            try {
                return await this._request<IRoomView>('POST', path, { ...body, challenge: c.challenge, nonce });
            } catch (e) {
                if (attempt > 0 || !(e instanceof ReserveError) || e.reason !== 'pow') {
                    throw e;
                }
            }
        }
    }

    /**
     * Sends a JSON request and maps errors.
     *
     * @param {string} method - HTTP method.
     * @param {string} path - API path.
     * @param {Object} body - JSON body.
     * @returns {Promise<T>}
     */
    private async _request<T>(method: string, path: string, body?: object): Promise<T> {
        const res = await this._send(this.baseURL + path, {
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            method
        });
        let text = '';

        try {
            text = await res.text();
        } catch (e) {
            throw new ReserveError('network', res.status, String(e));
        }
        const json = parseJSON(text);

        if (!res.ok) {
            if ((res.status === 404 || res.status === 405)
                    && !(json && typeof json === 'object' && 'error' in json)) {
                throw new ReserveError('not_supported', res.status, `HTTP ${res.status}`);
            }
            throw mapError(res.status, json);
        }

        if (json === undefined) {
            throw new ReserveError('internal', res.status, 'invalid JSON');
        }

        return json as T;
    }

    /**
     * Calls fetch and maps network failures.
     *
     * @param {string} url - URL.
     * @param {IFetchInit} init - Init.
     * @returns {Promise<IFetchResponse>}
     */
    private async _send(url: string, init: IFetchInit): Promise<IFetchResponse> {
        try {
            return await this._fetch(url, init);
        } catch (e) {
            throw new ReserveError('network', 0, String(e));
        }
    }
}
