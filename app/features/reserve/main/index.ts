import { createHash } from 'crypto';
import { BrowserWindow, Notification, WebContents, app, clipboard, dialog, ipcMain, safeStorage } from 'electron';
import path from 'path';

import { t } from '../../../i18n/main';
import config from '../../config';
import { DEFAULT_BASE_PATH, JoinCache, ReserveClient, ReserveError, parseReserveLink } from '../client';
import {
    IReserveConference,
    RESERVE_EVENTS,
    RESERVE_INVOKE_CHANNELS,
    ReserveIpcResult,
    RoomLinkKind
} from '../types';

import { RoomsService } from './rooms';
import { IEncryptor, RoomStore } from './store';

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
 * Electron safeStorage as room store encryption. On Linux without a secret
 * service, Electron uses a fixed key ("basic_text"); that is not secure, so the
 * app does not write secrets then.
 */
const safeStorageEncryptor: IEncryptor = {
    decryptString: data => safeStorage.decryptString(data),
    encryptString: text => safeStorage.encryptString(text),
    isAvailable: () => safeStorage.isEncryptionAvailable()
        && !(process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text')
};

let rooms: Promise<RoomsService> | undefined;

/**
 * The rooms service. Loads the store on first use (after app ready).
 *
 * @returns {Promise<RoomsService>}
 */
export function getRoomsService(): Promise<RoomsService> {
    if (!rooms) {
        rooms = app.whenReady().then(async () => {
            const store = new RoomStore(path.join(app.getPath('userData'), 'reserve-rooms.bin'), safeStorageEncryptor);

            await store.load();

            return new RoomsService(
                store, createReserveClient(`${config.defaultServerURL}${DEFAULT_BASE_PATH}`), joinCache);
        });
    }

    return rooms;
}

export interface IReserveMainOptions {

    /**
     * Returns true for the launcher window. Other senders get an error.
     */
    isTrustedSender: (sender: WebContents) => boolean;

    /**
     * Parent window of confirmation dialogs.
     */
    parentWindow: () => BrowserWindow | null;

    /**
     * Shows the launcher window. Creates it if it is closed.
     */
    showWindow: () => void;
}

/**
 * Check for expiry reminders this often.
 */
export const REMINDER_INTERVAL_MS = 6 * 3600 * 1000;

/**
 * First reminder check after the app starts.
 */
const REMINDER_START_DELAY_MS = 30 * 1000;

/**
 * Asks the user to confirm an action that cannot be undone.
 *
 * @param {BrowserWindow|null} parent - Parent window.
 * @param {string} action - Translation key below reserve.confirm.
 * @param {string} room - Room name.
 * @returns {Promise<boolean>}
 */
async function confirm(parent: BrowserWindow | null, action: 'delete' | 'rotate', room: string): Promise<boolean> {
    const options = {
        buttons: [ t(`reserve.confirm.${action}.ok`), t('reserve.confirm.cancel') ],
        cancelId: 1,
        defaultId: 1,
        detail: t(`reserve.confirm.${action}.detail`),
        message: t(`reserve.confirm.${action}.message`, { room }),
        noLink: true,
        type: 'warning' as const
    };
    const { response } = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options);

    return response === 0;
}

/**
 * Registers the IPC handlers of the reserve feature.
 *
 * @param {IReserveMainOptions} options - Options.
 * @returns {void}
 */
