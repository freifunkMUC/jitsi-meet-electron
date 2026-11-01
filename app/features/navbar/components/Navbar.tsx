
import React, { Component } from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';

import type { IState } from '../../../types';
import { MyRoomsButton, MyRoomsDrawer } from '../../reserve/components';
import { SettingsButton, SettingsDrawer } from '../../settings';

import HelpButton from './HelpButton';
import Logo from './Logo';


const NavBar = styled.nav`
    background: var(--bg-elev);
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    height: 100vh;
    justify-content: space-between;
    padding: 12px 0;
    width: 64px;
`;

const NavSection = styled.div`
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const NavItem = styled.div`
    align-items: center;
    border-radius: var(--radius-sm);
    color: var(--icon);
    cursor: pointer;
    display: flex;
    justify-content: center;
    padding: 8px;

    &:hover {
        background: var(--hover);
        color: var(--accent-text);
    }
`;

interface IProps {
    _isMyRoomsDrawerOpen?: boolean;
    _isSettingsDrawerOpen?: boolean;
}


/**
 * Navigation Bar component.
 */
class Navbar extends Component<IProps> {
    /**
     * Render function of component.
     *
     * @returns {ReactElement}
     */
    render() {
        return (
            <>
                <NavBar>
                    <NavSection>
                        <NavItem>
                            <Logo />
                        </NavItem>
                        <NavItem>
                            <MyRoomsButton />
                        </NavItem>
                        <NavItem>
                            <SettingsButton />
                        </NavItem>
                    </NavSection>
                    <NavSection>
                        <NavItem>
                            <HelpButton />
                        </NavItem>
                    </NavSection>
                </NavBar>
                <SettingsDrawer isOpen = { this.props._isSettingsDrawerOpen } />
                <MyRoomsDrawer isOpen = { this.props._isMyRoomsDrawerOpen } />
            </>
        );
    }
}

/**
 * Maps (parts of) the redux state to the React props.
 *
 * @param {Object} state - The redux state.
 * @returns {{
 *     _isMyRoomsDrawerOpen,
 *     _isSettingsDrawerOpen
 * }}
 */
function _mapStateToProps(state: IState) {
    return {
        _isMyRoomsDrawerOpen: state.navbar.openDrawer === MyRoomsDrawer,
        _isSettingsDrawerOpen: state.navbar.openDrawer === SettingsDrawer
    };
}


export default connect(_mapStateToProps)(Navbar);
