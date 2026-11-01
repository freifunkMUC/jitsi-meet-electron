import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import { FetchFn, IFetchInit, ReserveClient, checkPow, mapError, mapGone } from '..';

const BASE = 'https://meet.ffmuc.net/reserve';
const SECRET = 'AbCdEfGhIjKlMnOpQrSt_-';
const nodeHash = (s: string) => createHash('sha256').update(s).digest();

interface ICall {
    init?: IFetchInit;
    url: string;
}

/**
 * Builds a fake fetch that answers with the queued responses.
 *
 * @param {Array} responses - Status, body and headers per call.
 * @returns {Object}
 */
function fakeFetch(responses: Array<{ body?: unknown; headers?: Record<string, string>; status: number; }>) {
    const calls: ICall[] = [];
    const fetch: FetchFn = async (url, init) => {
        calls.push({ url, init });
        const r = responses.shift();

        if (!r) {
            throw new Error('offline');
        }

        return {
            headers: { get: (n: string) => r.headers?.[n.toLowerCase()] ?? null },
            ok: r.status >= 200 && r.status < 300,
            status: r.status,
            text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? ''))
        };
    };

    return { calls, fetch };
}

const VIEW = {
    room: 'abcdefghij',
    status: 'active',
    expires: '2027-01-01T00:00:00Z',
    max_ahead_h: 8760,
    durations: [ 72, 168 ],
    host_url: `${BASE}/h/${SECRET}`,
    speaker_url: `${BASE}/s/${SECRET}`,
    guest_url: 'https://meet.ffmuc.net/abcdefghij',
    manage_url: `${BASE}/#k=${SECRET}`
};

const CHALLENGE = { challenge: '1.ab.cd', difficulty: 8, durations: [ 72 ], default: 72, max_ahead_h: 8760 };

describe('mapError', () => {
    it('prefers the reason field', () => {
        assert.equal(mapError(410, { error: 'whatever', reason: 'replaced' }).reason, 'replaced');
        assert.equal(mapError(404, { error: 'x', reason: 'unknown' }).reason, 'unknown');
        assert.equal(mapError(403, { error: 'x', reason: 'insufficient' }).reason, 'pow');
        assert.equal(mapError(403, { error: 'x', reason: 'pow_expired' }).reason, 'pow');
        assert.equal(mapError(410, { error: 'x', reason: 'expired' }).reason, 'expired');
        assert.equal(mapError(429, { error: 'x', reason: 'too_many_requests' }).reason, 'too_many_requests');
    });

    it('falls back to the error text', () => {
        const cases: Array<[number, string, string]> = [
            [ 410, 'room was deleted', 'deleted' ],
            [ 410, 'room expired', 'expired' ],
            [ 410, 'this link was replaced by new links', 'replaced' ],
            [ 404, 'unknown room or not a host link', 'unknown' ],
            [ 400, 'no host link found', 'invalid' ],
            [ 400, 'invalid host link', 'invalid' ],
            [ 400, 'malformed', 'malformed' ],
            [ 400, 'duration not allowed', 'malformed' ],
            [ 500, 'internal', 'internal' ],
            [ 403, 'replay', 'pow' ],
            [ 403, 'bad_mac', 'pow' ],
            [ 403, 'expired', 'pow' ]
        ];

        for (const [ status, error, reason ] of cases) {
            assert.equal(mapError(status, { error }).reason, reason, error);
        }
    });

    it('maps 429 and unknown bodies', () => {
        assert.equal(mapError(429, undefined).reason, 'too_many_requests');
        assert.equal(mapError(429, { error: 'slow down' }).reason, 'too_many_requests');
        assert.equal(mapError(502, undefined).reason, 'internal');
        assert.equal(mapError(400, { error: 'new thing' }).reason, 'unknown');
        assert.equal(mapError(400, { error: 'new thing' }).status, 400);
    });

    it('maps #gone values', () => {
        assert.equal(mapGone('deleted').reason, 'deleted');
        assert.equal(mapGone('replaced').reason, 'replaced');
        assert.equal(mapGone('expired').reason, 'expired');
        assert.equal(mapGone('invalid').reason, 'invalid');
        assert.equal(mapGone('foo').reason, 'invalid');
    });
});

