import type { IConference } from '../../types';
import { IReserveLink, parseReserveLink } from '../reserve/client/links';
import { createConferenceObjectFromURL } from '../utils/functions';

/**
 * What the user typed in the welcome field.
 *
 * - empty: nothing; "Go" starts a room with a random name.
 * - name: a room name.
 * - reserve: a host, speaker or manage link. The room name needs a request.
 * - viewer: a meeting link; it shows the room name directly.
 */
export type WelcomeInput =
    | { type: 'empty'; }
    | { type: 'name'; }
    | { link: IReserveLink; type: 'reserve'; }
    | { conference: IConference; type: 'viewer'; };

/**
 * Tells what the user typed in the welcome field.
 *
 * @param {string} input - Field value.
 * @param {string} serverURL - Default server URL.
 * @returns {WelcomeInput}
 */
export function describeWelcomeInput(input: string, serverURL: string): WelcomeInput {
    const value = input.trim();

    if (!value) {
        return { type: 'empty' };
    }

    const link = parseReserveLink(value);

    if (link) {
        return { link, type: 'reserve' };
    }

    if (value.includes('/')) {
        const conference = createConferenceObjectFromURL(value, serverURL);

        if (conference) {
            return { conference, type: 'viewer' };
        }
    }

    return { type: 'name' };
}

/**
 * Host name of a server URL, for texts.
 *
 * @param {string} serverURL - Server URL.
 * @returns {string}
 */
export function serverHost(serverURL: string): string {
    const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(serverURL.trim());

    return m ? m[1] : serverURL;
}
