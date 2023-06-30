import React, { useCallback, useEffect, useRef } from 'react';
import { WithTranslation } from 'react-i18next';
import { batch, connect } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

import { isSpeakerStatsDisabled } from '../../../../features/speaker-stats/functions';
import { ACTION_SHORTCUT_TRIGGERED, createShortcutEvent } from '../../../analytics/AnalyticsEvents';
import { sendAnalytics } from '../../../analytics/functions';
import { IReduxState, IStore } from '../../../app/types';
import { VISITORS_MODE_BUTTONS } from '../../../base/config/constants';
import {
    getButtonsWithNotifyClick,
    getToolbarButtons,
    isToolbarButtonEnabled
} from '../../../base/config/functions.web';
import { toggleDialog } from '../../../base/dialog/actions';
import { isMobileBrowser } from '../../../base/environment/utils';
import { translate } from '../../../base/i18n/functions';
import JitsiMeetJS from '../../../base/lib-jitsi-meet';
import {
    raiseHand
} from '../../../base/participants/actions';
import {
    getLocalParticipant,
    hasRaisedHand,
    isLocalParticipantModerator
} from '../../../base/participants/functions';
import ContextMenu from '../../../base/ui/components/web/ContextMenu';
import { toggleChat } from '../../../chat/actions.web';
import { setGifMenuVisibility } from '../../../gifs/actions';
import { isGifEnabled } from '../../../gifs/functions.web';
import { registerShortcut, unregisterShortcut } from '../../../keyboard-shortcuts/actions';
import {
    close as closeParticipantsPane,
    open as openParticipantsPane
} from '../../../participants-pane/actions.web';
import { getParticipantsPaneOpen } from '../../../participants-pane/functions';
import {
    addReactionToBuffer,
    toggleReactionsMenuVisibility
} from '../../../reactions/actions.web';
import { REACTIONS } from '../../../reactions/constants';
import { isReactionsButtonEnabled, isReactionsEnabled } from '../../../reactions/functions.web';
import {
    startScreenShareFlow
} from '../../../screen-share/actions.web';
import {
    isScreenVideoShared
} from '../../../screen-share/functions';
import SpeakerStats from '../../../speaker-stats/components/web/SpeakerStats';
import { toggleTileView } from '../../../video-layout/actions.web';
import { shouldDisplayTileView } from '../../../video-layout/functions.web';
import VideoQualityDialog from '../../../video-quality/components/VideoQualityDialog.web';
import { iAmVisitor } from '../../../visitors/functions';
import {
    setFullScreen,
    setHangupMenuVisible,
    setOverflowMenuVisible,
    setToolbarHovered,
    showToolbox
} from '../../actions.web';
import { NOTIFY_CLICK_MODE, NOT_APPLICABLE, THRESHOLDS } from '../../constants';
import {
    getAllToolboxButtons,
    getJwtDisabledButtons,
    isDesktopShareButtonDisabled,
    isToolboxVisible
} from '../../functions.web';
import { IToolboxButton } from '../../types';
import HangupButton from '../HangupButton';

import { EndConferenceButton } from './EndConferenceButton';
import HangupMenuButton from './HangupMenuButton';
import { LeaveConferenceButton } from './LeaveConferenceButton';
import OverflowMenuButton from './OverflowMenuButton';
import Separator from './Separator';

/**
 * The type of the React {@code Component} props of {@link Toolbox}.
 */
interface IProps extends WithTranslation {

    /**
     * Toolbar buttons which have their click exposed through the API.
     */
    _buttonsWithNotifyClick?: Array<string | {
        key: string;
        preventExecution: boolean;
    }>;

    /**
     * Whether or not the chat feature is currently displayed.
     */
    _chatOpen: boolean;

    /**
     * The width of the client.
     */
    _clientWidth: number;

    /**
     * Custom Toolbar buttons.
     */
    _customToolbarButtons?: Array<{ icon: string; id: string; text: string; }>;

    /**
     * Whether or not screensharing button is disabled.
     */
    _desktopSharingButtonDisabled: boolean;

    /**
     * Whether or not screensharing is initialized.
     */
    _desktopSharingEnabled: boolean;

