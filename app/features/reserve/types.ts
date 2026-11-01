import type { ReserveErrorReason } from './client';

/**
 * IPC channels (ipcRenderer.invoke) of the reserve feature. The preload only
 * forwards channels of this list.
 */
export const RESERVE_INVOKE_CHANNELS = {
    join: 'reserve-join'
} as const;

/**
 * Result of a reserve IPC call. Errors cross the IPC boundary as a reason
 * code, because thrown errors lose their fields there.
 */
export type ReserveIpcResult<T> = { ok: false; reason: ReserveErrorReason; } | { ok: true; value: T; };

/**
 * Conference to join for a reserve link. Holds a short-lived token: keep it in
 * memory only.
 */
export interface IReserveConference {
    jwt: string;
    room: string;
    serverURL: string;
}
