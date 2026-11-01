import { BrowserWindow, app, ipcMain, nativeTheme } from 'electron';
import fs from 'fs';
import path from 'path';

import { SET_THEME_CHANNEL, THEME_BACKGROUND, isThemeSource } from './theme';

/**
 * File with the last theme setting. The main process reads it at start, so
 * the windows open in the right colours before the renderer loads.
 *
 * @returns {string}
 */
const themeFile = () => path.join(app.getPath('userData'), 'theme.json');

/**
 * Window background colour of the current theme.
 *
 * @returns {string}
 */
export function themeBackgroundColor(): string {
    return nativeTheme.shouldUseDarkColors ? THEME_BACKGROUND.dark : THEME_BACKGROUND.light;
}

/**
 * Applies the saved theme and follows changes of the setting and the OS.
 * Call after app ready.
 *
 * @returns {void}
 */
export function setupThemeMain(): void {
    try {
        const saved = JSON.parse(fs.readFileSync(themeFile(), 'utf8'))?.theme;

        if (isThemeSource(saved)) {
            nativeTheme.themeSource = saved;
        }
    } catch {
        // No saved theme: follow the OS.
    }

    nativeTheme.on('updated', () => {
        for (const win of BrowserWindow.getAllWindows()) {
            win.setBackgroundColor(themeBackgroundColor());
        }
    });

    ipcMain.on(SET_THEME_CHANNEL, (_event, theme: unknown) => {
        if (!isThemeSource(theme) || nativeTheme.themeSource === theme) {
            return;
        }
        nativeTheme.themeSource = theme;
        fs.promises.writeFile(themeFile(), JSON.stringify({ theme }))
            .catch(e => console.error('theme: cannot save the setting', e));
    });
}
