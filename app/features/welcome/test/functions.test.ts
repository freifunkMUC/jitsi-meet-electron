import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeWelcomeInput, serverHost } from '../functions';

const SERVER = 'https://meet.ffmuc.net';
const SECRET = 'AbCdEfGhIjKlMnOpQrStUv';

describe('describeWelcomeInput', () => {
    it('is empty for blank input', () => {
        assert.deepEqual(describeWelcomeInput('   ', SERVER), { type: 'empty' });
    });

    it('is a name for a plain room name', () => {
        assert.deepEqual(describeWelcomeInput('MyRoom', SERVER), { type: 'name' });
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
