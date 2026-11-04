import React, { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

/**
 * Spinning gym logo loader. Falls back to ActivityIndicator when no logoUrl.
 */
export default function GymLogoSpinner({
    logoUrl,
    color = '#1a5276',
    size = 72,
    label = null,
    labelStyle = null,
}) {
    const rotation = useSharedValue(0);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 1400, easing: Easing.linear }),
            -1,
            false
        );
    }, [rotation]);

    const spinStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    return (
        <View style={styles.wrap}>
            {logoUrl ? (
                <Animated.View style={spinStyle}>
                    <Image
                        source={{ uri: logoUrl }}
                        style={{ width: size, height: size }}
                        resizeMode="contain"
                    />
                </Animated.View>
            ) : (
                <ActivityIndicator size={size >= 56 ? 'large' : 'small'} color={color} />
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
    label: {
        fontSize: 14,
        opacity: 0.65,
    },
});
