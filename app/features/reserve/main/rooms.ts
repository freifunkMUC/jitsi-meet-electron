import {
    IRoomView,
    JoinCache,
    PowProgressFn,
    ReserveClient,
    ReserveError,
    hostSecretFromManageURL
} from '../client';
import { dueReminder } from '../reminders';
import { IReserveConference, IRoomList, IRoomSummary, RoomStatus } from '../types';

import { IStoredRoom, RoomStore } from './store';

/**
 * A manage call per room at most this often, unless the user asks. The
 * service limits the number of requests.
 */
export const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export interface IRoomLinks {
    host: string;
    manage: string;
    speaker: string;
    viewer: string;
}

interface IPowOpts {
    onProgress?: PowProgressFn;
    signal?: { aborted: boolean; };
}

interface IRoomState {
    checkedAt?: number;
    status?: RoomStatus;
    view?: IRoomView;
}

const GONE_REASONS: RoomStatus[] = [ 'deleted', 'expired', 'replaced', 'unknown' ];

/**
 * Logic of "My rooms" in the main process. Room secrets and links stay here;
 * the renderer gets summaries only.
 */
export class RoomsService {
    private _client: ReserveClient;
    private _joinCache: JoinCache;
    private _now: () => number;
    private _state = new Map<string, IRoomState>();
    private _store: RoomStore;

    /**
     * Initializes a new {@code RoomsService}.
     *
     * @param {RoomStore} store - Room store.
     * @param {ReserveClient} client - Client of the reserve service.
     * @param {JoinCache} joinCache - Token cache of the client.
     * @param {Function} now - Clock, for tests.
     */
    constructor(store: RoomStore, client: ReserveClient, joinCache: JoinCache, now: () => number = Date.now) {
        this._store = store;
        this._client = client;
        this._joinCache = joinCache;
        this._now = now;
    }

    /**
     * Base URL of the reserve service.
     *
     * @returns {string}
     */
    get baseURL(): string {
        return this._client.baseURL;
    }

    /**
     * The rooms with the last known state.
     *
     * @returns {IRoomList}
     */
    list(): IRoomList {
        return {
            persistent: this._store.persistent,
            rooms: this._store.list().map(r => this._summary(r))
        };
    }

    /**
     * Gets the current state of rooms from the service.
     *
     * @param {boolean} force - Also check rooms that were checked recently.
     * @returns {Promise<IRoomList>}
     */
    async refresh(force = false): Promise<IRoomList> {
        for (const r of this._store.list()) {
            const checkedAt = this._state.get(r.room)?.checkedAt ?? 0;

            if (force || this._now() - checkedAt >= REFRESH_INTERVAL_MS) {
                try {
                    await this._manage(r);
                } catch (e) {
                    if (!(e instanceof ReserveError) || !GONE_REASONS.includes(e.reason as RoomStatus)) {
                        throw e;
                    }
                }
            }
        }

        return this.list();
    }

    /**
     * Reserves a new room.
     *
     * @param {number} hours - Duration.
     * @param {Object} opts - Progress callback and abort signal.
     * @returns {Promise<IRoomSummary>}
     */
    async create(hours: number, opts: IPowOpts = {}): Promise<IRoomSummary> {
        return this._apply(await this._client.reserve(hours, opts));
    }

    /**
     * Adds a room from a manage or host link.
     *
     * @param {string} key - Host secret or link.
     * @returns {Promise<IRoomSummary>}
     */
    async importLink(key: string): Promise<IRoomSummary> {
        return this._apply(await this._client.manage(key.trim()));
    }

    /**
     * Extends a room.
     *
     * @param {string} room - Room name.
     * @param {number} hours - Duration to add.
     * @param {Object} opts - Progress callback and abort signal.
     * @returns {Promise<IRoomSummary>}
     */
    async extend(room: string, hours: number, opts: IPowOpts = {}): Promise<IRoomSummary> {
        const r = this._get(room);

        return this._apply(await this._client.extend(r.secret, hours, opts), r);
    }

    /**
     * Makes new links. The old links stop working.
     *
     * @param {string} room - Room name.
     * @returns {Promise<IRoomSummary>}
     */
    async rotate(room: string): Promise<IRoomSummary> {
        const r = this._get(room);
        const summary = this._apply(await this._client.rotate(r.secret), r);

        this._joinCache.forget(r.secret);

        return summary;
    }

    /**
     * Deletes a room on the service. It stays in the list as deleted.
     *
     * @param {string} room - Room name.
     * @returns {Promise<IRoomSummary>}
     */
    async delete(room: string): Promise<IRoomSummary> {
        const r = this._get(room);

        await this._client.delete(r.secret);
        this._joinCache.forget(r.secret);
        this._state.set(room, { ...this._state.get(room), checkedAt: this._now(), status: 'deleted' });

        return this._summary(r);
    }

    /**
     * Removes a room from the list only.
     *
     * @param {string} room - Room name.
     * @returns {Promise<void>}
     */
    async remove(room: string): Promise<void> {
        const r = this._store.get(room);

        if (r) {
            this._joinCache.forget(r.secret);
        }
        this._state.delete(room);
        await this._store.remove(room);
    }

