import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { Dispatch, compose } from 'redux';
import styled from 'styled-components';

import { DrawerContainer, closeDrawer, openDrawer } from '../../navbar';
import FieldText from '../../shared/components/FieldText';
import { ArrowLeftIcon } from '../../shared/icons';
import { onOpenExtend, onPowProgress, roomsApi } from '../ipc';
import type { IDurations, IPowProgress, IRoomSummary, ReserveIpcResult, RoomLinkKind } from '../types';

import RoomItem from './RoomItem';
import { Muted, Notice, Progress, Row, Section, SectionTitle, Select, SmallButton } from './styled';
import { formatDuration } from './util';

interface IProps extends WithTranslation {
    dispatch: Dispatch;
    isOpen?: boolean;
}

const Drawer = styled.div<{ isOpen?: boolean; }>`
    background: #1a1a1a;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.4);
    color: #f4f5f7;
    display: flex;
    flex-direction: column;
    height: 100vh;
    left: 0;
    overflow-y: auto;
    position: fixed;
    top: 0;
    transform: ${p => (p.isOpen ? 'translateX(0)' : 'translateX(-100%)')};
    transition: transform 0.25s ease;
    width: 360px;
    z-index: 400;
`;

const DrawerHeader = styled.div`
    align-items: center;
    display: flex;
    gap: 12px;
    padding: 16px;
`;

const Title = styled.h2`
    flex: 1;
    font-size: 18px;
    margin: 0;
`;

