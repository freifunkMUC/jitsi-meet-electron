import React, { Component } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { Dispatch, compose } from 'redux';
import styled from 'styled-components';

import type { IConference, IState } from '../../../types';
import config from '../../config';
import { MyRoomsDrawer } from '../../reserve/components';
import { Badge, Muted, Notice, SmallButton } from '../../reserve/components/styled';
import { roomsApi } from '../../reserve/ipc';
import Card, { CardTitle } from '../../shared/components/Card';
import { CrossIcon } from '../../shared/icons';
import { sameServer, serverHost } from '../../welcome/functions';
import { addRecentListEntry, removeRecentListEntry } from '../actions';

const Row = styled.div`
    align-items: center;
    border-top: 1px solid var(--line);
    display: flex;
    gap: 12px;
    padding-top: 10px;
`;

const Text = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
`;

const Name = styled.span`
    align-items: center;
    display: flex;
    font-weight: 700;
    gap: 8px;
    min-width: 0;

    span:first-child {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

const RemoveButton = styled.button`
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--muted);
    cursor: pointer;
    display: flex;
    padding: 6px;

    &:hover {
        background: var(--hover);
        color: var(--text);
    }
`;

interface IProps extends WithTranslation {
    _drawerOpen?: boolean;
    _recentList?: IConference[];
    dispatch: Dispatch;
}

interface IRecentState {
    busy: boolean;
    error?: string;
    myRooms: string[];
}

/**
 * Recent meetings card on the welcome page.
 */
class RecentList extends Component<IProps, IRecentState> {
    state: IRecentState = { busy: false, myRooms: [] };

    /**
     * Loads the names of the rooms in "My rooms" to find reserved rooms.
     *
     * @returns {void}
     */
    componentDidMount() {
        this._loadMyRooms();
    }

    /**
     * Loads "My rooms" again when its drawer closes.
     *
     * @param {IProps} prevProps - Previous props.
     * @returns {void}
     */
    componentDidUpdate(prevProps: IProps) {
        if (prevProps._drawerOpen && !this.props._drawerOpen) {
            this._loadMyRooms();
        }
    }

    /**
     * Render function of component.
     *
     * @returns {ReactElement}
     */
    render() {
        const { _recentList, t } = this.props;

        if (!_recentList?.length) {
            return null;
        }

        return (
            <Card>
                <CardTitle>{ t('recent.title') }</CardTitle>
                { this.state.error && <Notice kind = 'error'>{ t(`reserve.errors.${this.state.error}`) }</Notice> }
                { _recentList.map(conference => this._renderRecentListEntry(conference)) }
            </Card>
        );
    }

    /**
     * Loads the room names of "My rooms". The list is local; it needs no
     * request to the reserve service.
     *
     * @returns {void}
     */
    _loadMyRooms() {
        roomsApi.list().then(r => r.ok && this.setState({ myRooms: r.value.rooms.map(room => room.room) }));
    }

    /**
     * Tells if a recent meeting is a room in "My rooms".
     *
     * @param {IConference} conference - Conference.
     * @returns {boolean}
     */
    _isMyRoom(conference: IConference) {
        return this.state.myRooms.includes(conference.room)
            && sameServer(conference.serverURL, config.defaultServerURL);
    }

    /**
     * Joins a recent meeting. A room in "My rooms" opens as host.
     *
     * @param {IConference} conference - Conference.
     * @returns {Promise<void>}
     */
    async _onJoin(conference: IConference) {
        if (!this._isMyRoom(conference)) {
            this.props.dispatch(addRecentListEntry(conference));
            window.jitsiElectronApp.ipc.send('open-meeting-window', conference);

            return;
        }
        this.setState({ busy: true, error: undefined });
        const result = await roomsApi.join(conference.room);

        this.setState({ busy: false });
        if (result.ok) {
            window.jitsiElectronApp.ipc.send('open-meeting-window', result.value);
        } else if (result.reason !== 'aborted') {
            this.setState({ error: result.reason });
        }
    }

    /**
     * Renders one recent meeting.
     *
     * @param {IConference} conference - Conference.
     * @returns {ReactElement}
     */
    _renderRecentListEntry(conference: IConference) {
        const { t } = this.props;
        const host = this._isMyRoom(conference);
        const other = !sameServer(conference.serverURL, config.defaultServerURL);
        const time = this._renderStartTime(conference);

        return (
            <Row key = { `${conference.serverURL}/${conference.room}/${conference.startTime}` }>
                <Text>
                    <Name>
                        <span title = { conference.room }>{ conference.room }</span>
                        { host && <Badge $role = 'host'>{ t('reserve.roles.host') }</Badge> }
                    </Name>
                    <Muted>
                        { [ other && serverHost(conference.serverURL), time && t('recent.lastJoined', { time }) ]
                            .filter(Boolean)
                            .join(' · ') }
                    </Muted>
                </Text>
                <SmallButton
                    disabled = { this.state.busy }
                    onClick = { () => this._onJoin(conference) }
                    primary = { host }>
                    { host ? t('reserve.joinAsHost') : t('welcome.join') }
                </SmallButton>
                <RemoveButton
                    aria-label = { t('recent.remove', { room: conference.room }) }
                    onClick = { () => this.props.dispatch(removeRecentListEntry(conference)) }
                    title = { t('recent.remove', { room: conference.room }) }
                    type = 'button'>
                    <CrossIcon size = { 20 } />
                </RemoveButton>
            </Row>
        );
    }

    /**
     * Returns the date and time of the conference as text.
     *
     * @param {Object} conference - Conference Details.
     * @returns {string}
     */
    _renderStartTime(conference: IConference) {
        const { startTime } = conference;

        if (typeof startTime !== 'number') {
            return '';
        }

        return new Intl.DateTimeFormat(this.props.i18n.language || navigator.language, {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(startTime);
    }
}

/**
 * Maps (parts of) the redux state to the React props.
 *
 * @param {Object} state - The redux state.
 * @returns {Object}
 */
function _mapStateToProps(state: IState) {
    return {
        _drawerOpen: state.navbar.openDrawer === MyRoomsDrawer,
        _recentList: state.recentList.recentList
    };
}

// redux's compose() returns a loosely-typed function; cast so the connected +
// translated component is usable as JSX / a ComponentType by consumers.
export default compose(connect(_mapStateToProps), withTranslation())(RecentList) as React.ComponentType<any>;
