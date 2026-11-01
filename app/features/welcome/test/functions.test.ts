import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeWelcomeInput, lookupWelcomeInput, needsReserveLookup, sameServer, serverHost } from '../functions';

const SERVER = 'https://meet.ffmuc.net';
const SECRET = 'AbCdEfGhIjKlMnOpQrStUv';

describe('describeWelcomeInput', () => {
    it('is empty for blank input', () => {
        assert.deepEqual(describeWelcomeInput('   ', SERVER), { type: 'empty' });
    });

    it('is a name for a plain room name', () => {
        assert.deepEqual(describeWelcomeInput('MyRoom', SERVER), {
            conference: { room: 'MyRoom', serverURL: SERVER },
            type: 'name'
        });
    });

    it('finds host, speaker and manage links', () => {
        const kinds = [
            [ `${SERVER}/reserve/h/${SECRET}`, 'host' ],
            [ `${SERVER}/reserve/s/${SECRET}`, 'speaker' ],
            [ `${SERVER}/reserve/#k=${SECRET}`, 'manage' ],
            [ `ffmuc-meet://meet.ffmuc.net/reserve/h/${SECRET}`, 'host' ]
        ];

        for (const [ input, kind ] of kinds) {
            const d = describeWelcomeInput(input, SERVER);

            assert.equal(d.type, 'reserve', input);
            assert.equal(d.type === 'reserve' && d.link.kind, kind, input);
        }
    });

    it('reads the room of a viewer link', () => {
        const d = describeWelcomeInput(`${SERVER}/r-abc123`, SERVER);

        assert.equal(d.type, 'viewer');
        assert.equal(d.type === 'viewer' && d.conference.room, 'r-abc123');
        assert.equal(d.type === 'viewer' && d.conference.serverURL, SERVER);
    });
});

describe('serverHost', () => {
    it('returns the host of a URL', () => {
        assert.equal(serverHost('https://meet.ffmuc.net/'), 'meet.ffmuc.net');
        assert.equal(serverHost('meet.example.org'), 'meet.example.org');
    });
});

describe('reserve lookups', () => {
    const plain = [
        'MyRoom',
        'r-q6ppmw9xncrj3k',
        `${SERVER}/MyRoom`,
        `${SERVER}/r-q6ppmw9xncrj3k`,
        'https://jitsi.example.com/team',
        'jitsi.example.com/team'
    ];

    it('does not call the reserve service for room names and meeting links', async () => {
        let calls = 0;
        const inspect = async () => {
            calls++;

            return 'info';
        };

        for (const input of plain) {
            assert.equal(needsReserveLookup(input, SERVER), false, input);
            const result = await lookupWelcomeInput(input, SERVER, inspect);

            assert.equal(result.info, undefined, input);
        }
        assert.equal(calls, 0);
    });

    it('calls the reserve service once for a host link', async () => {
        const seen: string[] = [];
        const link = `${SERVER}/reserve/h/${SECRET}`;
        const result = await lookupWelcomeInput(` ${link} `, SERVER, async (l: string) => {
            seen.push(l);

            return 'info';
        });

        assert.equal(needsReserveLookup(link, SERVER), true);
        assert.deepEqual(seen, [ link ]);
        assert.equal(result.info, 'info');
    });
});

describe('sameServer', () => {
    it('compares hosts only', () => {
        assert.equal(sameServer('https://meet.ffmuc.net', 'https://MEET.ffmuc.net/'), true);
        assert.equal(sameServer('https://meet.ffmuc.net', 'https://jitsi.example.com'), false);
    });
});
