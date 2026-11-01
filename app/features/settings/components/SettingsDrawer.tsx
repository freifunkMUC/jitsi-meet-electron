
import React, { Component } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { Dispatch, compose } from 'redux';
import styled from 'styled-components';

import { DrawerContainer, Logo, closeDrawer } from '../../navbar';
import { ArrowLeftIcon } from '../../shared/icons';
import {
    setDisableAGC, setWindowAlwaysOnTop
} from '../actions';
import { SettingsContainer, TogglesContainer } from '../styled';

import ServerTimeoutField from './ServerTimeoutField';
import ServerURLField from './ServerURLField';
import SettingToggle from './SettingToggle';
import ThemeSetting from './ThemeSetting';

interface IProps extends WithTranslation {
    dispatch: Dispatch;
    isOpen?: boolean;
}

const getDrawerTransform = (props: { isOpen?: boolean; }) => {
    if (props.isOpen) {
        return 'translateX(0)';
    }

    return 'translateX(-100%)';
};

const Drawer = styled.div<{ isOpen?: boolean; }>`
    background: var(--bg);
    border-right: 1px solid var(--line);
    box-shadow: ${p => (p.isOpen ? 'var(--drawer-shadow)' : 'none')};
    color: var(--text);
    display: flex;
    flex-direction: column;
    height: 100vh;
    left: 0;
    overflow-y: auto;
    position: fixed;
    top: 0;
    transform: ${getDrawerTransform};
    transition: transform 0.25s ease;
    width: min(400px, 100vw);
    z-index: 400;
`;

const DrawerHeader = styled.div`
    align-items: center;
    background: var(--bg);
    display: flex;
    gap: 12px;
    padding: 16px;
    position: sticky;
    top: 0;
    z-index: 1;
`;

const BackButton = styled.button`
    align-items: center;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    display: flex;
    padding: 4px;

    &:hover {
        opacity: 0.8;
    }
`;


/**
 * Drawer that opens when SettingsAction is clicked.
 */
class SettingsDrawer extends Component<IProps> {
    /**
     * Initializes a new {@code SettingsDrawer} instance.
     *
     * @inheritdoc
     */
    constructor(props: IProps) {
        super(props);

        this._onBackButton = this._onBackButton.bind(this);
    }

    /**
     * Render function of component.
     *
     * @returns {ReactElement}
     */
    render() {
        const { t } = this.props;

        return (
            <Drawer isOpen = { this.props.isOpen }>
                <DrawerHeader>
                    <BackButton
                        aria-label = { t('settings.back') }
                        onClick = { this._onBackButton }>
                        <ArrowLeftIcon
                            size = { 24 } />
                    </BackButton>
                    <Logo />
                </DrawerHeader>
                <DrawerContainer>
                    <SettingsContainer>
                        <ThemeSetting />
                        <ServerURLField />
                        <ServerTimeoutField />
                        <TogglesContainer>
                            <SettingToggle
                                label = { t('settings.alwaysOnTopWindow') }
                                settingChangeEvent = { setWindowAlwaysOnTop }
                                settingName = 'alwaysOnTopWindowEnabled' />
                            <SettingToggle
                                label = { t('settings.disableAGC') }
                                settingChangeEvent = { setDisableAGC }
                                settingName = 'disableAGC' />
                        </TogglesContainer>
                    </SettingsContainer>
                </DrawerContainer>
            </Drawer>
        );
    }


    /**
     * Closes the drawer when back button is clicked.
     *
     * @returns {void}
     */
    _onBackButton() {
        this.props.dispatch(closeDrawer());
    }
}

// redux's compose() returns a loosely-typed function; cast so the connected +
// translated component is usable as JSX / a ComponentType by consumers.
export default compose(connect(), withTranslation())(SettingsDrawer) as React.ComponentType<any>;
