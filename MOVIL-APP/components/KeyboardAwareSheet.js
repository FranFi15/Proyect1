import React, { useEffect, useState } from 'react';
import {
    Animated,
    Easing,
    Keyboard,
    Platform,
    Pressable,
    View,
} from 'react-native';

/**
 * Bottom sheet that:
 * - on iOS: lifts with the keyboard via padding (same duration as keyboard)
 * - on Android: relies on window soft-input resize (extra padding would double-shift and hide content)
 * - uses sharp top corners while the keyboard is open
 */
export default function KeyboardAwareSheet({
    children,
    onDismiss,
    backgroundColor = '#fff',
    borderRadius = 16,
    style,
}) {
    const [keyboardOpen, setKeyboardOpen] = useState(false);
    const [pad] = useState(() => new Animated.Value(0));

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const animateTo = (toValue, duration = 250) => {
            Animated.timing(pad, {
                toValue,
                duration: Platform.OS === 'ios' ? duration : Math.min(duration, 200),
                easing: Easing.bezier(0.17, 0.59, 0.4, 0.99),
                useNativeDriver: false,
            }).start();
        };

        const onShow = (e) => {
            setKeyboardOpen(true);
            // Android already resizes/pans the window; padding again pushes the sheet off-screen.
            if (Platform.OS === 'ios') {
                animateTo(e?.endCoordinates?.height ?? 0, e?.duration || 250);
            }
        };
        const onHide = (e) => {
            setKeyboardOpen(false);
            if (Platform.OS === 'ios') {
                animateTo(0, e?.duration || 250);
            }
        };

        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [pad]);

    const topRadius = keyboardOpen ? 0 : borderRadius;

    return (
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable style={{ flex: 1 }} onPress={onDismiss} accessibilityRole="button" />
            <Animated.View
                style={[
                    {
                        width: '100%',
                        backgroundColor,
                        borderTopLeftRadius: topRadius,
                        borderTopRightRadius: topRadius,
                        paddingBottom: pad,
                        overflow: 'hidden',
                    },
                    style,
                ]}
            >
                {children}
            </Animated.View>
        </View>
    );
}
