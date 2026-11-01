
import { generateRoomWithoutSeparator } from '@jitsi/js-utils/random';
import React, { Component } from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { Dispatch, compose } from 'redux';
import styled from 'styled-components';

import type { IConference, IState } from '../../../types';
import config from '../../config';
import { Navbar } from '../../navbar';
import { RecentList, addRecentListEntry } from '../../recent-list';
import { IReserveLinkInfo, inspectReserveLink, joinReserveLink, parseReserveLink, roomsApi } from '../../reserve';
import { ReservedRoomsCard } from '../../reserve/components';
import { Badge, BadgeRole } from '../../reserve/components/styled';
import Button from '../../shared/components/Button';
import { CardTitle } from '../../shared/components/Card';
import FieldText from '../../shared/components/FieldText';
import Page from '../../shared/components/Page';
import { createConferenceObjectFromURL } from '../../utils';
import { describeWelcomeInput, lookupWelcomeInput, needsReserveLookup, sameServer, serverHost } from '../functions';
import { Body, Form, Header, Wrapper } from '../styled';


const MainFieldText = styled(FieldText)`
    input {
        height: 3em;
    }
`;

const MainGoButton = styled(Button)`
    height: 3em;
`;

const HelperText = styled.p`
    color: var(--muted);
    font-size: 13px;
    line-height: 1.45;
    margin: -4px 0 0;
`;

const Preview = styled.div<{ kind: 'error' | 'ok'; }>`
    align-items: center;
    background: ${p => (p.kind === 'error' ? 'var(--notice-error-bg)' : 'var(--hover)')};
    border: 1px solid ${p => (p.kind === 'error' ? 'var(--notice-error-line)' : 'var(--line)')};
    border-left: 4px solid ${p => (p.kind === 'error' ? 'var(--danger)' : 'var(--accent)')};
    border-radius: var(--radius-sm);
    color: ${p => (p.kind === 'error' ? 'var(--notice-error-text)' : 'var(--text)')};
    display: flex;
    flex-wrap: wrap;
    gap: 8px 10px;
    font-size: 13px;
    padding: 10px 12px;
`;

const PreviewRoom = styled.span`
    font-weight: 700;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const PreviewHint = styled.span`
    color: var(--muted);
    flex-basis: 100%;
`;

const SaveButton = styled(Button)`
    margin-left: auto;
