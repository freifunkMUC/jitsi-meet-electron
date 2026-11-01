import type { ReserveErrorReason } from './client';

/**
 * IPC channels (ipcRenderer.invoke) of the reserve feature. The preload only
 * forwards channels of this list.
 */
export const RESERVE_INVOKE_CHANNELS = {
    cancel: 'reserve-cancel',
    copy: 'reserve-rooms-copy',
    create: 'reserve-rooms-create',
    delete: 'reserve-rooms-delete',
    durations: 'reserve-durations',
    extend: 'reserve-rooms-extend',
    import: 'reserve-rooms-import',
    inspect: 'reserve-inspect',
    join: 'reserve-join',
    joinRoom: 'reserve-rooms-join',
    list: 'reserve-rooms-list',
    refresh: 'reserve-rooms-refresh',
    remove: 'reserve-rooms-remove',
    rotate: 'reserve-rooms-rotate',
    takeReminder: 'reserve-rooms-take-reminder'
} as const;

/**
 * IPC events from the main process to the launcher window.
 */
export const RESERVE_EVENTS = {
    openExtend: 'reserve-open-extend',
    powProgress: 'reserve-pow-progress'
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

/**
 * What a pasted reserve link opens. Has no secrets.
 */
export interface IReserveLinkInfo {
    kind: 'host' | 'manage' | 'speaker';
    role: 'host' | 'speaker';
    room: string;
    roomExpires?: string;

    /**
     * True if the room of a host or manage link is in "My rooms".
     */
    saved: boolean;
}

export type RoomStatus = 'active' | 'deleted' | 'expired' | 'replaced' | 'unknown';

/**
 * A room in "My rooms" as the renderer sees it. Has no secrets.
 */
export interface IRoomSummary {

    /**
     * True if the state comes from the service in this session.
     */
    checked: boolean;
    durations?: number[];
    expires?: string;
    maxAheadH?: number;
    room: string;
    status: RoomStatus;
}

export interface IRoomList {

    /**
     * False if the operating system cannot encrypt the rooms. Then the rooms
     * are lost when the app closes.
     */
    persistent: boolean;
    rooms: IRoomSummary[];
}

export interface IDurations {
    default: number;
    durations: number[];
    maxAheadH: number;
}

export type RoomLinkKind = 'all' | 'host' | 'manage' | 'speaker' | 'viewer';

export interface IPowProgress {
    expected: number;
    tried: number;
}
