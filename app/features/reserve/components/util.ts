import type { TFunction } from 'i18next';

import { durationParts } from '../functions';

/**
 * Translated duration, e.g. "1 week".
 *
 * @param {TFunction} t - Translate function.
 * @param {number} hours - Duration.
 * @returns {string}
 */
export function formatDuration(t: TFunction, hours: number): string {
    const { count, unit } = durationParts(hours);

    return t(`reserve.duration.${unit}`, { count });
}
