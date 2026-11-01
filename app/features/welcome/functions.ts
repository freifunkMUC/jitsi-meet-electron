import type { IConference } from '../../types';
import { IReserveLink, parseReserveLink } from '../reserve/client/links';
import { createConferenceObjectFromURL } from '../utils/functions';

/**
 * What the user typed in the welcome field.
 *
 * - empty: nothing; "Go" starts a room with a random name.
 * - name: a room name on the default server.
 * - reserve: a host, speaker or manage link. The room name needs a request.
 * - viewer: a meeting link; it shows the room name directly.
 */
export type WelcomeInput =
    | { type: 'empty'; }
    | { conference: IConference; type: 'name'; }
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

    const conference = createConferenceObjectFromURL(value, serverURL);

    return conference ? { conference, type: 'name' } : { type: 'empty' };
}

/**
 * Tells if the input needs a request to the reserve service. Only host,
 * speaker and manage links do. Room names and meeting links never do.
 *
 * @param {string} input - Field value.
 * @param {string} serverURL - Default server URL.
 * @returns {boolean}
 */
export function needsReserveLookup(input: string, serverURL: string): boolean {
    return describeWelcomeInput(input, serverURL).type === 'reserve';
}

/**
 * Looks up the input. Calls the reserve service only for reserve links.
 *
 * @param {string} input - Field value.
 * @param {string} serverURL - Default server URL.
 * @param {Function} inspect - Asks the reserve service about a link.
 * @returns {Promise<Object>} The input type and, for reserve links, the answer.
 */
export async function lookupWelcomeInput<T>(
        input: string,
        serverURL: string,
        inspect: (link: string) => Promise<T>
): Promise<{ info?: T; input: WelcomeInput; }> {
    const described = describeWelcomeInput(input, serverURL);

    if (described.type !== 'reserve') {
        return { input: described };
    }

    return { info: await inspect(input.trim()), input: described };
}

/**
 * Tells if two server URLs point to the same host.
 *
 * @param {string} a - Server URL.
 * @param {string} b - Server URL.
 * @returns {boolean}
 */
export function sameServer(a: string, b: string): boolean {
    return serverHost(a).toLowerCase() === serverHost(b).toLowerCase();
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
