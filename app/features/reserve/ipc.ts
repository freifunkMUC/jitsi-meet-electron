import {
    IDurations,
    IPowProgress,
    IReserveConference,
    IReserveLinkInfo,
    IRoomList,
    IRoomSummary,
    RESERVE_EVENTS,
    RESERVE_INVOKE_CHANNELS,
    ReserveIpcResult,
    RoomLinkKind
} from './types';

const invoke = <T>(channel: string, ...args: unknown[]): Promise<ReserveIpcResult<T>> =>
    window.jitsiElectronApp.ipc.invoke(channel, ...args);

/**
 * Resolves a reserve link (host, speaker or manage) in the main process.
 *
 * @param {string} input - The link.
 * @returns {Promise<ReserveIpcResult<IReserveConference>>}
 */
export function joinReserveLink(input: string): Promise<ReserveIpcResult<IReserveConference>> {
    return invoke(RESERVE_INVOKE_CHANNELS.join, input);
}

/**
 * Tells what a host, speaker or manage link opens, before the join.
 *
 * @param {string} input - The link.
 * @returns {Promise<ReserveIpcResult<IReserveLinkInfo>>}
 */
export function inspectReserveLink(input: string): Promise<ReserveIpcResult<IReserveLinkInfo>> {
    return invoke(RESERVE_INVOKE_CHANNELS.inspect, input);
}

/**
 * Calls of "My rooms" in the main process. Rooms are identified by name; the
 * secrets stay in the main process.
 */
export const roomsApi = {
    cancel: () => invoke<void>(RESERVE_INVOKE_CHANNELS.cancel),
    copy: (room: string, kind: RoomLinkKind) => invoke<boolean>(RESERVE_INVOKE_CHANNELS.copy, room, kind),
    create: (hours: number) => invoke<IRoomSummary>(RESERVE_INVOKE_CHANNELS.create, hours),
    delete: (room: string) => invoke<IRoomSummary | null>(RESERVE_INVOKE_CHANNELS.delete, room),
    durations: () => invoke<IDurations>(RESERVE_INVOKE_CHANNELS.durations),
    extend: (room: string, hours: number) => invoke<IRoomSummary>(RESERVE_INVOKE_CHANNELS.extend, room, hours),
    import: (link: string) => invoke<IRoomSummary>(RESERVE_INVOKE_CHANNELS.import, link),
    join: (room: string) => invoke<IReserveConference>(RESERVE_INVOKE_CHANNELS.joinRoom, room),
    list: () => invoke<IRoomList>(RESERVE_INVOKE_CHANNELS.list),
    refresh: (force = false) => invoke<IRoomList>(RESERVE_INVOKE_CHANNELS.refresh, force),
    remove: (room: string) => invoke<void>(RESERVE_INVOKE_CHANNELS.remove, room),
    rotate: (room: string) => invoke<IRoomSummary | null>(RESERVE_INVOKE_CHANNELS.rotate, room),
    takeReminder: () => invoke<string | null>(RESERVE_INVOKE_CHANNELS.takeReminder)
};

/**
 * Listens to proof of work progress.
 *
 * @param {Function} listener - Listener.
 * @returns {Function} Removes the listener.
 */
export function onPowProgress(listener: (p: IPowProgress) => void): () => void {
    return window.jitsiElectronApp.ipc.addListener(RESERVE_EVENTS.powProgress, listener) ?? (() => undefined);
}

/**
 * Listens to clicks on expiry reminders. The listener then gets the room with
 * {@code roomsApi.takeReminder}.
 *
 * @param {Function} listener - Listener.
 * @returns {Function} Removes the listener.
 */
export function onOpenExtend(listener: () => void): () => void {
    return window.jitsiElectronApp.ipc.addListener(RESERVE_EVENTS.openExtend, listener) ?? (() => undefined);
}
