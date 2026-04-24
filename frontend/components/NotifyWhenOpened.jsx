'use client';

import {useCallback, useEffect, useState} from 'react';
import {getPushControlState, loadPushConfig, subscribeForReadNotifications} from '../utils/pushNotifications';

export function useNotifyWhenOpened() {
    const [notifyWhenOpened, setNotifyWhenOpened] = useState(false);
    const [isPreparingPush, setIsPreparingPush] = useState(false);
    const [controlState, setControlState] = useState(() => getPushControlState());

    useEffect(() => {
        let isActive = true;

        loadPushConfig().then((nextState) => {
            if (isActive && nextState.isConfigured) {
                setControlState(nextState);
            }
        });

        return () => {
            isActive = false;
        };
    }, []);

    const handleNotifyChange = useCallback((event) => {
        const shouldEnable = event.target.checked;
        setNotifyWhenOpened(shouldEnable);
    }, []);

    const getPushSubscription = useCallback(async () => {
        if (!notifyWhenOpened || controlState.isDisabled) {
            return null;
        }

        setIsPreparingPush(true);
        try {
            return await subscribeForReadNotifications();
        } catch (error) {
            setNotifyWhenOpened(false);
            return null;
        } finally {
            setControlState(getPushControlState());
            setIsPreparingPush(false);
        }
    }, [controlState.isDisabled, notifyWhenOpened]);

    return {
        isConfigured: controlState.isConfigured,
        notifyWhenOpened,
        isPreparingPush,
        isPushDisabled: controlState.isDisabled,
        pushHint: controlState.hint,
        getPushSubscription,
        handleNotifyChange,
    };
}

export function NotifyWhenOpenedField({state, disabled = false}) {
    const hint = state.isPreparingPush ? 'Enabling notifications...' : state.pushHint;

    return (
        <div className="notify-option">
            <label className={`notify-option-label ${state.isPushDisabled ? 'notify-option-label-disabled' : ''}`}>
                <input
                    checked={state.notifyWhenOpened}
                    disabled={state.isPushDisabled || state.isPreparingPush || disabled}
                    onChange={state.handleNotifyChange}
                    type="checkbox"
                />
                <span>Notify me when opened</span>
            </label>
            {hint && (
                <p className="form-help">{hint}</p>
            )}
        </div>
    );
}