    /**
     * Whether or not a dialog is displayed.
     */
    _dialog: boolean;

    /**
     * Whether or not the toolbox is disabled. It is for recorders.
     */
    _disabled: boolean;

    /**
     * Whether the end conference feature is supported.
     */
    _endConferenceSupported: boolean;

    /**
     * Whether or not the app is currently in full screen.
     */
    _fullScreen?: boolean;

    /**
     * Whether or not the GIFs feature is enabled.
     */
    _gifsEnabled: boolean;

    /**
     * Whether the hangup menu is visible.
     */
    _hangupMenuVisible: boolean;

    /**
     * Whether or not the app is running in mobile browser.
     */
    _isMobile: boolean;

    /**
     * Whether we are in narrow layout mode.
     */
    _isNarrowLayout: boolean;

    /**
     * Whether or not speaker stats is disable.
     */
    _isSpeakerStatsDisabled?: boolean;

    /**
     * The array of toolbar buttons disabled through jwt features.
     */
    _jwtDisabledButons: string[];

    /**
     * Whether or not the overflow menu is displayed in a drawer drawer.
     */
    _overflowDrawer: boolean;

    /**
     * Whether or not the overflow menu is visible.
     */
    _overflowMenuVisible: boolean;

    /**
     * Whether or not the participants pane is open.
     */
    _participantsPaneOpen: boolean;

    /**
     * Whether or not the local participant's hand is raised.
     */
    _raisedHand: boolean;

    /**
     * Whether or not to display reactions in separate button.
     */
    _reactionsButtonEnabled: boolean;

    /**
     * Whether or not reactions feature is enabled.
     */
    _reactionsEnabled: boolean;

    /**
     * Whether or not the local participant is screenSharing.
     */
    _screenSharing: boolean;

    /**
     * Whether the toolbox should be shifted up or not.
     */
    _shiftUp: boolean;

    /**
     * Whether or not the tile view is enabled.
     */
    _tileViewEnabled: boolean;

    /**
     * The enabled buttons.
     */
    _toolbarButtons: Array<string>;

    /**
     * Flag showing whether toolbar is visible.
     */
    _visible: boolean;

    /**
     * Invoked to active other features of the app.
     */
    dispatch: IStore['dispatch'];

    /**
     * Explicitly passed array with the buttons which this Toolbox should display.
     */
    toolbarButtons: Array<string>;
}

const useStyles = makeStyles()(() => {
    return {
        contextMenu: {
            position: 'relative',
            right: 'auto',
            margin: 0,
            marginBottom: '8px',
            maxHeight: 'calc(100vh - 100px)',
            minWidth: '240px'
        },

        hangupMenu: {
            position: 'relative',
            right: 'auto',
            display: 'flex',
            flexDirection: 'column',
            rowGap: '8px',
            margin: 0,
            padding: '16px',
            marginBottom: '4px'
        }
    };
});

