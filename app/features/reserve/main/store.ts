import { promises as fs } from 'fs';

/**
 * A room in "My rooms". Only these fields reach the disk, and only encrypted.
 */
export interface IStoredRoom {

    /**
     * Cached room expiry, RFC 3339.
     */
    expires?: string;
    room: string;

    /**
     * Host secret of the room.
     */
    secret: string;
}

/**
 * Encryption of the operating system (Electron safeStorage in the app).
 */
export interface IEncryptor {
    decryptString: (data: Buffer) => string;
    encryptString: (text: string) => Buffer;

    /**
     * True if the data is encrypted with a key of the operating system.
     */
    isAvailable: () => boolean;
}

const FILE_VERSION = 1;

/**
 * Keeps the rooms of the user. Writes them to one encrypted file. When the
 * operating system has no secure encryption, the rooms stay in memory only.
 */
export class RoomStore {
    private _encryptor: IEncryptor;
    private _file: string;
    private _rooms: IStoredRoom[] = [];
    private _writing: Promise<void> = Promise.resolve();

    /**
     * Initializes a new {@code RoomStore}.
     *
     * @param {string} file - Path of the encrypted file.
     * @param {IEncryptor} encryptor - Encryption.
     */
    constructor(file: string, encryptor: IEncryptor) {
        this._file = file;
        this._encryptor = encryptor;
    }

    /**
     * True if the rooms are written to disk.
     *
     * @returns {boolean}
     */
    get persistent(): boolean {
        return this._encryptor.isAvailable();
    }

    /**
     * Reads the file. Errors give an empty list.
     *
     * @returns {Promise<void>}
     */
    async load(): Promise<void> {
        if (!this.persistent) {
            return;
        }

        try {
            const data = JSON.parse(this._encryptor.decryptString(await fs.readFile(this._file)));

            if (data?.v === FILE_VERSION && Array.isArray(data.rooms)) {
                this._rooms = data.rooms
                    .filter((r: any) => typeof r?.room === 'string' && typeof r?.secret === 'string')
                    .map((r: any) => this._clean(r));
            }
        } catch (e: any) {
            if (e?.code !== 'ENOENT') {
                console.error('reserve: cannot read the rooms file', e);
            }
        }
    }

    /**
     * All rooms, newest first.
     *
     * @returns {IStoredRoom[]}
     */
    list(): IStoredRoom[] {
        return this._rooms.map(r => ({ ...r }));
    }

    /**
     * Gets a room.
     *
     * @param {string} room - Room name.
     * @returns {IStoredRoom|undefined}
     */
    get(room: string): IStoredRoom | undefined {
        const r = this._rooms.find(x => x.room === room);

        return r && { ...r };
    }

    /**
     * Adds a room or updates it.
     *
     * @param {IStoredRoom} room - Room.
     * @returns {Promise<void>}
     */
    put(room: IStoredRoom): Promise<void> {
        const i = this._rooms.findIndex(x => x.room === room.room);
        const clean = this._clean(room);

        if (i === -1) {
            this._rooms.unshift(clean);
        } else {
            this._rooms[i] = { ...this._rooms[i], ...clean };
        }

        return this._save();
    }

    /**
     * Removes a room from the list.
     *
     * @param {string} room - Room name.
     * @returns {Promise<void>}
     */
    remove(room: string): Promise<void> {
        this._rooms = this._rooms.filter(x => x.room !== room);

        return this._save();
    }

    /**
     * Keeps only the known fields.
     *
     * @param {IStoredRoom} r - Room.
     * @returns {IStoredRoom}
     */
    protected _clean(r: IStoredRoom): IStoredRoom {
        return {
            expires: typeof r.expires === 'string' ? r.expires : undefined,
            room: r.room,
            secret: r.secret
        };
    }

    /**
     * Writes the file. Writes run one after the other.
     *
     * @returns {Promise<void>}
     */
    private _save(): Promise<void> {
        if (!this.persistent) {
            return Promise.resolve();
        }

        const data = this._encryptor.encryptString(JSON.stringify({ v: FILE_VERSION, rooms: this._rooms }));
        const tmp = `${this._file}.tmp`;

        this._writing = this._writing
            .catch(() => undefined)
            .then(async () => {
                await fs.writeFile(tmp, data, { mode: 0o600 });
                await fs.rename(tmp, this._file);
            });

        return this._writing;
    }
}