export function setupReserveMain({ isTrustedSender, parentWindow, showWindow }: IReserveMainOptions): void {
    let pow: { aborted: boolean; } | undefined;
    let reminderRoom: string | undefined;
    const notifications = new Set<Notification>();

    const openExtend = (room: string) => {
        reminderRoom = room;
        showWindow();
        parentWindow()?.webContents.send(RESERVE_EVENTS.openExtend);
    };

    const checkReminders = async () => {
        if (!Notification.isSupported()) {
            return;
        }
        const service = await getRoomsService();

        try {
            await service.refresh(false);
        } catch (e) {
            // Offline or rate limited: use the cached expiry.
        }

        for (const { days, expires, room } of service.dueReminders()) {
            const notification = new Notification({
                body: t('reserve.reminder.body', {
                    count: days,
                    date: new Date(expires).toLocaleString(app.getLocale())
                }),
                title: t('reserve.reminder.title', { room })
            });

            // Keep a reference, else the click handler can be lost.
            notifications.add(notification);
            notification.on('close', () => notifications.delete(notification));
            notification.on('click', () => {
                notifications.delete(notification);
                openExtend(room);
            });
            notification.show();
            await service.markReminded(room, days, expires);
        }
    };

    const runReminders = () => checkReminders().catch(e => console.error('reserve: reminder check failed', e));

    app.whenReady().then(() => {
        setTimeout(runReminders, REMINDER_START_DELAY_MS);
        setInterval(runReminders, REMINDER_INTERVAL_MS);
    });

    const handle = <T>(channel: string, fn: (sender: WebContents, ...args: any[]) => Promise<T>) => {
        ipcMain.handle(channel, (event, ...args) => {
            if (!isTrustedSender(event.sender)) {
                return { ok: false, reason: 'invalid' };
            }

            return toIpcResult(() => fn(event.sender, ...args));
        });
    };

    const withPow = <T>(sender: WebContents, fn: (opts: object) => Promise<T>) => {
        if (pow) {
            pow.aborted = true;
        }
        const signal = { aborted: false };

        pow = signal;

        return fn({
            onProgress: (tried: number, expected: number) => {
                if (!sender.isDestroyed()) {
                    sender.send(RESERVE_EVENTS.powProgress, { expected, tried });
                }
            },
            signal
        }).finally(() => {
            if (pow === signal) {
                pow = undefined;
            }
        });
    };

    const hours = (h: unknown) => {
        if (typeof h !== 'number' || !Number.isInteger(h) || h <= 0) {
            throw new ReserveError('malformed', 0, 'bad duration');
        }

        return h;
    };

    handle(RESERVE_INVOKE_CHANNELS.takeReminder, async () => {
        const room = reminderRoom;

        reminderRoom = undefined;

        return room ?? null;
    });
    handle(RESERVE_INVOKE_CHANNELS.join, async (_s, input: unknown) => resolveReserveJoin(String(input ?? '')));
    handle(RESERVE_INVOKE_CHANNELS.list, async () => (await getRoomsService()).list());
    handle(RESERVE_INVOKE_CHANNELS.refresh, async (_s, force: unknown) =>
        (await getRoomsService()).refresh(force === true));
    handle(RESERVE_INVOKE_CHANNELS.durations, async () => (await getRoomsService()).durations());
    handle(RESERVE_INVOKE_CHANNELS.cancel, async () => {
        if (pow) {
            pow.aborted = true;
        }
    });
    handle(RESERVE_INVOKE_CHANNELS.create, async (sender, h: unknown) => {
        const service = await getRoomsService();

        return withPow(sender, opts => service.create(hours(h), opts));
    });
    handle(RESERVE_INVOKE_CHANNELS.extend, async (sender, room: unknown, h: unknown) => {
        const service = await getRoomsService();

        return withPow(sender, opts => service.extend(String(room), hours(h), opts));
    });
    handle(RESERVE_INVOKE_CHANNELS.import, async (_s, link: unknown) =>
        (await getRoomsService()).importLink(String(link ?? '')));
    handle(RESERVE_INVOKE_CHANNELS.rotate, async (_s, room: unknown) => {
        if (!await confirm(parentWindow(), 'rotate', String(room))) {
            return null;
        }

        return (await getRoomsService()).rotate(String(room));
    });
    handle(RESERVE_INVOKE_CHANNELS.delete, async (_s, room: unknown) => {
        if (!await confirm(parentWindow(), 'delete', String(room))) {
            return null;
        }

        return (await getRoomsService()).delete(String(room));
    });
    handle(RESERVE_INVOKE_CHANNELS.remove, async (_s, room: unknown) =>
        (await getRoomsService()).remove(String(room)));
    handle(RESERVE_INVOKE_CHANNELS.joinRoom, async (_s, room: unknown) =>
        (await getRoomsService()).join(String(room)));
    handle(RESERVE_INVOKE_CHANNELS.copy, async (_s, room: unknown, kind: unknown) => {
        const links = await (await getRoomsService()).links(String(room));
        const k = kind as RoomLinkKind;
        let text: string;

        if (k === 'all') {
            text = [
                t('reserve.copyAllHeader', { room: String(room) }),
                `${t('reserve.links.host')}: ${links.host}`,
                `${t('reserve.links.speaker')}: ${links.speaker}`,
                `${t('reserve.links.viewer')}: ${links.viewer}`,
                `${t('reserve.links.manage')}: ${links.manage}`
            ].join('\n');
        } else if (k === 'host' || k === 'manage' || k === 'speaker' || k === 'viewer') {
            text = links[k];
        } else {
            throw new ReserveError('malformed', 0, 'bad link kind');
        }
        clipboard.writeText(text);

        return true;
    });
}
