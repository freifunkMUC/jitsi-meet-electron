import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FetchFn, JOIN_CACHE_MARGIN_MS, JoinCache, ReserveClient, jwtExpiry, mapError } from '..';

const BASE = 'https://meet.ffmuc.net/reserve';
const SECRET = 'AbCdEfGhIjKlMnOpQrSt_-';
const NOW = Date.parse('2026-11-01T12:00:00Z');

/**
 * Builds an unsigned JWT with an exp claim.
 *
 * @param {number} expMs - Expiry in ms.
 * @returns {string}
 */
function token(expMs: number): string {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

    return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(expMs / 1000) })}.sig`;
}

describe('JoinCache', () => {
    it('reads the exp claim of a JWT', () => {
        assert.equal(jwtExpiry(token(NOW)), NOW);
        assert.equal(jwtExpiry('not-a-jwt'), undefined);
    });

    it('reuses a token until the margin before expiry', () => {
        let now = NOW;
        const cache = new JoinCache(() => now);
        const info = {
            jwt: 'a.b.c', jwtExpires: new Date(NOW + 3600_000).toISOString(),
            role: 'host' as const, room: 'r', serverURL: 'https://meet.ffmuc.net'
        };

        cache.set(SECRET, info);
        assert.equal(cache.get(SECRET, 'host'), info);
        assert.equal(cache.get(SECRET, 'speaker'), undefined);
        now = NOW + 3600_000 - JOIN_CACHE_MARGIN_MS;
        assert.equal(cache.get(SECRET, 'host'), undefined);
    });

    it('uses the JWT exp claim when jwt_expires is missing, and forgets a secret', () => {
        const cache = new JoinCache(() => NOW);

        cache.set(SECRET, { jwt: token(NOW + 3600_000), role: 'speaker', room: 'r', serverURL: 's' });
        assert.ok(cache.get(SECRET, 'speaker'));
        cache.forget(SECRET);
        assert.equal(cache.get(SECRET, 'speaker'), undefined);
    });

    it('does not store tokens that expire soon or have no expiry', () => {
        const cache = new JoinCache(() => NOW);

        cache.set(SECRET, { jwt: token(NOW + 60_000), role: 'host', room: 'r', serverURL: 's' });
        cache.set('other', { jwt: 'opaque', role: 'host', room: 'r', serverURL: 's' });
        assert.equal(cache.get(SECRET, 'host'), undefined);
        assert.equal(cache.get('other', 'host'), undefined);
    });

    it('lets resolveJoin call the join API only once per token', async () => {
        let calls = 0;
        const fetch: FetchFn = async () => {
            calls++;

            return {
                headers: { get: () => null },
                ok: true,
                status: 200,
                text: async () => JSON.stringify({
                    server: 'https://meet.ffmuc.net', room: 'r', role: 'host', jwt: 'a.b.c',
                    jwt_expires: new Date(Date.now() + 3600_000).toISOString()
                })
            };
        };
        const client = new ReserveClient({ baseURL: BASE, fetch, joinCache: new JoinCache() });
        const link = { baseURL: BASE, key: SECRET, kind: 'host' as const };

        await client.resolveJoin(link);
        await client.resolveJoin(link);
        assert.equal(calls, 1);
    });
});

describe('mapError (final join API codes)', () => {
    it('maps forbidden and pow_ codes', () => {
        assert.equal(mapError(403, { error: 'x', reason: 'forbidden' }).reason, 'forbidden');
        for (const r of [ 'pow_malformed', 'pow_bad_mac', 'pow_expired', 'pow_insufficient', 'pow_replay' ]) {
            assert.equal(mapError(403, { error: 'x', reason: r }).reason, 'pow', r);
        }
        assert.equal(mapError(400, { error: 'x', reason: 'unknown' }).reason, 'unknown');
    });
});
