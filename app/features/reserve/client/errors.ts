/**
 * Stable error reasons of the reserve client. UIs translate these.
 */
export type ReserveErrorReason
    = 'aborted'
    | 'deleted'
    | 'expired'
    | 'forbidden'
    | 'internal'
    | 'invalid'
    | 'malformed'
    | 'network'
    | 'not_supported'
    | 'pow'
    | 'replaced'
    | 'too_many_requests'
    | 'unknown';

/**
 * Error of the reserve client.
 */
export class ReserveError extends Error {
    reason: ReserveErrorReason;
    status: number;

    /**
     * Initializes a new {@code ReserveError}.
     *
     * @param {ReserveErrorReason} reason - Stable reason code.
     * @param {number} status - HTTP status, 0 if there was no response.
     * @param {string} message - Server or local message (not for display).
     */
    constructor(reason: ReserveErrorReason, status: number, message: string) {
        super(message);
        this.name = 'ReserveError';
        this.reason = reason;
        this.status = status;
    }
}

const POW_REASONS = [ 'bad_mac', 'insufficient', 'replay' ];

const KNOWN_REASONS: ReserveErrorReason[] = [
    'deleted', 'expired', 'forbidden', 'internal', 'invalid', 'malformed', 'replaced', 'too_many_requests', 'unknown'
];

const MESSAGE_REASONS: Array<[ string, ReserveErrorReason ]> = [
    [ 'room was deleted', 'deleted' ],
    [ 'room expired', 'expired' ],
    [ 'this link was replaced by new links', 'replaced' ],
    [ 'unknown room or not a host link', 'unknown' ],
    [ 'no host link found', 'invalid' ],
    [ 'invalid host link', 'invalid' ],
    [ 'this is not a host link', 'invalid' ],
    [ 'duration not allowed', 'malformed' ],
    [ 'malformed', 'malformed' ],
    [ 'internal', 'internal' ]
];

/**
 * Maps a server reason code (or a v1 PoW message) to a client reason.
 *
 * @param {string} code - Reason code.
 * @param {number} status - HTTP status.
 * @returns {ReserveErrorReason|undefined}
 */
function fromCode(code: string, status: number): ReserveErrorReason | undefined {
    if (code.startsWith('pow') || POW_REASONS.includes(code) || (status === 403 && code === 'expired')) {
        return 'pow';
    }

    return KNOWN_REASONS.find(r => r === code);
}

/**
 * Maps an HTTP error response of the reserve API to a {@code ReserveError}.
 * The {@code reason} field wins; the {@code error} text is the fallback.
 *
 * @param {number} status - HTTP status.
 * @param {unknown} body - Parsed JSON body, if any.
 * @returns {ReserveError}
 */
export function mapError(status: number, body: unknown): ReserveError {
    const b = (body && typeof body === 'object' ? body : {}) as { error?: unknown; reason?: unknown; };
    const message = typeof b.error === 'string' ? b.error : `HTTP ${status}`;

    if (typeof b.reason === 'string') {
        const r = fromCode(b.reason, status);

        if (r) {
            return new ReserveError(r, status, message);
        }
    }

    if (status === 429) {
        return new ReserveError('too_many_requests', status, message);
    }

    if (typeof b.error === 'string') {
        const text = b.error.trim().toLowerCase();
        const match = MESSAGE_REASONS.find(([ m ]) => m === text);

        if (match) {
            return new ReserveError(match[1], status, message);
        }

        const r = fromCode(text, status);

        if (r) {
            return new ReserveError(r, status, message);
        }
    }

    return new ReserveError(status >= 500 ? 'internal' : 'unknown', status, message);
}

/**
 * Maps a {@code #gone=<why>} value of a join redirect to an error.
 *
 * @param {string} why - The value after {@code #gone=}.
 * @returns {ReserveError}
 */
export function mapGone(why: string): ReserveError {
    const r = KNOWN_REASONS.find(k => k === why);

    return new ReserveError(r && r !== 'internal' ? r : 'invalid', 0, `gone: ${why}`);
}