const IconButton = styled.button`
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

const FALLBACK: IDurations = { default: 168, durations: [ 72, 168, 720, 2160, 8760 ], maxAheadH: 8760 };

/**
 * Drawer with the reserved rooms of the user.
 *
 * @param {IProps} props - Component props.
 * @returns {ReactElement}
 */
function MyRoomsDrawer({ dispatch, isOpen, t }: IProps) {
    const [ rooms, setRooms ] = useState<IRoomSummary[]>([]);
    const [ persistent, setPersistent ] = useState(true);
    const [ durations, setDurations ] = useState<IDurations>();
    const [ createHours, setCreateHours ] = useState<number>();
    const [ importLink, setImportLink ] = useState('');
    const [ busy, setBusy ] = useState(false);
    const [ progress, setProgress ] = useState<IPowProgress>();
    const [ error, setError ] = useState<string>();
    const [ info, setInfo ] = useState<string>();
    const [ extendOpen, setExtendOpen ] = useState<string>();
    const infoTimer = useRef<ReturnType<typeof setTimeout>>();

    const showInfo = useCallback((text: string) => {
        clearTimeout(infoTimer.current);
        setInfo(text);
        infoTimer.current = setTimeout(() => setInfo(undefined), 3000);
    }, []);

    const upsert = useCallback((room: IRoomSummary) => {
        setRooms(list => [ room, ...list.filter(r => r.room !== room.room) ]);
    }, []);

    const run = useCallback(async function <T>(call: () => Promise<ReserveIpcResult<T>>, onOk: (value: T) => void) {
        setBusy(true);
        setError(undefined);
        try {
            const result = await call();

            if (result.ok) {
                onOk(result.value);
            } else if (result.reason !== 'aborted') {
                setError(result.reason);
            }
        } finally {
            setBusy(false);
            setProgress(undefined);
        }
    }, []);

    useEffect(() => onPowProgress(setProgress), []);

    // A click on an expiry reminder opens the extend options of the room.
    useEffect(() => {
        const takeReminder = () => roomsApi.takeReminder().then(r => {
            if (r.ok && r.value) {
                setExtendOpen(r.value);
                // The navbar compares the open drawer with the connected component.
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                dispatch(openDrawer(ConnectedMyRoomsDrawer));
            }
        });

        takeReminder();

        return onOpenExtend(takeReminder);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        roomsApi.list().then(r => {
            if (r.ok) {
                setRooms(r.value.rooms);
                setPersistent(r.value.persistent);
            }

            return run(() => roomsApi.refresh(false), list => setRooms(list.rooms));
        });
        if (!durations) {
            roomsApi.durations().then(r => r.ok && setDurations(r.value));
        }
    }, [ isOpen ]);

    const d = durations ?? FALLBACK;
    const hours = createHours ?? d.default;

    const onCreate = () => run(() => roomsApi.create(hours), room => {
        upsert(room);
        showInfo(t('reserve.created', { room: room.room }));
    });
    const onImport = () => run(() => roomsApi.import(importLink), room => {
        upsert(room);
        setImportLink('');
        showInfo(t('reserve.imported', { room: room.room }));
    });
    const onCopy = (room: string, kind: RoomLinkKind) => run(() => roomsApi.copy(room, kind),
        () => showInfo(t('reserve.copied')));
    const onExtend = (room: string, h: number) => run(() => roomsApi.extend(room, h), r => {
        upsert(r);
        setExtendOpen(undefined);
        showInfo(t('reserve.extended'));
    });
    const onRotate = (room: string) => run(() => roomsApi.rotate(room), r => {
        if (r) {
            upsert(r);
            showInfo(t('reserve.rotated'));
        }
    });
    const onDelete = (room: string) => run(() => roomsApi.delete(room), r => r && upsert(r));
    const onRemove = (room: string) => run(() => roomsApi.remove(room),
        () => setRooms(list => list.filter(r => r.room !== room)));
    const onJoin = (room: string) => run(() => roomsApi.join(room), conference => {
        window.jitsiElectronApp.ipc.send('open-meeting-window', conference);
        dispatch(closeDrawer());
    });
    const onRefresh = () => run(() => roomsApi.refresh(true), list => setRooms(list.rooms));

    return (
        <Drawer
            aria-hidden = { !isOpen }
            isOpen = { isOpen }>
            <DrawerHeader>
                <IconButton
                    aria-label = { t('settings.back') }
                    onClick = { () => dispatch(closeDrawer()) }>
                    <ArrowLeftIcon
                        color = 'white'
                        size = { 24 } />
                </IconButton>
                <Title>{ t('reserve.myRooms') }</Title>
                <SmallButton
                    disabled = { busy }
                    onClick = { onRefresh }>
                    { t('reserve.refresh') }
                </SmallButton>
            </DrawerHeader>
            <DrawerContainer>
                { !persistent && <Notice kind = 'warning'>{ t('reserve.notPersistent') }</Notice> }
                { error && (
                    <Notice
                        kind = 'error'
                        role = 'alert'>
                        { t(`reserve.errors.${error}`) }
                    </Notice>
                ) }
                { info && (
                    <Notice
                        kind = 'info'
                        role = 'status'>
                        { info }
                    </Notice>
                ) }
                <Section>
                    <SectionTitle>{ t('reserve.create') }</SectionTitle>
                    <Row>
                        <Select
                            aria-label = { t('reserve.duration.label') }
                            disabled = { busy }
                            onChange = { e => setCreateHours(Number(e.currentTarget.value)) }
                            value = { hours }>
                            { d.durations.map(h => (
                                <option
                                    key = { h }
                                    value = { h }>
                                    { formatDuration(t, h) }
                                </option>
                            )) }
                        </Select>
                        <SmallButton
                            disabled = { busy }
                            onClick = { onCreate }
                            primary = { true }>
                            { t('reserve.createButton') }
                        </SmallButton>
                    </Row>
                    { progress && (
                        <>
                            <Muted>{ t('reserve.working') }</Muted>
                            <Row>
                                <Progress
                                    max = { 1 }
                                    value = { Math.min(0.95, progress.tried / Math.max(1, progress.expected)) } />
                                <SmallButton onClick = { () => roomsApi.cancel() }>
                                    { t('reserve.confirm.cancel') }
                                </SmallButton>
                            </Row>
                        </>
                    ) }
                </Section>
                <Section>
                    <SectionTitle>{ t('reserve.import') }</SectionTitle>
                    <FieldText
                        isLabelHidden = { true }
                        onChange = { e => setImportLink(e.currentTarget.value) }
                        placeholder = { t('reserve.importPlaceholder') }
                        shouldFitContainer = { true }
                        value = { importLink } />
                    <Row>
                        <SmallButton
                            disabled = { busy || !importLink.trim() }
                            onClick = { onImport }>
                            { t('reserve.importButton') }
                        </SmallButton>
                    </Row>
                </Section>
                { rooms.length === 0 && (
                    <Section>
                        <Muted>{ t('reserve.empty') }</Muted>
                    </Section>
                ) }
                { rooms.map(room => (
                    <RoomItem
                        busy = { busy }
                        defaultDurations = { d.durations }
                        defaultMaxAheadH = { d.maxAheadH }
                        extendOpen = { extendOpen === room.room }
                        key = { room.room }
                        onCopy = { onCopy }
                        onDelete = { onDelete }
                        onExtend = { onExtend }
                        onJoin = { onJoin }
                        onRemove = { onRemove }
                        onRotate = { onRotate }
                        onToggleExtend = { r => setExtendOpen(o => (o === r ? undefined : r)) }
                        room = { room } />
                )) }
            </DrawerContainer>
        </Drawer>
    );
}

const ConnectedMyRoomsDrawer = compose(connect(), withTranslation())(MyRoomsDrawer) as React.ComponentType<any>;

export default ConnectedMyRoomsDrawer;
