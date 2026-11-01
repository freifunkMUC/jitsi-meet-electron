import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import {
    checkPow,
    leadingZeroBits,
    sha256,
    solvePow
} from '..';

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const nodeHash = (s: string) => createHash('sha256').update(s).digest();

const CHALLENGE = '1700000000.0123456789abcdef01234567.00112233445566778899aabbccddeeff';

describe('sha256', () => {
    it('matches FIPS 180-2 vectors', () => {
        assert.equal(hex(sha256('')), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        assert.equal(hex(sha256('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
        assert.equal(
            hex(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
            '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    });

    it('matches node crypto for many lengths and UTF-8 input', () => {
        for (let n = 0; n < 200; n++) {
            const s = `${'x'.repeat(n)}ä€😀`;

            assert.equal(hex(sha256(s)), nodeHash(s).toString('hex'));
        }
    });
});

describe('pow', () => {
    it('counts leading zero bits', () => {
        assert.equal(leadingZeroBits(new Uint8Array([ 0, 0, 0x1b ])), 19);
        assert.equal(leadingZeroBits(new Uint8Array([ 0x80 ])), 0);
        assert.equal(leadingZeroBits(new Uint8Array([ 0, 0 ])), 16);
    });

    it('solves a known vector with the built-in hash', async () => {
        assert.equal(await solvePow(CHALLENGE, 12), '378');
        assert.ok(checkPow(CHALLENGE, '378', 12));
        assert.ok(!checkPow(CHALLENGE, '377', 12));
    });

    it('solves a known vector at server difficulty with an injected hash and reports progress', async () => {
        const seen: number[] = [];
        const nonce = await solvePow(CHALLENGE, 18, {
            chunkSize: 4096,
            hash: nodeHash,
            onProgress: tried => seen.push(tried)
        });

        assert.equal(nonce, '14777');
        assert.deepEqual(seen, [ 4096, 8192, 12288, 14778 ]);
    });

    it('aborts', async () => {
        const signal = { aborted: true };

        await assert.rejects(solvePow(CHALLENGE, 30, { chunkSize: 10, signal }), { reason: 'aborted' });
    });
});
