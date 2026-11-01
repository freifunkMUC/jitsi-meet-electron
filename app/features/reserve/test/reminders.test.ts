import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { FetchFn, JoinCache, ReserveClient } from '../client';
import { RoomsService } from '../main/rooms';
import { RoomStore } from '../main/store';
import { dueReminder } from '../reminders';

const DAY = 24 * 3600 * 1000;
const NOW = Date.parse('2026-11-01T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

describe('dueReminder', () => {
    it('gives the smallest due threshold once per expiry', () => {
        assert.equal(dueReminder(iso(NOW + (5 * DAY)), undefined, NOW), undefined);
        assert.equal(dueReminder(iso(NOW + (2 * DAY)), undefined, NOW), 3);
        assert.equal(dueReminder(iso(NOW + (DAY / 2)), undefined, NOW), 1);

        const expires = iso(NOW + (2 * DAY));

        assert.equal(dueReminder(expires, { days: 3, expires }, NOW), undefined);
        assert.equal(dueReminder(expires, { days: 3, expires }, NOW + (1.5 * DAY)), 1);
        assert.equal(dueReminder(expires, { days: 1, expires }, NOW + (1.5 * DAY)), undefined);
    });

    it('starts again after an extension and ignores expired rooms', () => {
        const old = iso(NOW + DAY);

        assert.equal(dueReminder(iso(NOW + (2 * DAY)), { days: 1, expires: old }, NOW), 3);
        assert.equal(dueReminder(iso(NOW - 1), undefined, NOW), undefined);
        assert.equal(dueReminder(undefined, undefined, NOW), undefined);
    });
});

describe('RoomsService reminders', () => {
    it('reminds active rooms once and keeps the mark after a refresh', async () => {
        const expires = iso(NOW + (2 * DAY));
        const fetch: FetchFn = async () => {
            return {
                headers: { get: () => null },
                ok: true,
                status: 200,
                text: async () => JSON.stringify({
                    expires,
                    manage_url: 'https://meet.ffmuc.net/reserve/#k=AbCdEfGhIjKlMnOpQrSt_-',
                    room: 'r1',
                    status: 'active'
                })
            };
        };
        const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'reserve-')), 'rooms.bin');
        const store = new RoomStore(file, {
            decryptString: b => b.toString(),
            encryptString: s => Buffer.from(s),
            isAvailable: () => true
        });

        await store.put({ expires, room: 'r1', secret: 'AbCdEfGhIjKlMnOpQrSt_-' });
        await store.put({ expires: iso(NOW - DAY), room: 'gone', secret: 'ZyXwVuTsRqPoNmLkJiHg-_' });

        const service = new RoomsService(store, new ReserveClient({ baseURL: 'https://meet.ffmuc.net/reserve', fetch }),
            new JoinCache(), () => NOW);

        assert.deepEqual(service.dueReminders(), [ { days: 3, expires, room: 'r1' } ]);
        await service.markReminded('r1', 3, expires);
        await service.importLink('https://meet.ffmuc.net/reserve/#k=AbCdEfGhIjKlMnOpQrSt_-');
        assert.deepEqual(service.dueReminders(), []);

        const reloaded = new RoomStore(file, {
            decryptString: b => b.toString(),
            encryptString: s => Buffer.from(s),
            isAvailable: () => true
        });

        await reloaded.load();
        assert.deepEqual(reloaded.get('r1')?.reminded, { days: 3, expires });
    });
});
