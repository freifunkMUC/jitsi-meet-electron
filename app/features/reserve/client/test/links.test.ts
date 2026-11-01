import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { joinLink, manageLink, normalizeLinkInput, parseReserveLink } from '..';

const SECRET = 'AbCdEfGhIjKlMnOpQrSt_-';
const BASE = 'https://meet.ffmuc.net/reserve';

describe('parseReserveLink', () => {
    it('parses host links', () => {
        for (const input of [
            `${BASE}/h/${SECRET}`,
            `  ${BASE}/h/${SECRET}/ `,
            `meet.ffmuc.net/reserve/h/${SECRET}`,
            `ffmuc-meet://meet.ffmuc.net/reserve/h/${SECRET}`,
            `jitsi-meet://meet.ffmuc.net/reserve/h/${SECRET}`,
            `HTTPS://Meet.FFMUC.net/reserve/h/${SECRET}?utm=x`
        ]) {
            assert.deepEqual(parseReserveLink(input), { baseURL: BASE, key: SECRET, kind: 'host' }, input);
        }
    });

    it('parses speaker links', () => {
        assert.deepEqual(parseReserveLink(`${BASE}/s/${SECRET}`), { baseURL: BASE, key: SECRET, kind: 'speaker' });
    });

    it('parses manage links', () => {
        assert.deepEqual(parseReserveLink(`${BASE}/#k=${SECRET}`), { baseURL: BASE, key: SECRET, kind: 'manage' });
        assert.deepEqual(parseReserveLink(`${BASE}#k=${SECRET}`), { baseURL: BASE, key: SECRET, kind: 'manage' });
        assert.deepEqual(parseReserveLink(`${BASE}/?lang=de#k=${SECRET}`),
            { baseURL: BASE, key: SECRET, kind: 'manage' });
    });

    it('parses v1 manage links', () => {
        assert.deepEqual(parseReserveLink(`${BASE}/#m=aaa.bbb.ccc`),
            { baseURL: BASE, key: 'aaa.bbb.ccc', kind: 'manage', legacy: true });
    });

    it('keeps the server of the link', () => {
        assert.equal(parseReserveLink(`https://meet.example.org/reserve/h/${SECRET}`)?.baseURL,
            'https://meet.example.org/reserve');
    });

    it('supports another base path', () => {
        assert.deepEqual(parseReserveLink(`https://x.org/book/s/${SECRET}`, '/book'),
            { baseURL: 'https://x.org/book', key: SECRET, kind: 'speaker' });
    });

    it('ignores other input', () => {
        for (const input of [
            '',
            '   ',
            'myroom',
            'https://meet.ffmuc.net/myroom',
            'https://meet.ffmuc.net/myroom?jwt=abc',
            `${BASE}/`,
            `${BASE}/#gone=deleted`,
            `${BASE}/h/short`,
            `${BASE}/h/${SECRET}x`,
            `${BASE}/x/${SECRET}`,
            `https://meet.ffmuc.net/other/h/${SECRET}`,
            `https://meet.ffmuc.net/h/${SECRET}`
        ]) {
            assert.equal(parseReserveLink(input), undefined, input);
        }
    });
});

describe('link helpers', () => {
    it('normalizes input', () => {
        assert.equal(normalizeLinkInput('meet.ffmuc.net/a'), 'https://meet.ffmuc.net/a');
        assert.equal(normalizeLinkInput('http://x/a'), 'http://x/a');
        assert.equal(normalizeLinkInput('ffmuc-meet://x/a'), 'https://x/a');
    });

    it('builds links', () => {
        assert.equal(joinLink(BASE, SECRET), `${BASE}/h/${SECRET}`);
        assert.equal(joinLink(BASE, SECRET, 'speaker'), `${BASE}/s/${SECRET}`);
        assert.equal(manageLink(BASE, SECRET), `${BASE}/#k=${SECRET}`);
        assert.deepEqual(parseReserveLink(manageLink(BASE, SECRET))?.key, SECRET);
    });
});
