import React, { useCallback } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { Dispatch, compose } from 'redux';
import styled from 'styled-components';

import { openDrawer } from '../../navbar';
import { CalendarIcon } from '../../shared/icons';

import MyRoomsDrawer from './MyRoomsDrawer';

const Button = styled.button`
    align-items: center;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    font: inherit;
    gap: 2px;
    padding: 0;
`;

const Label = styled.span`
    font-size: 10px;
    font-weight: 600;
    line-height: 1.1;
    max-width: 56px;
    text-align: center;
`;

interface IProps extends WithTranslation {
    dispatch: Dispatch;
}

/**
 * Navigation bar button that opens "My rooms".
 *
 * @param {IProps} props - Component props.
 * @returns {ReactElement}
 */
function MyRoomsButton({ dispatch, t }: IProps) {
    const onClick = useCallback(() => dispatch(openDrawer(MyRoomsDrawer)), [ dispatch ]);

    return (
        <Button
            aria-label = { t('reserve.myRooms') }
            onClick = { onClick }
            title = { t('reserve.myRoomsHint') }
            type = 'button'>
            <CalendarIcon size = { 24 } />
            <Label>{ t('reserve.myRooms') }</Label>
        </Button>
    );
}

export default compose(connect(), withTranslation())(MyRoomsButton) as React.ComponentType<any>;