    /**
     * Gets a token to join a room as host.
     *
     * @param {string} room - Room name.
     * @returns {Promise<IReserveConference>}
     */
    async join(room: string): Promise<IReserveConference> {
        const r = this._get(room);
        let info;

        try {
            info = await this._client.resolveJoin({ baseURL: this.baseURL, key: r.secret, kind: 'host' });
        } catch (e) {
            if (e instanceof ReserveError && GONE_REASONS.includes(e.reason as RoomStatus)) {
                this._state.set(room, { ...this._state.get(room), status: e.reason as RoomStatus });
            }
            throw e;
        }

        return { jwt: info.jwt, room: info.room, serverURL: info.serverURL };
    }

    /**
     * Gets the links of a room. Asks the service if they are not known yet.
     *
     * @param {string} room - Room name.
     * @returns {Promise<IRoomLinks>}
     */
    async links(room: string): Promise<IRoomLinks> {
        const r = this._get(room);
        const view = this._state.get(room)?.view ?? await this._manage(r);

        return {
            host: view.host_url,
            manage: view.manage_url,
            speaker: view.speaker_url,
            viewer: view.guest_url
        };
    }

    /**
     * Durations the service allows, in hours.
     *
     * @returns {Promise<{default: number, durations: number[], maxAheadH: number}>}
     */
    async durations(): Promise<{ default: number; durations: number[]; maxAheadH: number; }> {
        const c = await this._client.challenge();

        return { default: c.default, durations: c.durations, maxAheadH: c.max_ahead_h };
    }

    /**
     * Finds the active rooms that need an expiry reminder now.
     *
     * @returns {Array<Object>}
     */
    dueReminders(): Array<{ days: number; expires: string; room: string; }> {
        const due = [];

        for (const r of this._store.list()) {
            const summary = this._summary(r);
            const days = summary.status === 'active' ? dueReminder(summary.expires, r.reminded, this._now()) : undefined;

            if (days !== undefined && summary.expires) {
                due.push({ days, expires: summary.expires, room: r.room });
            }
        }

        return due;
    }

    /**
     * Notes that a reminder was shown, so it is not shown again.
     *
     * @param {string} room - Room name.
     * @param {number} days - Reminder threshold.
     * @param {string} expires - Room expiry of the reminder.
     * @returns {Promise<void>}
     */
    async markReminded(room: string, days: number, expires: string): Promise<void> {
        const r = this._store.get(room);

        if (r) {
            await this._store.put({ ...r, reminded: { days, expires } });
        }
    }

    /**
     * Gets a stored room or throws.
     *
     * @param {string} room - Room name.
     * @returns {IStoredRoom}
     */
    private _get(room: string): IStoredRoom {
        const r = this._store.get(room);

        if (!r) {
            throw new ReserveError('unknown', 0, 'room not in list');
        }

        return r;
    }

    /**
     * Calls manage for a stored room and keeps the result.
     *
     * @param {IStoredRoom} r - Room.
     * @returns {Promise<IRoomView>}
     */
    private async _manage(r: IStoredRoom): Promise<IRoomView> {
        try {
            const view = await this._client.manage(r.secret);

            this._apply(view, r);

            return view;
        } catch (e) {
            if (e instanceof ReserveError && GONE_REASONS.includes(e.reason as RoomStatus)) {
                this._state.set(r.room, {
                    ...this._state.get(r.room),
                    checkedAt: this._now(),
                    status: e.reason as RoomStatus
                });
            }
            throw e;
        }
    }

    /**
     * Keeps a room view from the service and stores the room.
     *
     * @param {IRoomView} view - Room view.
     * @param {IStoredRoom} previous - The stored room, if any.
     * @returns {IRoomSummary}
     */
    private _apply(view: IRoomView, previous?: IStoredRoom): IRoomSummary {
        const secret = hostSecretFromManageURL(view.manage_url) ?? previous?.secret;

        if (!secret) {
            throw new ReserveError('internal', 200, 'no host secret in response');
        }

        const before = previous ?? this._store.get(view.room);
        const stored: IStoredRoom = {
            expires: view.expires,
            reminded: before?.reminded?.expires === view.expires ? before.reminded : undefined,
            room: view.room,
            secret
        };

        this._state.set(view.room, { checkedAt: this._now(), status: view.status as RoomStatus, view });
        this._store.put(stored).catch(e => console.error('reserve: cannot write the rooms file', e));

        return this._summary(stored);
    }

    /**
     * Builds the summary of a room for the renderer. Has no secrets.
     *
     * @param {IStoredRoom} r - Room.
     * @returns {IRoomSummary}
     */
    private _summary(r: IStoredRoom): IRoomSummary {
        const s = this._state.get(r.room);
        let status = s?.status;

        if (!status && r.expires) {
            status = Date.parse(r.expires) <= this._now() ? 'expired' : 'active';
        }

        return {
            checked: Boolean(s?.checkedAt),
            durations: s?.view?.durations,
            expires: s?.view?.expires ?? r.expires,
            maxAheadH: s?.view?.max_ahead_h,
            room: r.room,
            status: status ?? 'active'
        };
    }
}
