import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { extendOptions } from '../functions';
import type { IRoomSummary, RoomLinkKind } from '../types';

import { Muted, Row, Section, Select, SmallButton } from './styled';
import { formatDuration } from './util';

const Name = styled.div`
    flex: 1;
    font-size: 16px;
    font-weight: 700;
    word-break: break-all;
`;

const Divider = styled.hr`
    border: none;
    border-top: 1px solid var(--line);
    margin: 2px 0;
    width: 100%;
`;

const STATUS_COLORS: Record<string, string> = {
    active: 'var(--ok)',
    deleted: 'var(--danger)',
    expired: 'var(--warn)',
    replaced: 'var(--danger)',
    unknown: 'var(--danger)'
};

const Status = styled.span<{ status: string; }>`
    align-items: center;
    color: ${p => STATUS_COLORS[p.status] ?? 'var(--muted)'};
    display: inline-flex;
    font-size: 12px;
    font-weight: 700;
    gap: 6px;

    &::before {
        background: currentColor;
        border-radius: 50%;
        content: '';
        height: 8px;
        width: 8px;
    }
`;

// Links people share most come first.
const SHARE_KINDS: RoomLinkKind[] = [ 'speaker', 'viewer' ];
const COPY_KINDS: RoomLinkKind[] = [ 'host', 'manage', 'all' ];

interface IProps {
    busy: boolean;

    /**
     * Fallback durations when the room has none yet.
     */
    defaultDurations: number[];
    defaultMaxAheadH: number;
    extendOpen: boolean;
    onCopy: (room: string, kind: RoomLinkKind) => void;
    onDelete: (room: string) => void;
    onExtend: (room: string, hours: number) => void;
    onJoin: (room: string) => void;
    onRemove: (room: string) => void;
    onRotate: (room: string) => void;
    onToggleExtend: (room: string) => void;
    room: IRoomSummary;
}

/**
 * One room in "My rooms".
 *
 * @param {IProps} props - Component props.
 * @returns {ReactElement}
 */
export default function RoomItem(props: IProps) {
    const { busy, room } = props;
    const { i18n, t } = useTranslation();
    const [ hours, setHours ] = useState<number | undefined>();
    const active = room.status === 'active';
    const options = room.expires
        ? extendOptions(room.expires, room.durations ?? props.defaultDurations,
            room.maxAheadH ?? props.defaultMaxAheadH, Date.now())
        : [];
    const enabled = options.filter(o => o.enabled);
    const selected = enabled.find(o => o.hours === hours) ?? enabled[0];
    const formatDate = (ms: number) => new Date(ms).toLocaleString(i18n.language, {
        dateStyle: 'medium', timeStyle: 'short'
    });

    return (
        <Section>
            <Row>
                <Name>{ room.room }</Name>
                <Status status = { room.status }>{ t(`reserve.status.${room.status}`) }</Status>
            </Row>
            { room.expires && (
                <Muted>
                    { t(room.status === 'expired' ? 'reserve.expired' : 'reserve.expires', {
                        date: formatDate(Date.parse(room.expires))
                    }) }
                </Muted>
            ) }
            <Row>
                <SmallButton
                    disabled = { busy || !active }
                    onClick = { () => props.onJoin(room.room) }
                    primary = { true }>
                    { t('reserve.joinAsHost') }
                </SmallButton>
                <SmallButton
                    aria-expanded = { props.extendOpen }
                    disabled = { busy || !active || enabled.length === 0 }
                    onClick = { () => props.onToggleExtend(room.room) }
                    title = { t('reserve.actionHints.extend') }>
                    { t('reserve.extend') }
                </SmallButton>
            </Row>
            { props.extendOpen && active && selected && (
                <Row>
                    <Select
                        aria-label = { t('reserve.duration.label') }
                        onChange = { e => setHours(Number(e.currentTarget.value)) }
                        value = { selected.hours }>
                        { enabled.map(o => (
                            <option
                                key = { o.hours }
                                value = { o.hours }>
                                { t('reserve.extendUntil', {
                                    date: formatDate(o.newExpires),
                                    duration: formatDuration(t, o.hours)
                                }) }
                            </option>
                        )) }
                    </Select>
                    <SmallButton
                        disabled = { busy }
                        onClick = { () => props.onExtend(room.room, selected.hours) }
                        primary = { true }>
                        { t('reserve.extend') }
                    </SmallButton>
                </Row>
            ) }
            { active && (
                <Row>
                    { SHARE_KINDS.map(kind => (
                        <SmallButton
                            disabled = { busy }
                            key = { kind }
                            onClick = { () => props.onCopy(room.room, kind) }
                            title = { t(`reserve.copyHint.${kind}`) }>
                            { t(`reserve.share.${kind}`) }
                        </SmallButton>
                    )) }
                </Row>
            ) }
            { active && (
                <Row>
                    <Muted>{ t('reserve.copy') }</Muted>
                    { COPY_KINDS.map(kind => (
                        <SmallButton
                            disabled = { busy }
                            key = { kind }
                            onClick = { () => props.onCopy(room.room, kind) }
                            title = { t(`reserve.copyHint.${kind}`) }>
                            { t(`reserve.links.${kind}`) }
                        </SmallButton>
                    )) }
                </Row>
            ) }
            <Divider />
            <Row>
                { active && (
                    <SmallButton
                        disabled = { busy }
                        onClick = { () => props.onRotate(room.room) }
                        title = { t('reserve.actionHints.rotate') }>
                        { t('reserve.rotate') }
                    </SmallButton>
                ) }
                { active && (
                    <SmallButton
                        danger = { true }
                        disabled = { busy }
                        onClick = { () => props.onDelete(room.room) }
                        title = { t('reserve.actionHints.delete') }>
                        { t('reserve.delete') }
                    </SmallButton>
                ) }
                <SmallButton
                    disabled = { busy }
                    onClick = { () => props.onRemove(room.room) }
                    title = { t('reserve.removeHint') }>
                    { t('reserve.remove') }
                </SmallButton>
            </Row>
        </Section>
    );
}