describe('ReserveClient', () => {
    it('reserves a room with a valid proof of work', async () => {
        const { calls, fetch } = fakeFetch([ { status: 200, body: CHALLENGE }, { status: 200, body: VIEW } ]);
        const client = new ReserveClient({ baseURL: `${BASE}/`, fetch, hash: nodeHash });
        const view = await client.reserve(72);

        assert.equal(view.room, 'abcdefghij');
        assert.equal(calls[0].url, `${BASE}/api/challenge`);
        assert.equal(calls[1].url, `${BASE}/api/reserve`);
        const body = JSON.parse(calls[1].init?.body ?? '{}');

        assert.equal(body.hours, 72);
        assert.equal(body.challenge, CHALLENGE.challenge);
        assert.ok(checkPow(body.challenge, body.nonce, CHALLENGE.difficulty));
    });

    it('retries once on a rejected proof of work', async () => {
        const { calls, fetch } = fakeFetch([
            { status: 200, body: CHALLENGE },
            { status: 403, body: { error: 'replay' } },
            { status: 200, body: CHALLENGE },
            { status: 200, body: VIEW }
        ]);
        const view = await new ReserveClient({ baseURL: BASE, fetch }).extend(SECRET, 72);

        assert.equal(view.status, 'active');
        assert.equal(calls.length, 4);
        assert.equal(JSON.parse(calls[3].init?.body ?? '{}').key, SECRET);
    });

    it('maps API errors and network errors', async () => {
        const { fetch } = fakeFetch([ { status: 410, body: { error: 'room was deleted' } } ]);
        const client = new ReserveClient({ baseURL: BASE, fetch });

        await assert.rejects(client.manage(SECRET), { name: 'ReserveError', reason: 'deleted', status: 410 });
        await assert.rejects(client.manage(SECRET), { reason: 'network' });
    });

    it('joins through the join API', async () => {
        const { calls, fetch } = fakeFetch([ { status: 200, body: {
            server: 'meet.ffmuc.net', room: 'abcdefghij', role: 'speaker', jwt: 'a.b.c', jwt_expires: 'x', room_expires: 'y'
        } } ]);
        const info = await new ReserveClient({ baseURL: BASE, fetch }).resolveJoin({
            baseURL: BASE, key: SECRET, kind: 'speaker'
        });

        assert.deepEqual(info, {
            jwt: 'a.b.c', jwtExpires: 'x', role: 'speaker', room: 'abcdefghij', roomExpires: 'y',
            serverURL: 'https://meet.ffmuc.net'
        });
        assert.deepEqual(JSON.parse(calls[0].init?.body ?? '{}'), { key: SECRET, role: 'speaker' });
    });

    it('falls back to the short link redirect when the join API is missing', async () => {
        const { calls, fetch } = fakeFetch([
            { status: 404, body: '404 page not found\n' },
            { status: 302, headers: { location: 'https://meet.ffmuc.net/abcdefghij?jwt=a.b.c' } }
        ]);
        const info = await new ReserveClient({ baseURL: BASE, fetch }).resolveJoin({
            baseURL: BASE, key: SECRET, kind: 'host'
        });

        assert.deepEqual(info, { jwt: 'a.b.c', role: 'host', room: 'abcdefghij', serverURL: 'https://meet.ffmuc.net' });
        assert.equal(calls[1].url, `${BASE}/h/${SECRET}`);
        assert.equal(calls[1].init?.redirect, 'manual');
    });

    it('does not fall back on a JSON 404 from the join API', async () => {
        const { fetch } = fakeFetch([ { status: 404, body: { error: 'unknown room or not a host link' } } ]);

        await assert.rejects(new ReserveClient({ baseURL: BASE, fetch }).resolveJoin({
            baseURL: BASE, key: SECRET, kind: 'host'
        }), { reason: 'unknown' });
    });

    it('maps a #gone redirect to an error', async () => {
        const { fetch } = fakeFetch([ { status: 302, headers: { location: '/reserve/#gone=replaced' } } ]);

        await assert.rejects(new ReserveClient({ baseURL: BASE, fetch }).joinViaRedirect(SECRET, 'speaker'),
            { reason: 'replaced' });
    });

    it('migrates a v1 manage link before it joins', async () => {
        const { calls, fetch } = fakeFetch([
            { status: 200, body: { ...VIEW, migrated: true } },
            { status: 200, body: { room: 'abcdefghij', jwt: 'a.b.c' } }
        ]);
        const info = await new ReserveClient({ baseURL: BASE, fetch }).resolveJoin({
            baseURL: BASE, key: 'v1.token.sig', kind: 'manage', legacy: true
        });

        assert.equal(calls[0].url, `${BASE}/api/manage`);
        assert.deepEqual(JSON.parse(calls[1].init?.body ?? '{}'), { key: SECRET, role: 'host' });
        assert.equal(info.serverURL, 'https://meet.ffmuc.net');
    });
});
