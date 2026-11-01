// Pure helpers of "My rooms". No Electron, DOM or React imports.

const HOUR_MS = 60 * 60 * 1000;

export type DurationUnit = 'days' | 'hours' | 'weeks' | 'years';

/**
 * Splits a duration in hours into the largest whole unit.
 *
 * @param {number} hours - Duration.
 * @returns {{count: number, unit: DurationUnit}}
 */
export function durationParts(hours: number): { count: number; unit: DurationUnit; } {
    if (hours % 8760 === 0) {
        return { count: hours / 8760, unit: 'years' };
    }
    if (hours % 168 === 0) {
        return { count: hours / 168, unit: 'weeks' };
    }
    if (hours % 24 === 0) {
        return { count: hours / 24, unit: 'days' };
    }

    return { count: hours, unit: 'hours' };
}

export interface IExtendOption {

    /**
     * False if the room cannot get more time with this duration.
     */
    enabled: boolean;
    hours: number;

    /**
     * New expiry in ms since epoch. The service limits it to now + max ahead.
     */
    newExpires: number;
}

/**
 * Computes the extend choices of a room. Same rule as the service: the new
 * expiry is the old one plus the duration, but not later than now + max ahead.
 *
 * @param {string} expires - Current expiry, RFC 3339.
 * @param {number[]} durations - Durations in hours.
 * @param {number} maxAheadH - Max ahead in hours.
 * @param {number} now - Now in ms.
 * @returns {IExtendOption[]}
 */
export function extendOptions(expires: string, durations: number[], maxAheadH: number, now: number): IExtendOption[] {
    const current = Date.parse(expires);
    const limit = now + (maxAheadH * HOUR_MS);

    return durations.map(hours => {
        const newExpires = Math.max(current, Math.min(current + (hours * HOUR_MS), limit));

        return { enabled: current > now && newExpires > current, hours, newExpires };
    });
}

/**
 * Days until a room expires, rounded down. Negative if expired.
 *
 * @param {string} expires - Expiry, RFC 3339.
 * @param {number} now - Now in ms.
 * @returns {number}
 */
export function daysLeft(expires: string, now: number): number {
    return Math.floor((Date.parse(expires) - now) / (24 * HOUR_MS));
}
