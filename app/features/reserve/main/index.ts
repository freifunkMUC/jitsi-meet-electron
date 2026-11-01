import { createHash } from 'crypto';
import { WebContents, ipcMain } from 'electron';

import { JoinCache, ReserveClient, ReserveError, parseReserveLink } from '../client';
import { IReserveConference, RESERVE_INVOKE_CHANNELS, ReserveIpcResult } from '../types';

/**
 * Native SHA-256 for the proof of work. Faster than the pure JS one.
 *
 * @param {string} input - Input.
 * @returns {Uint8Array}
 */
const nodeHash = (input: string): Uint8Array => createHash('sha256').update(input).digest();

/**
 * Join tokens in memory only. The join API has a rate limit, so the app reuses
 * a token until shortly before it expires.
 */
export const joinCache = new JoinCache();

/**
 * Creates a reserve client for a service base URL. Requests run in the main
 * process because the service does not allow cross-origin requests.
 *
 * @param {string} baseURL - Reserve service base URL.
 * @returns {ReserveClient}
 */
export function createReserveClient(baseURL: string): ReserveClient {
    return new ReserveClient({ baseURL, hash: nodeHash, joinCache });
}

/**
 * Runs a reserve operation and turns errors into a reason code.
 *
 * @param {Function} fn - The operation.
 * @returns {Promise<ReserveIpcResult>}
 */
export async function toIpcResult<T>(fn: () => Promise<T>): Promise<ReserveIpcResult<T>> {
    try {
        return { ok: true, value: await fn() };
    } catch (e) {
        if (e instanceof ReserveError) {
            return { ok: false, reason: e.reason };
        }
        console.error('reserve: unexpected error', e);

        return { ok: false, reason: 'internal' };
    }
}

/**
 * Resolves a host, speaker or manage link to a conference with a fresh token.
 *
 * @param {string} input - The link.
 * @returns {Promise<IReserveConference>}
 */
export async function resolveReserveJoin(input: string): Promise<IReserveConference> {
    const link = parseReserveLink(input);

    if (!link) {
        throw new ReserveError('invalid', 0, 'not a reserve link');
    }

    const info = await createReserveClient(link.baseURL).resolveJoin(link);

    return {
        jwt: info.jwt,
        room: info.room,
        serverURL: info.serverURL
    };
}

/**
 * Registers the IPC handlers of the reserve feature.
 *
 * @param {Function} isTrustedSender - Returns true for the launcher window. Other
 * senders get an error.
 * @returns {void}
 */
export function setupReserveMain(isTrustedSender: (sender: WebContents) => boolean): void {
    ipcMain.handle(RESERVE_INVOKE_CHANNELS.join, (event, input: unknown) => {
        if (!isTrustedSender(event.sender)) {
            return { ok: false, reason: 'invalid' };
        }

        return toIpcResult(() => resolveReserveJoin(String(input ?? '')));
    });
}
