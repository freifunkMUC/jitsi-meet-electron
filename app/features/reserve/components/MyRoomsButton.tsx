import React, { useCallback } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { Dispatch, compose } from 'redux';

import { openDrawer } from '../../navbar';
import { CalendarIcon } from '../../shared/icons';

import MyRoomsDrawer from './MyRoomsDrawer';

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
        <span title = { t('reserve.myRooms') }>
            <CalendarIcon
                color = 'white'
                onClick = { onClick }
                size = { 24 } />
        </span>
    );
}

export default compose(connect(), withTranslation())(MyRoomsButton) as React.ComponentType<any>;
