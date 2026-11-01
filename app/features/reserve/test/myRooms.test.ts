import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { FetchFn, JoinCache, ReserveClient } from '../client';
import { durationParts, extendOptions } from '../functions';
import { RoomsService } from '../main/rooms';
import { IEncryptor, RoomStore } from '../main/store';

const BASE = 'https://meet.ffmuc.net/reserve';
const S1 = 'AbCdEfGhIjKlMnOpQrSt_-';
const S2 = 'ZyXwVuTsRqPoNmLkJiHg-_';
const HOUR = 3600_000;

const fakeEncryptor = (available = true): IEncryptor => ({
    decryptString: b => Buffer.from(b.toString(), 'base64').toString(),
    encryptString: s => Buffer.from(Buffer.from(s).toString('base64')),
    isAvailable: () => available
});

const tmpFile = async () => path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'reserve-')), 'rooms.bin');

const view = (secret: string, extra: object = {}) => ({
    room: 'abcdefghij',
    status: 'active',
    expires: '2027-01-01T00:00:00Z',
    max_ahead_h: 8760,
    durations: [ 72, 168 ],
    host_url: `${BASE}/h/${secret}`,
    speaker_url: `${BASE}/s/x`,
    guest_url: 'https://meet.ffmuc.net/abcdefghij',
    manage_url: `${BASE}/#k=${secret}`,
    ...extra
});

/**
 * Fake fetch with queued JSON responses.
 *
 * @param {Array} responses - Responses.
 * @returns {Object}
 */
function fakeFetch(responses: Array<{ body: unknown; status: number; }>) {
    const urls: string[] = [];
    const fetch: FetchFn = async url => {
        urls.push(url);
        const r = responses.shift();

        if (!r) {
            throw new Error('offline');
        }

        return {
            headers: { get: () => null },
            ok: r.status < 300,
            status: r.status,
            text: async () => JSON.stringify(r.body)
        };
    };

    return { fetch, urls };
}

describe('RoomStore', () => {
    it('writes only encrypted known fields and reads them back', async () => {
        const file = await tmpFile();
        const store = new RoomStore(file, fakeEncryptor());

        await store.put({ room: 'r1', secret: S1, expires: '2027-01-01T00:00:00Z', jwt: 'x' } as any);
        const raw = await fs.readFile(file, 'utf8');

        assert.ok(!raw.includes(S1), 'secret must not be in plain text');

        const again = new RoomStore(file, fakeEncryptor());

        await again.load();
        assert.deepEqual(again.list(), [ { room: 'r1', secret: S1, expires: '2027-01-01T00:00:00Z', reminded: undefined } ]);
    });

    it('keeps rooms in memory only when encryption is not available', async () => {
        const file = await tmpFile();
        const store = new RoomStore(file, fakeEncryptor(false));

        await store.put({ room: 'r1', secret: S1 });
        assert.equal(store.persistent, false);
        assert.equal(store.list().length, 1);
        await assert.rejects(fs.stat(file), { code: 'ENOENT' });
    });
});

describe('RoomsService', () => {
    it('imports a room, rotates its links and forgets cached tokens', async () => {
        const { fetch, urls } = fakeFetch([
            { status: 200, body: view(S1) },
            { status: 200, body: view(S2) }
        ]);
        const cache = new JoinCache();
        const store = new RoomStore(await tmpFile(), fakeEncryptor());
        const service = new RoomsService(store, new ReserveClient({ baseURL: BASE, fetch }), cache);

        cache.set(S1, { jwt: 'j', jwtExpires: new Date(Date.now() + HOUR).toISOString(), role: 'host', room: 'r',
            serverURL: 's' });

        const summary = await service.importLink(`${BASE}/#k=${S1}`);

        assert.equal(summary.room, 'abcdefghij');
        assert.equal(summary.status, 'active');
        assert.equal(JSON.stringify(summary).includes(S1), false, 'summary has no secret');
        await service.rotate('abcdefghij');
        assert.equal(store.get('abcdefghij')?.secret, S2);
        assert.equal(cache.get(S1, 'host'), undefined);
        assert.deepEqual(urls, [ `${BASE}/api/manage`, `${BASE}/api/rotate` ]);
    });

    it('marks a deleted room and keeps it in the list', async () => {
        const { fetch } = fakeFetch([ { status: 200, body: { deleted: true } } ]);
        const store = new RoomStore(await tmpFile(), fakeEncryptor(false));

        await store.put({ room: 'r1', secret: S1, expires: '2027-01-01T00:00:00Z' });
        const service = new RoomsService(store, new ReserveClient({ baseURL: BASE, fetch }), new JoinCache());
        const summary = await service.delete('r1');

        assert.equal(summary.room, 'r1');
        assert.equal(summary.status, 'deleted');
        assert.equal(store.list().length, 1);
    });

    it('marks replaced rooms and checks a room at most once per interval', async () => {
        const { fetch, urls } = fakeFetch([
            { status: 410, body: { error: 'this link was replaced by new links', reason: 'replaced' } }
        ]);
        const store = new RoomStore(await tmpFile(), fakeEncryptor(false));

        await store.put({ room: 'r1', secret: S1 });
        const service = new RoomsService(store, new ReserveClient({ baseURL: BASE, fetch }), new JoinCache());

        assert.equal((await service.refresh()).rooms[0].status, 'replaced');
        await service.refresh();
        assert.equal(urls.length, 1);
    });
});

describe('My rooms helpers', () => {
    it('formats durations with the largest unit', () => {
        assert.deepEqual(durationParts(72), { count: 3, unit: 'days' });
        assert.deepEqual(durationParts(168), { count: 1, unit: 'weeks' });
        assert.deepEqual(durationParts(720), { count: 30, unit: 'days' });
        assert.deepEqual(durationParts(8760), { count: 1, unit: 'years' });
        assert.deepEqual(durationParts(5), { count: 5, unit: 'hours' });
    });

    it('limits extensions to now + max ahead like the service', () => {
        const now = Date.parse('2026-11-01T00:00:00Z');
        const expires = new Date(now + (8000 * HOUR)).toISOString();
        const [ d3, y1 ] = extendOptions(expires, [ 72, 8760 ], 8760, now);

        assert.equal(d3.enabled, true);
        assert.equal(d3.newExpires, now + (8072 * HOUR));
        assert.equal(y1.newExpires, now + (8760 * HOUR));

        const atLimit = extendOptions(new Date(now + (8760 * HOUR)).toISOString(), [ 72 ], 8760, now);

        assert.equal(atLimit[0].enabled, false);
        assert.equal(extendOptions(new Date(now - HOUR).toISOString(), [ 72 ], 8760, now)[0].enabled, false);
    });
});
