import { IReserveConference, RESERVE_INVOKE_CHANNELS, ReserveIpcResult } from './types';

/**
 * Resolves a reserve link (host, speaker or manage) in the main process.
 *
 * @param {string} input - The link.
 * @returns {Promise<ReserveIpcResult<IReserveConference>>}
 */
export function joinReserveLink(input: string): Promise<ReserveIpcResult<IReserveConference>> {
    return window.jitsiElectronApp.ipc.invoke(RESERVE_INVOKE_CHANNELS.join, input);
}
