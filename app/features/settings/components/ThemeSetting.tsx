import React from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { Dispatch, compose } from 'redux';
import styled from 'styled-components';

import type { IState, ThemeSource } from '../../../types';
import { setTheme } from '../actions';
import { THEME_SOURCES } from '../theme';

interface IProps extends WithTranslation {
    dispatch: Dispatch;
    theme: ThemeSource;
}

const Label = styled.span`
    color: var(--muted);
    display: block;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
    text-transform: uppercase;
`;

const Group = styled.div`
    background: var(--input-bg);
    border: 1px solid var(--input-line);
    border-radius: var(--radius-sm);
    display: flex;
    gap: 4px;
    padding: 4px;
`;

const Option = styled.button<{ selected: boolean; }>`
    background: ${p => (p.selected ? 'var(--accent-grad)' : 'transparent')};
    border: none;
    border-radius: 9px;
    color: ${p => (p.selected ? '#ffffff' : 'var(--text)')};
    cursor: pointer;
    flex: 1;
    font-size: 13px;
    font-weight: ${p => (p.selected ? 700 : 500)};
    padding: 7px 8px;

    &:hover {
        background: ${p => (p.selected ? 'var(--accent-grad)' : 'var(--hover)')};
    }
`;

const Hint = styled.span`
    color: var(--muted);
    display: block;
    font-size: 12px;
    margin-top: 6px;
`;

/**
 * Theme setting: system, light or dark.
 *
 * @param {IProps} props - Component props.
 * @returns {ReactElement}
 */
function ThemeSetting({ dispatch, t, theme }: IProps) {
    return (
        <div>
            <Label id = 'theme-label'>{ t('settings.theme.label') }</Label>
            <Group
                aria-labelledby = 'theme-label'
                role = 'radiogroup'>
                { THEME_SOURCES.map(source => (
                    <Option
                        aria-checked = { theme === source }
                        key = { source }
                        onClick = { () => dispatch(setTheme(source)) }
                        role = 'radio'
                        selected = { theme === source }
                        type = 'button'>
                        { t(`settings.theme.${source}`) }
                    </Option>
                )) }
            </Group>
            { theme === 'system' && <Hint>{ t('settings.theme.systemHint') }</Hint> }
        </div>
    );
}

/**
 * Maps (parts of) the redux state to the React props.
 *
 * @param {IState} state - The redux state.
 * @returns {Object}
 */
function _mapStateToProps(state: IState) {
    return {
        theme: state.settings.theme ?? 'system'
    };
}

export default compose(connect(_mapStateToProps), withTranslation())(ThemeSetting) as React.ComponentType<any>;
