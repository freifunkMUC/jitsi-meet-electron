/**
 * Reminders before a room expires, in days. Order: largest first.
 */
export const REMINDER_DAYS = [ 3, 1 ];

const DAY_MS = 24 * 3600 * 1000;

/**
 * The last reminder that was shown for a room.
 */
export interface IReminderMark {

    /**
     * Reminder threshold in days.
     */
    days: number;

    /**
     * Room expiry at the time of the reminder. A new expiry starts again.
     */
    expires: string;
}

/**
 * Finds the reminder to show now for a room. Gives only the smallest due
 * threshold, so one check never shows two reminders for one room.
 *
 * @param {string} expires - Room expiry, RFC 3339.
 * @param {IReminderMark} mark - The last reminder for the room.
 * @param {number} now - Current time in ms.
 * @param {number[]} thresholds - Thresholds in days.
 * @returns {number|undefined} The threshold in days, or undefined.
 */
export function dueReminder(
        expires: string | undefined,
        mark: IReminderMark | undefined,
        now: number,
        thresholds: number[] = REMINDER_DAYS): number | undefined {
    const end = expires ? Date.parse(expires) : NaN;

    if (!expires || Number.isNaN(end) || end <= now) {
        return undefined;
    }

    const due = thresholds.filter(d => end - now <= d * DAY_MS);

    if (!due.length) {
        return undefined;
    }

    const days = Math.min(...due);

    if (mark?.expires === expires && mark.days <= days) {
        return undefined;
    }

    return days;
}
