import type { ThemeSource } from '../../types';

/**
 * IPC channel from the renderer to the main process with the theme setting.
 */
export const SET_THEME_CHANNEL = 'set-theme';

export const THEME_SOURCES: ThemeSource[] = [ 'system', 'light', 'dark' ];

/**
 * Window background colours of the themes. Same as --bg in styles/theme.css.
 */
export const THEME_BACKGROUND = {
    dark: '#16181d',
    light: '#f3f4f7'
};

/**
 * Tells if a value is a theme source.
 *
 * @param {unknown} value - Value.
 * @returns {boolean}
 */
export function isThemeSource(value: unknown): value is ThemeSource {
    return THEME_SOURCES.includes(value as ThemeSource);
}