`;

interface IProps extends WithTranslation {
    _serverURL?: string;
    dispatch: Dispatch;
    location?: {
        state?: {
            error?: any;
            room?: string;
            serverURL?: string;
        };
    };
}

interface IWelcomeState {
    animateTimeoutId?: ReturnType<typeof setTimeout>;
    generatedRoomname: string;

    /**
     * What a pasted host, speaker or manage link opens.
     */
    linkInfo?: IReserveLinkInfo;
    linkLoading: boolean;
    linkSaved: boolean;
    reserveError?: string;
    reserveJoining: boolean;
    roomPlaceholder: string;
    updateTimeoutId?: ReturnType<typeof setTimeout>;
    url: string;
}


/**
 * Welcome Component.
 */
class Welcome extends Component<IProps, IWelcomeState> {
    /**
     * Initializes a new {@code Welcome} instance.
     *
     * @inheritdoc
     */
    constructor(props: IProps) {
        super(props);

        // Initialize url value in state if passed using location state object.
        let url = '';

        // Check and parse url if exists in location state.
        if (props.location?.state) {
            const { room, serverURL } = props.location.state;

            if (room && serverURL) {
                url = `${serverURL}/${room}`;
            }
        }

        this.state = {
            animateTimeoutId: undefined,
            generatedRoomname: '',
            linkInfo: undefined,
            linkLoading: false,
            linkSaved: false,
            reserveError: undefined,
            reserveJoining: false,
            roomPlaceholder: '',
            updateTimeoutId: undefined,
            url
        };

        // Bind event handlers.
        this._animateRoomnameChanging = this._animateRoomnameChanging.bind(this);
        this._onURLChange = this._onURLChange.bind(this);
        this._onFormSubmit = this._onFormSubmit.bind(this);
        this._onJoin = this._onJoin.bind(this);
        this._onSaveLink = this._onSaveLink.bind(this);
        this._updateRoomname = this._updateRoomname.bind(this);
    }

    /**
     * Start generating random room names.
     *
     * @returns {void}
     */
    componentDidMount() {
        this._updateRoomname();
        this._inspect(this.state.url);
    }

    /**
     * Stop all timers when unmounting.
     *
     * @returns {voidd}
     */
    componentWillUnmount() {
        this._clearTimeouts();
        clearTimeout(this._inspectTimeout);
    }

    _inspectTimeout?: ReturnType<typeof setTimeout>;

    /**
     * Shows what a pasted reserve link opens, before the join. Waits a short
     * time, so typing does not send requests.
     *
     * @param {string} url - Field value.
     * @returns {void}
     */
    _inspect(url: string) {
        clearTimeout(this._inspectTimeout);
        const serverURL = this.props._serverURL || config.defaultServerURL;

        // Room names and meeting links need no request to the reserve service.
        if (!needsReserveLookup(url, serverURL)) {
            this.setState({ linkInfo: undefined, linkLoading: false, linkSaved: false });

            return;
        }
        this.setState({ linkInfo: undefined, linkLoading: true, linkSaved: false });
        this._inspectTimeout = setTimeout(async () => {
            const { info: result } = await lookupWelcomeInput(url, serverURL, inspectReserveLink);

            if (!result) {
                return;
            }

            // Ignore old answers.
            if (this.state.url !== url) {
                return;
            }
            this.setState({
                linkInfo: result.ok ? result.value : undefined,
                linkLoading: false,
                reserveError: result.ok ? undefined : result.reason
            });
        }, 300);
    }

    /**
     * Adds the room of a pasted host or manage link to "My rooms".
     *
     * @returns {Promise<void>}
     */
    async _onSaveLink() {
        const result = await roomsApi.import(this.state.url.trim());

        if (result.ok) {
            this.setState({ linkSaved: true });
        } else {
            this.setState({ reserveError: result.reason });
        }
    }

    /**
     * Render function of component.
     *
     * @returns {ReactElement}
     */
    render() {
        return (
            <Page navigation = { <Navbar /> }>
                <Wrapper>
                    { this._renderHeader() }
                    { this._renderBody() }
                </Wrapper>
            </Page>
        );
    }


    /**
     * Animates the changing of the room name.
     *
     * @param {string} word - The part of room name that should be added to
     * placeholder.
     * @private
     * @returns {void}
     */
    _animateRoomnameChanging(word: string) {
        let animateTimeoutId;
        const roomPlaceholder = this.state.roomPlaceholder + word.slice(0, 1);

        if (word.length > 1) {
            animateTimeoutId
                = setTimeout(
                    () => {
                        this._animateRoomnameChanging(
                            word.substring(1, word.length));
                    },
                    70);
        }
        this.setState({
            animateTimeoutId,
            roomPlaceholder
        });
    }

    /**
     * Method that clears timeouts for animations and updates of room name.
     *
     * @private
     * @returns {void}
     */
    _clearTimeouts() {
        clearTimeout(this.state.animateTimeoutId);
        clearTimeout(this.state.updateTimeoutId);
    }


    /**
     * Prevents submission of the form and delegates the join logic.
     *
     * @param {Event} event - Event by which this function is called.
     * @returns {void}
     */
    _onFormSubmit(event: React.FormEvent) {
        event.preventDefault();
        this._onJoin();
    }


    /**
     * Redirect and join conference.
     *
     * @returns {void}
     */
    _onJoin() {
        const inputURL = this.state.url || this.state.generatedRoomname;

        if (parseReserveLink(inputURL)) {
            this._joinReserveLink(inputURL);

            return;
        }

        const conference = createConferenceObjectFromURL(
            inputURL,
            this.props._serverURL || config.defaultServerURL
        );

        // Don't navigate if conference couldn't be created
        if (!conference) {
            return;
        }

        this.props.dispatch(addRecentListEntry(conference));
        window.jitsiElectronApp.ipc.send('open-meeting-window', conference);
    }


    /**
     * Joins a reserved room from a host, speaker or manage link. The link holds
     * a secret, so it is not added to the recent list.
     *
     * @param {string} inputURL - The reserve link.
     * @returns {Promise<void>}
     */
    async _joinReserveLink(inputURL: string) {
        if (this.state.reserveJoining) {
            return;
        }
        this.setState({ reserveError: undefined, reserveJoining: true });

        const result = await joinReserveLink(inputURL);

        this.setState({ reserveJoining: false });

        if (!result.ok) {
            this.setState({ reserveError: result.reason });

            return;
        }

        this.setState({ linkInfo: undefined, url: '' });
        window.jitsiElectronApp.ipc.send('open-meeting-window', result.value);
    }

    /**
     * Keeps URL input value and URL in state in sync.
     *
     * @param {SyntheticInputEvent<HTMLInputElement>} event - Event by which
     * this function is called.
     * @returns {void}
     */
    _onURLChange(event: React.ChangeEvent<HTMLInputElement>) {
        const url = event.currentTarget.value;

        this.setState({
            reserveError: undefined,
            url
        });
        this._inspect(url);
    }

    /**
     * Renders the body for the welcome page.
     *
     * @returns {ReactElement}
     */
    _renderBody() {
        return (
            <Body />
        );
    }

    /**
     * Renders the header for the welcome page.
     *
     * @returns {ReactElement}
     */
    _renderHeader() {
        const locationState = this.props.location?.state;
        const locationError = locationState?.error;
        const { t } = this.props;
        const { reserveError, reserveJoining } = this.state;
        const serverURL = this.props._serverURL || config.defaultServerURL;
        const input = describeWelcomeInput(this.state.url, serverURL);
        let goLabel = t('welcome.join');

        if (reserveJoining) {
            goLabel = t('reserve.joining');
        } else if (!this.state.url.trim()) {
            goLabel = t('welcome.startNew');
        } else if (this.state.linkInfo) {
            goLabel = t(`welcome.joinAs.${this.state.linkInfo.role}`);
        }

        return (
            <Header>
                <Form onSubmit = { this._onFormSubmit }>
                    <CardTitle>{ t('welcome.title') }</CardTitle>
                    <MainFieldText
                        autoFocus = { true }
                        isInvalid = { Boolean(locationError || reserveError) }
                        isLabelHidden = { true }
                        onChange = { this._onURLChange }
                        placeholder = { t('welcome.placeholder') }
                        shouldFitContainer = { true }
                        type = 'text'
                        value = { this.state.url } />
                    <HelperText>
                        { t('welcome.helper', { server: serverHost(serverURL) }) }
                    </HelperText>
                    { this._renderPreview(input.type === 'viewer' || input.type === 'name' ? input.conference : undefined) }
                    <MainGoButton
                        appearance = 'primary'
                        disabled = { reserveJoining || this.state.linkLoading }
                        onClick = { this._onJoin }
                        type = 'button'>
                        { goLabel }
                    </MainGoButton>
                </Form>
                <ReservedRoomsCard />
                <RecentList />
            </Header>
        );
    }

    /**
     * Renders what the field value opens: the room and the role, or an error.
     *
     * @param {IConference} conference - A normal room from a room name or meeting link.
     * @returns {ReactElement|null}
     */
    _renderPreview(conference?: IConference) {
        const { t } = this.props;
        const { linkInfo, linkLoading, linkSaved, reserveError } = this.state;

        if (reserveError) {
            return (
                <Preview
                    kind = 'error'
                    role = 'alert'>
                    { t([ `welcome.linkErrors.${reserveError}`, `reserve.errors.${reserveError}` ]) }
                </Preview>
            );
        }

        if (linkLoading) {
            return <Preview kind = 'ok'>{ t('welcome.checking') }</Preview>;
        }

        if (!linkInfo && conference) {
            const serverURL = this.props._serverURL || config.defaultServerURL;
            const other = !sameServer(conference.serverURL, serverURL);

            // A normal room has no roles, so it shows no badge.
            return (
                <Preview
                    kind = 'ok'
                    role = 'status'>
                    <PreviewRoom title = { conference.room }>{ t('welcome.room', { room: conference.room }) }</PreviewRoom>
                    { other && <PreviewHint>{ t('welcome.onServer', { server: serverHost(conference.serverURL) }) }</PreviewHint> }
                </Preview>
            );
        }

        const room = linkInfo?.room;

        if (!room) {
            return null;
        }

        const role: BadgeRole = linkInfo?.role ?? 'viewer';
        const canSave = linkInfo && linkInfo.kind !== 'speaker' && !linkInfo.saved;

        return (
            <Preview
                kind = 'ok'
                role = 'status'>
                <PreviewRoom title = { room }>{ t('welcome.room', { room }) }</PreviewRoom>
                <Badge $role = { role }>{ t(`reserve.roles.${role}`) }</Badge>
                { canSave && !linkSaved && (
                    <SaveButton
                        onClick = { this._onSaveLink }
                        type = 'button'>
                        { t('welcome.saveToMyRooms') }
                    </SaveButton>
                ) }
                { (linkSaved || linkInfo?.saved) && <PreviewHint>{ t('welcome.inMyRooms') }</PreviewHint> }
                <PreviewHint>{ t(`reserve.roleHints.${role}`) }</PreviewHint>
            </Preview>
        );
    }


    /**
     * Triggers the generation of a new room name and initiates an animation of
     * its changing.
     *
     * @protected
     * @returns {void}
     */
    _updateRoomname() {
        const generatedRoomname = generateRoomWithoutSeparator();
        const roomPlaceholder = '';
        const updateTimeoutId = setTimeout(this._updateRoomname, 10000);

        this._clearTimeouts();
        this.setState(
            {
                generatedRoomname,
                roomPlaceholder,
                updateTimeoutId
            },
            () => this._animateRoomnameChanging(generatedRoomname));
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
        _serverURL: state.settings.serverURL
    };
}

// redux's compose() returns a loosely-typed function; cast so the connected +
// translated component is usable as JSX / a ComponentType by consumers.
export default compose(connect(_mapStateToProps), withTranslation())(Welcome) as React.ComponentType<any>;
