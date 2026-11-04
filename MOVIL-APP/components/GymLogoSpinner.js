import React, { useContext, useEffect } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { AuthContext } from '@/contexts/AuthContext';

const SIZE_MAP = {
    large: 64,
    small: 28,
};

/**
 * Spinning gym logo loader (Y-axis flip). Uses AuthContext gymLogo when logoUrl is omitted.
 * Falls back to ActivityIndicator when no logo is available.
 */
export default function GymLogoSpinner({
    logoUrl,
    color,
    size = 'large',
    style,
    label = null,
    labelStyle = null,
}) {
    const auth = useContext(AuthContext);
    const resolvedLogo = logoUrl || auth?.gymLogo || null;
    const resolvedColor = color || auth?.gymColor || '#1a5276';
    const pixelSize = typeof size === 'number' ? size : (SIZE_MAP[size] || SIZE_MAP.large);

    const progress = useSharedValue(0);

    useEffect(() => {
        if (!resolvedLogo) return;
        progress.value = 0;
        progress.value = withRepeat(
            withTiming(1, { duration: 1400, easing: Easing.linear }),
            -1,
            false
        );
    }, [progress, resolvedLogo]);

    // scaleX = cos(θ) approximates a Y-axis flip without the edge-on “half logo” glitch from rotateY.
    const spinStyle = useAnimatedStyle(() => {
        const scaleX = Math.cos(progress.value * Math.PI * 2);
        return {
            transform: [{ scaleX: Math.abs(scaleX) < 0.08 ? (scaleX < 0 ? -0.08 : 0.08) : scaleX }],
        };
    });

    return (
        <View style={[styles.wrap, style]}>
            {resolvedLogo ? (
                <View
                    style={[
                        styles.logoBox,
                        { width: pixelSize, height: pixelSize },
                        Platform.OS === 'web' ? styles.perspective : null,
                    ]}
                >
                    <Animated.View style={spinStyle}>
                        <Image
                            source={{ uri: resolvedLogo }}
                            style={{ width: pixelSize, height: pixelSize }}
                            resizeMode="contain"
                        />
                    </Animated.View>
                </View>
            ) : (
                <ActivityIndicator
                    size={pixelSize >= 48 ? 'large' : 'small'}
                    color={resolvedColor}
                />
            )}
            {!!label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    logoBox: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
    perspective: {
        // @ts-ignore web-only
        perspective: '800px',
    },
    label: {
        fontSize: 14,
        opacity: 0.65,
    },
});
