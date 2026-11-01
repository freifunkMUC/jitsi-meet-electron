import { AnyAction, Dispatch, MiddlewareAPI } from 'redux';
import { REHYDRATE } from 'redux-persist';

import type { IState } from '../../types';

import { SET_THEME } from './actionTypes';
import { SET_THEME_CHANNEL } from './theme';

/**
 * Sends the theme setting to the main process. The main process sets
 * nativeTheme.themeSource; the CSS colour scheme follows it.
 *
 * @param {MiddlewareAPI} store - Redux store.
 * @returns {Function}
 */
export default (store: MiddlewareAPI<Dispatch, IState>) => (next: Dispatch) => (action: AnyAction) => {
    const result = next(action);

    if (action.type === SET_THEME || action.type === REHYDRATE) {
        window.jitsiElectronApp?.ipc.send(SET_THEME_CHANNEL, store.getState().settings.theme ?? 'system');
    }

    return result;
};
