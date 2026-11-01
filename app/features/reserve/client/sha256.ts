/**
 * Small, dependency free SHA-256. It runs in any JS runtime (Node, browser,
 * React Native). Hosts with a native hash (e.g. Node's crypto) can inject that
 * one instead for speed, see {@code HashFn}.
 */

/**
 * Hashes a UTF-8 string and returns the 32 byte digest.
 */
export type HashFn = (input: string) => Uint8Array;

const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

/**
 * Encodes a string as UTF-8.
 *
 * @param {string} input - The string.
 * @returns {Uint8Array}
 */
export function utf8(input: string): Uint8Array {
    const out: number[] = [];

    for (let i = 0; i < input.length; i++) {
        let c = input.charCodeAt(i);

        if (c >= 0xd800 && c < 0xdc00 && i + 1 < input.length) {
            const d = input.charCodeAt(i + 1);

            if (d >= 0xdc00 && d < 0xe000) {
                c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
                i++;
            }
        }

        if (c < 0x80) {
            out.push(c);
        } else if (c < 0x800) {
            out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        } else if (c < 0x10000) {
            out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        } else {
            out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        }
    }

    return new Uint8Array(out);
}

/**
 * Computes the SHA-256 digest of the given bytes.
 *
 * @param {Uint8Array} data - Input bytes.
 * @returns {Uint8Array} The 32 byte digest.
 */
export function sha256Bytes(data: Uint8Array): Uint8Array {
    const bitLen = data.length * 8;
    const padded = new Uint8Array(((data.length + 9 + 63) >> 6) << 6);

    padded.set(data);
    padded[data.length] = 0x80;

    const view = new DataView(padded.buffer);

    view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
    view.setUint32(padded.length - 4, bitLen >>> 0);

    const h = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    const w = new Uint32Array(64);

    for (let off = 0; off < padded.length; off += 64) {
        for (let i = 0; i < 16; i++) {
            w[i] = view.getUint32(off + (i * 4));
        }
        for (let i = 16; i < 64; i++) {
            const x = w[i - 15];
            const y = w[i - 2];
            const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
            const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);

            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }

        let [ a, b, c, d, e, f, g, hh ] = h;

        for (let i = 0; i < 64; i++) {
            const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
            const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) | 0;

            hh = g;
            g = f;
            f = e;
            e = (d + t1) | 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) | 0;
        }

        h[0] += a;
        h[1] += b;
        h[2] += c;
        h[3] += d;
        h[4] += e;
        h[5] += f;
        h[6] += g;
        h[7] += hh;
    }

    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);

    for (let i = 0; i < 8; i++) {
        outView.setUint32(i * 4, h[i]);
    }

    return out;
}

/**
 * Default {@code HashFn}: SHA-256 of the UTF-8 encoded string.
 *
 * @param {string} input - The input string.
 * @returns {Uint8Array}
 */
export const sha256: HashFn = input => sha256Bytes(utf8(input));
