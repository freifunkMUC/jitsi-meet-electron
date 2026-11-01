import React, { useCallback, useEffect, useState } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { Dispatch, compose } from 'redux';
import styled from 'styled-components';

import type { IState } from '../../../types';
import { openDrawer } from '../../navbar';
import Card, { CardTitle } from '../../shared/components/Card';
import { roomsApi } from '../ipc';
import type { IRoomSummary } from '../types';

import MyRoomsDrawer from './MyRoomsDrawer';
import { MyRoomsSection, requestMyRoomsFocus } from './focus';
import { Hint, Muted, Notice, Row, SmallButton } from './styled';

const MAX_ROOMS = 3;

const RoomRow = styled.div`
    align-items: center;
    border-top: 1px solid var(--line);
    display: flex;
    gap: 12px;
    padding-top: 10px;
`;

const RoomText = styled.div`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
`;

const RoomName = styled.span`
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

interface IProps extends WithTranslation {
    _drawerOpen: boolean;
    dispatch: Dispatch;
}

/**
 * Sorts active rooms by expiry, the next to expire first.
 *
 * @param {IRoomSummary[]} rooms - Rooms.
 * @returns {IRoomSummary[]}
 */
function nextRooms(rooms: IRoomSummary[]): IRoomSummary[] {
    const expires = (r: IRoomSummary) => (r.expires ? Date.parse(r.expires) : Infinity);

    return rooms
        .filter(r => r.status === 'active')
        .sort((a, b) => expires(a) - expires(b))
        .slice(0, MAX_ROOMS);
}

/**
 * Welcome page card that explains reserved rooms and shows the next rooms.
 *
 * @param {IProps} props - Component props.
 * @returns {ReactElement}
 */
function ReservedRoomsCard({ _drawerOpen, dispatch, i18n, t }: IProps) {
    const [ rooms, setRooms ] = useState<IRoomSummary[]>([]);
    const [ busy, setBusy ] = useState(false);
    const [ error, setError ] = useState<string>();

    // Load again when the drawer closes, because the rooms can change there.
    useEffect(() => {
        if (!_drawerOpen) {
            roomsApi.list().then(r => r.ok && setRooms(r.value.rooms));
        }
    }, [ _drawerOpen ]);

    const open = useCallback((section?: MyRoomsSection) => {
        dispatch(openDrawer(MyRoomsDrawer));
        section && requestMyRoomsFocus(section);
    }, [ dispatch ]);

    const onJoin = async (room: string) => {
        setBusy(true);
        setError(undefined);
        try {
            const result = await roomsApi.join(room);

            if (result.ok) {
                window.jitsiElectronApp.ipc.send('open-meeting-window', result.value);
            } else if (result.reason !== 'aborted') {
                setError(result.reason);
            }
        } finally {
            setBusy(false);
        }
    };

    const formatDate = (iso: string) => new Date(Date.parse(iso)).toLocaleString(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
    const next = nextRooms(rooms);

    return (
        <Card>
            <CardTitle>{ t('reserve.cardTitle') }</CardTitle>
            <Hint>{ t('reserve.cardIntro') }</Hint>
            { error && <Notice kind = 'error'>{ t(`reserve.errors.${error}`) }</Notice> }
            { next.map(room => (
                <RoomRow key = { room.room }>
                    <RoomText>
                        <RoomName title = { room.room }>{ room.room }</RoomName>
                        { room.expires && (
                            <Muted>{ t('reserve.expires', { date: formatDate(room.expires) }) }</Muted>
                        ) }
                    </RoomText>
                    <SmallButton
                        disabled = { busy }
                        onClick = { () => onJoin(room.room) }
                        primary = { true }>
                        { t('reserve.joinAsHost') }
                    </SmallButton>
                </RoomRow>
            )) }
            { next.length > 0 ? (
                <Row>
                    <SmallButton onClick = { () => open() }>
                        { t('reserve.showAll', { count: rooms.length }) }
                    </SmallButton>
                    <SmallButton onClick = { () => open('create') }>
                        { t('reserve.emptyCreate') }
                    </SmallButton>
                </Row>
            ) : (
                <Row>
                    <SmallButton
                        onClick = { () => open('create') }
                        primary = { true }>
                        { t('reserve.emptyCreate') }
                    </SmallButton>
                    <SmallButton onClick = { () => open('import') }>
                        { t('reserve.emptyImport') }
                    </SmallButton>
                </Row>
            ) }
        </Card>
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
        _drawerOpen: state.navbar.openDrawer === MyRoomsDrawer
    };
}

export default compose(connect(_mapStateToProps), withTranslation())(ReservedRoomsCard) as React.ComponentType<any>;