const Toolbox = (props: IProps) => {
    const { classes, cx } = useStyles();
    const _toolboxRef = useRef<HTMLDivElement>(null);

    /**
     * Creates an analytics keyboard shortcut event and dispatches an action for
     * toggling the display of chat.
     *
     * @private
     * @returns {void}
     */
    function _onShortcutToggleChat() {
        sendAnalytics(createShortcutEvent(
            'toggle.chat',
            ACTION_SHORTCUT_TRIGGERED,
            {
                enable: !props._chatOpen
            }));

        // Checks if there was any text selected by the user.
        // Used for when we press simultaneously keys for copying
        // text messages from the chat board
        if (window.getSelection()?.toString() !== '') {
            return false;
        }

        props.dispatch(toggleChat());
    }

    /**
     * Creates an analytics keyboard shortcut event and dispatches an action for
     * toggling the display of the participants pane.
     *
     * @private
     * @returns {void}
     */
    function _onShortcutToggleParticipantsPane() {
        const { dispatch, _participantsPaneOpen } = props;

        sendAnalytics(createShortcutEvent(
            'toggle.participants-pane',
            ACTION_SHORTCUT_TRIGGERED,
            {
                enable: !props._participantsPaneOpen
            }));

        if (_participantsPaneOpen) {
            dispatch(closeParticipantsPane());
        } else {
            dispatch(openParticipantsPane());
        }
    }

    /**
    * Creates an analytics keyboard shortcut event and dispatches an action for
    * toggling the display of Video Quality.
    *
    * @private
    * @returns {void}
    */
    function _onShortcutToggleVideoQuality() {
        sendAnalytics(createShortcutEvent('video.quality'));

        props.dispatch(toggleDialog(VideoQualityDialog));
    }

    /**
     * Dispatches an action for toggling the tile view.
     *
     * @private
     * @returns {void}
     */
    function _onShortcutToggleTileView() {
        sendAnalytics(createShortcutEvent(
            'toggle.tileview',
            ACTION_SHORTCUT_TRIGGERED,
            {
                enable: !props._tileViewEnabled
            }));

        props.dispatch(toggleTileView());
    }

    /**
     * Creates an analytics keyboard shortcut event and dispatches an action for
     * toggling full screen mode.
     *
     * @private
     * @returns {void}
     */
    function _onShortcutToggleFullScreen() {
        const { dispatch, _fullScreen } = props;

        sendAnalytics(createShortcutEvent(
            'toggle.fullscreen',
            ACTION_SHORTCUT_TRIGGERED,
            {
                enable: !_fullScreen
            }));
        dispatch(setFullScreen(!_fullScreen));
    }

    /**
     * Creates an analytics keyboard shortcut event and dispatches an action for
     * toggling raise hand.
     *
     * @private
     * @returns {void}
     */
    function _onShortcutToggleRaiseHand() {
        const { dispatch, _raisedHand } = props;

        sendAnalytics(createShortcutEvent(
            'toggle.raise.hand',
            ACTION_SHORTCUT_TRIGGERED,
            { enable: !_raisedHand }));

        dispatch(raiseHand(!_raisedHand));
    }

    /**
     * Creates an analytics keyboard shortcut event and dispatches an action for
     * toggling screensharing.
     *
     * @private
     * @returns {void}
     */
    function _onShortcutToggleScreenshare() {
        const {
            _desktopSharingButtonDisabled,
            _desktopSharingEnabled,
            _screenSharing,
            dispatch
        } = props;

        // Ignore the shortcut if the button is disabled.
        if (_desktopSharingButtonDisabled) {
            return;
        }
        sendAnalytics(createShortcutEvent(
            'toggle.screen.sharing',
            ACTION_SHORTCUT_TRIGGERED,
            {
                enable: !_screenSharing
            }));

        if (_desktopSharingEnabled && !_desktopSharingButtonDisabled) {
            dispatch(startScreenShareFlow(!_screenSharing));
        }
    }

    /**
     * Creates an analytics keyboard shortcut event and dispatches an action for
     * toggling speaker stats.
     *
     * @private
     * @returns {void}
     */
    function _onShortcutSpeakerStats() {
        const { dispatch } = props;

        sendAnalytics(createShortcutEvent(
            'speaker.stats'
        ));

        dispatch(toggleDialog(SpeakerStats, {
            conference: APP.conference
        }));
    }

    useEffect(() => {
        const { _toolbarButtons, dispatch, _reactionsEnabled, _gifsEnabled, _isSpeakerStatsDisabled } = props;

        const KEYBOARD_SHORTCUTS = [
            isToolbarButtonEnabled('videoquality', _toolbarButtons) && {
                character: 'A',
                exec: _onShortcutToggleVideoQuality,
                helpDescription: 'toolbar.callQuality'
            },
            isToolbarButtonEnabled('chat', _toolbarButtons) && {
                character: 'C',
                exec: _onShortcutToggleChat,
                helpDescription: 'keyboardShortcuts.toggleChat'
            },
            isToolbarButtonEnabled('desktop', _toolbarButtons) && {
                character: 'D',
                exec: _onShortcutToggleScreenshare,
                helpDescription: 'keyboardShortcuts.toggleScreensharing'
            },
            isToolbarButtonEnabled('participants-pane', _toolbarButtons) && {
                character: 'P',
                exec: _onShortcutToggleParticipantsPane,
                helpDescription: 'keyboardShortcuts.toggleParticipantsPane'
            },
            isToolbarButtonEnabled('raisehand', _toolbarButtons) && {
                character: 'R',
                exec: _onShortcutToggleRaiseHand,
                helpDescription: 'keyboardShortcuts.raiseHand'
            },
            isToolbarButtonEnabled('fullscreen', _toolbarButtons) && {
                character: 'S',
                exec: _onShortcutToggleFullScreen,
                helpDescription: 'keyboardShortcuts.fullScreen'
            },
            isToolbarButtonEnabled('tileview', _toolbarButtons) && {
                character: 'W',
                exec: _onShortcutToggleTileView,
                helpDescription: 'toolbar.tileViewToggle'
            },
            !_isSpeakerStatsDisabled && isToolbarButtonEnabled('stats', _toolbarButtons) && {
                character: 'T',
                exec: _onShortcutSpeakerStats,
                helpDescription: 'keyboardShortcuts.showSpeakerStats'
            }
        ];

        KEYBOARD_SHORTCUTS.forEach(shortcut => {
            if (typeof shortcut === 'object') {
                dispatch(registerShortcut({
                    character: shortcut.character,
                    handler: shortcut.exec,
                    helpDescription: shortcut.helpDescription
                }));
            }
        });

        if (_reactionsEnabled) {
            const REACTION_SHORTCUTS = Object.keys(REACTIONS).map(key => {
                const onShortcutSendReaction = () => {
                    dispatch(addReactionToBuffer(key));
                    sendAnalytics(createShortcutEvent(
                        `reaction.${key}`
                    ));
                };

                return {
                    character: REACTIONS[key].shortcutChar,
                    exec: onShortcutSendReaction,
                    helpDescription: `toolbar.reaction${key.charAt(0).toUpperCase()}${key.slice(1)}`,
                    altKey: true
                };
            });

            REACTION_SHORTCUTS.forEach(shortcut => {
                dispatch(registerShortcut({
                    alt: shortcut.altKey,
                    character: shortcut.character,
                    handler: shortcut.exec,
                    helpDescription: shortcut.helpDescription
                }));
            });

            if (_gifsEnabled) {
                const onGifShortcut = () => {
                    batch(() => {
                        dispatch(toggleReactionsMenuVisibility());
                        dispatch(setGifMenuVisibility(true));
                    });
                };

                dispatch(registerShortcut({
                    character: 'G',
                    handler: onGifShortcut,
                    helpDescription: 'keyboardShortcuts.giphyMenu'
                }));
            }
        }

        return () => {
            [ 'A', 'C', 'D', 'P', 'R', 'S', 'W', 'T', 'G' ].forEach(letter =>
                dispatch(unregisterShortcut(letter)));

            if (props._reactionsEnabled) {
                Object.keys(REACTIONS).map(key => REACTIONS[key].shortcutChar)
                    .forEach(letter =>
                        dispatch(unregisterShortcut(letter, true)));
            }
        };
    }, []);

    useEffect(() => {
        if (!props._visible) {
            if (document.activeElement instanceof HTMLElement
                && _toolboxRef.current?.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        }
    }, [ props._visible ]);

    /**
     * Sets the visibility of the hangup menu.
     *
     * @param {boolean} visible - Whether or not the hangup menu should be
     * displayed.
     * @private
     * @returns {void}
     */
    const _onSetHangupVisible = useCallback((visible: boolean) => {
        props.dispatch(setHangupMenuVisible(visible));
        props.dispatch(setToolbarHovered(visible));
    }, []);

    /**
     * Sets the visibility of the overflow menu.
     *
     * @param {boolean} visible - Whether or not the overflow menu should be
     * displayed.
     * @private
     * @returns {void}
     */
    const _onSetOverflowVisible = useCallback((visible: boolean) => {
        props.dispatch(setOverflowMenuVisible(visible));
        props.dispatch(setToolbarHovered(visible));
    }, []);

    useEffect(() => {
        if (props._hangupMenuVisible && !props._visible) {
            _onSetHangupVisible(false);
            props.dispatch(setToolbarHovered(false));
        }
    }, [ props._hangupMenuVisible, props._visible ]);

    useEffect(() => {
        if (props._overflowMenuVisible && props._dialog) {
            _onSetOverflowVisible(false);
            props.dispatch(setToolbarHovered(false));
        }
    }, [ props._overflowMenuVisible, props._dialog ]);

    /**
     * Key handler for overflow/hangup menus.
     *
     * @param {KeyboardEvent} e - Esc key click to close the popup.
     * @returns {void}
     */
    const _onEscKey = useCallback((e?: React.KeyboardEvent) => {
        const { dispatch, _hangupMenuVisible, _overflowMenuVisible } = props;

        if (e?.key === 'Escape') {
            e?.stopPropagation();
            _hangupMenuVisible && dispatch(setHangupMenuVisible(false));
            _overflowMenuVisible && dispatch(setOverflowMenuVisible(false));
        }
    }, [ props._hangupMenuVisible, props._overflowMenuVisible ]);

    /**
     * Returns the notify mode of the given toolbox button.
     *
     * @param {string} btnName - The toolbar button's name.
     * @returns {string|undefined} - The button's notify mode.
     */
    function _getButtonNotifyMode(btnName: string) {
        const notify = props._buttonsWithNotifyClick?.find(
            btn =>
                (typeof btn === 'string' && btn === btnName)
                || (typeof btn === 'object' && btn.key === btnName)
        );

        if (notify) {
            return typeof notify === 'string' || notify.preventExecution
                ? NOTIFY_CLICK_MODE.PREVENT_AND_NOTIFY
                : NOTIFY_CLICK_MODE.ONLY_NOTIFY;
        }
    }

    /**
     * Sets the notify click mode for the buttons.
     *
     * @param {Object} buttons - The list of toolbar buttons.
     * @returns {void}
     */
    function _setButtonsNotifyClickMode(buttons: Object) {
        if (typeof APP === 'undefined' || !props._buttonsWithNotifyClick?.length) {
            return;
        }

        Object.values(buttons).forEach((button: any) => {
            if (typeof button === 'object') {
                button.notifyMode = _getButtonNotifyMode(button.key);
            }
        });
    }

    /**
     * Returns all buttons that need to be rendered.
     *
     * @param {Object} state - The redux state.
     * @returns {Object} The visible buttons arrays .
     */
    function _getVisibleButtons() {
        const {
            _clientWidth,
            _toolbarButtons,
            _jwtDisabledButons,
            _customToolbarButtons
        } = props;

        const buttons = getAllToolboxButtons(_customToolbarButtons);

        _setButtonsNotifyClickMode(buttons);
        const isHangupVisible = isToolbarButtonEnabled('hangup', _toolbarButtons);
        let { order } = THRESHOLDS.find(({ width }) => _clientWidth > width)
            || THRESHOLDS[THRESHOLDS.length - 1];

        const keys = Object.keys(buttons);

        const filtered = [
            ...order.map(key => buttons[key as keyof typeof buttons]),
            ...Object.values(buttons).filter((button, index) => !order.includes(keys[index]))
        ].filter(({ key, alias = NOT_APPLICABLE }) =>
            !_jwtDisabledButons.includes(key)
            && (isToolbarButtonEnabled(key, _toolbarButtons) || isToolbarButtonEnabled(alias, _toolbarButtons))
        );
        const filteredKeys = filtered.map(button => button.key);

        order = order.filter(key => filteredKeys.includes(buttons[key as keyof typeof buttons].key));

        let sliceIndex = order.length + 2;

        if (isHangupVisible) {
            sliceIndex -= 1;
        }

        // This implies that the overflow button will be displayed, so save some space for it.
        if (sliceIndex < filtered.length) {
            sliceIndex -= 1;
        }

        return {
            mainMenuButtons: filtered.slice(0, sliceIndex),
            overflowMenuButtons: filtered.slice(sliceIndex)
        };
    }

    /**
     * Dispatches an action signaling the toolbar is not being hovered.
     *
     * @private
     * @returns {void}
     */
    function _onMouseOut() {
        const { _overflowMenuVisible, dispatch } = props;

        !_overflowMenuVisible && dispatch(setToolbarHovered(false));
    }

    /**
     * Dispatches an action signaling the toolbar is being hovered.
     *
     * @private
     * @returns {void}
     */
    function _onMouseOver() {
        props.dispatch(setToolbarHovered(true));
    }

    /**
     * Toggle the toolbar visibility when tabbing into it.
     *
     * @returns {void}
     */
    const _onTabIn = useCallback(() => {
        if (!props._visible) {
            props.dispatch(showToolbox());
        }
    }, [ props._visible ]);

    /**
     * Renders the toolbox content.
     *
     * @returns {ReactElement}
     */
    function _renderToolboxContent() {
        const {
            _endConferenceSupported,
            _hangupMenuVisible,
            _isMobile,
            _isNarrowLayout,
            _overflowDrawer,
            _overflowMenuVisible,
            _reactionsEnabled,
            _reactionsButtonEnabled,
            _toolbarButtons,
            t
        } = props;

        const toolbarAccLabel = 'toolbar.accessibilityLabel.moreActionsMenu';
        const containerClassName = `toolbox-content${_isMobile || _isNarrowLayout ? ' toolbox-content-mobile' : ''}`;

        const { mainMenuButtons, overflowMenuButtons } = _getVisibleButtons();
        const raiseHandInOverflowMenu = overflowMenuButtons.some(({ key }) => key === 'raisehand');
        const showReactionsInOverflowMenu
            = (_reactionsEnabled && !_reactionsButtonEnabled
                && (raiseHandInOverflowMenu || _isNarrowLayout || _isMobile))
            || overflowMenuButtons.some(({ key }) => key === 'reactions');
        const showRaiseHandInReactionsMenu = showReactionsInOverflowMenu && raiseHandInOverflowMenu;

        return (
            <div className = { containerClassName }>
                <div
                    className = 'toolbox-content-wrapper'
                    onFocus = { _onTabIn }
                    { ...(_isMobile ? {} : {
                        onMouseOut: _onMouseOut,
                        onMouseOver: _onMouseOver
                    }) }>

                    <div
                        className = 'toolbox-content-items'
                        ref = { _toolboxRef }>
                        {mainMenuButtons.map(({ Content, key, ...rest }) => Content !== Separator && (
                            <Content
                                { ...rest }
                                buttonKey = { key }
                                key = { key } />))}

                        {Boolean(overflowMenuButtons.length) && (
                            <OverflowMenuButton
                                ariaControls = 'overflow-menu'
                                buttons = { overflowMenuButtons.reduce<Array<IToolboxButton[]>>((acc, val) => {
                                    if (val.key === 'reactions' && showReactionsInOverflowMenu) {
                                        return acc;
                                    }

                                    if (val.key === 'raisehand' && showRaiseHandInReactionsMenu) {
                                        return acc;
                                    }

                                    if (acc.length) {
                                        const prev = acc[acc.length - 1];
                                        const group = prev[prev.length - 1].group;

                                        if (group === val.group) {
                                            prev.push(val);
                                        } else {
                                            acc.push([ val ]);
                                        }
                                    } else {
                                        acc.push([ val ]);
                                    }

                                    return acc;
                                }, []) }
                                isOpen = { _overflowMenuVisible }
                                key = 'overflow-menu'
                                onToolboxEscKey = { _onEscKey }
                                onVisibilityChange = { _onSetOverflowVisible }
                                showRaiseHandInReactionsMenu = { showRaiseHandInReactionsMenu }
                                showReactionsMenu = { showReactionsInOverflowMenu } />
                        )}

                        {isToolbarButtonEnabled('hangup', _toolbarButtons) && (
                            _endConferenceSupported
                                ? <HangupMenuButton
                                    ariaControls = 'hangup-menu'
                                    isOpen = { _hangupMenuVisible }
                                    key = 'hangup-menu'
                                    notifyMode = { _getButtonNotifyMode('hangup-menu') }
                                    onVisibilityChange = { _onSetHangupVisible }>
                                    <ContextMenu
                                        accessibilityLabel = { t(toolbarAccLabel) }
                                        className = { classes.hangupMenu }
                                        hidden = { false }
                                        inDrawer = { _overflowDrawer }
                                        onKeyDown = { _onEscKey }>
                                        <EndConferenceButton
                                            buttonKey = 'end-meeting'
                                            notifyMode = { _getButtonNotifyMode('end-meeting') } />
                                        <LeaveConferenceButton
                                            buttonKey = 'hangup'
                                            notifyMode = { _getButtonNotifyMode('hangup') } />
                                    </ContextMenu>
                                </HangupMenuButton>
                                : <HangupButton
                                    buttonKey = 'hangup'
                                    customClass = 'hangup-button'
                                    key = 'hangup-button'
                                    notifyMode = { _getButtonNotifyMode('hangup') }
                                    visible = { isToolbarButtonEnabled('hangup', _toolbarButtons) } />
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (props._disabled) {
        return null;
    }

    const { _chatOpen, _visible, _toolbarButtons } = props;
    const rootClassNames = `new-toolbox ${_visible ? 'visible' : ''} ${
        _toolbarButtons.length ? '' : 'no-buttons'} ${_chatOpen ? 'shift-right' : ''}`;

    return (
        <div
            className = { cx(rootClassNames, props._shiftUp && 'shift-up') }
            id = 'new-toolbox'>
            {_renderToolboxContent()}
        </div>
    );
};

/**
 * Maps (parts of) the redux state to {@link Toolbox}'s React {@code Component}
 * props.
 *
 * @param {Object} state - The redux store/state.
 * @param {Object} ownProps - The props explicitly passed.
 * @private
 * @returns {{}}
 */
function _mapStateToProps(state: IReduxState, ownProps: any) {
    const { conference } = state['features/base/conference'];
    const { isNarrowLayout } = state['features/base/responsive-ui'];
    const endConferenceSupported = conference?.isEndConferenceSupported() && isLocalParticipantModerator(state);

    const {
        customToolbarButtons,
        iAmRecorder,
        iAmSipGateway
    } = state['features/base/config'];
    const {
        fullScreen,
        hangupMenuVisible,
        overflowMenuVisible,
        overflowDrawer
    } = state['features/toolbox'];
    const localParticipant = getLocalParticipant(state);
    const { clientWidth } = state['features/base/responsive-ui'];
    let toolbarButtons = ownProps.toolbarButtons || getToolbarButtons(state);
    const _reactionsEnabled = isReactionsEnabled(state);

    if (iAmVisitor(state)) {
        toolbarButtons = VISITORS_MODE_BUTTONS.filter(e => toolbarButtons.indexOf(e) > -1);
    }

    return {
        _buttonsWithNotifyClick: getButtonsWithNotifyClick(state),
        _chatOpen: state['features/chat'].isOpen,
        _clientWidth: clientWidth,
        _customToolbarButtons: customToolbarButtons,
        _desktopSharingEnabled: JitsiMeetJS.isDesktopSharingEnabled(),
        _desktopSharingButtonDisabled: isDesktopShareButtonDisabled(state),
        _dialog: Boolean(state['features/base/dialog'].component),
        _disabled: Boolean(iAmRecorder || iAmSipGateway),
        _endConferenceSupported: Boolean(endConferenceSupported),
        _fullScreen: fullScreen,
        _gifsEnabled: isGifEnabled(state),
        _isMobile: isMobileBrowser(),
        _isSpeakerStatsDisabled: isSpeakerStatsDisabled(state),
        _jwtDisabledButons: getJwtDisabledButtons(state),
        _hangupMenuVisible: hangupMenuVisible,
        _isNarrowLayout: isNarrowLayout,
        _overflowMenuVisible: overflowMenuVisible,
        _overflowDrawer: overflowDrawer,
        _participantsPaneOpen: getParticipantsPaneOpen(state),
        _raisedHand: hasRaisedHand(localParticipant),
        _reactionsButtonEnabled: isReactionsButtonEnabled(state),
        _reactionsEnabled,
        _screenSharing: isScreenVideoShared(state),
        _shiftUp: state['features/toolbox'].shiftUp,
        _tileViewEnabled: shouldDisplayTileView(state),
        _toolbarButtons: toolbarButtons,
        _visible: isToolboxVisible(state)
    };
}

export default translate(connect(_mapStateToProps)(Toolbox));
