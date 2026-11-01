import { ReserveError } from './errors';
import { HashFn, sha256 } from './sha256';

/**
 * Called while the solver runs.
 *
 * @param tried - Number of nonces tried so far.
 * @param expected - Average number of tries needed for the difficulty.
 */
export type PowProgressFn = (tried: number, expected: number) => void;

export interface ISolveOptions {

    /**
     * Number of hashes per chunk. The solver yields to the event loop after each
     * chunk so the host stays responsive.
     */
    chunkSize?: number;

    /**
     * Hash function. Defaults to the built-in pure JS SHA-256.
     */
    hash?: HashFn;

    onProgress?: PowProgressFn;

    /**
     * Aborts the search when {@code aborted} becomes true.
     */
    signal?: { aborted: boolean; };
}

/**
 * Counts the leading zero bits of a digest.
 *
 * @param {Uint8Array} digest - The digest.
 * @returns {number}
 */
export function leadingZeroBits(digest: Uint8Array): number {
    let n = 0;

    for (const byte of digest) {
        if (byte === 0) {
            n += 8;
            continue;
        }

        return n + Math.clz32(byte) - 24;
    }

    return n;
}

/**
 * Checks a proof of work: SHA-256(challenge + ":" + nonce) must have at least
 * {@code difficulty} leading zero bits.
 *
 * @param {string} challenge - The server challenge.
 * @param {string} nonce - The decimal nonce.
 * @param {number} difficulty - Required leading zero bits.
 * @param {HashFn} hash - Hash function.
 * @returns {boolean}
 */
export function checkPow(challenge: string, nonce: string, difficulty: number, hash: HashFn = sha256): boolean {
    return leadingZeroBits(hash(`${challenge}:${nonce}`)) >= difficulty;
}

/**
 * Finds the first decimal nonce, counting up from 0, that solves the challenge.
 * The search runs in chunks and yields between them.
 *
 * @param {string} challenge - The server challenge.
 * @param {number} difficulty - Required leading zero bits.
 * @param {ISolveOptions} options - Options.
 * @returns {Promise<string>} The nonce.
 */
export async function solvePow(challenge: string, difficulty: number, options: ISolveOptions = {}): Promise<string> {
    const { chunkSize = 20000, hash = sha256, onProgress, signal } = options;
    const expected = 2 ** difficulty;
    const prefix = `${challenge}:`;

    for (let nonce = 0; ; nonce++) {
        if (leadingZeroBits(hash(prefix + nonce)) >= difficulty) {
            onProgress?.(nonce + 1, expected);

            return String(nonce);
        }

        if ((nonce + 1) % chunkSize === 0) {
            onProgress?.(nonce + 1, expected);
            await new Promise(resolve => setTimeout(resolve, 0));
            if (signal?.aborted) {
                throw new ReserveError('aborted', 0, 'aborted');
            }
        }
    }
}
