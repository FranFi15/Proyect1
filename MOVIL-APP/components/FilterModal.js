import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Pressable,
    Image,
    useColorScheme,
    Animated,
    Easing,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';

const FilterModal = ({
    visible,
    onClose,
    options = [],
    onSelect,
    selectedValue,
    title,
    theme,
    gymColor,
    gymLogo,
    /** Render as overlay inside a parent Modal (required on iOS — nested Modals don't stack). */
    embedded = false,
}) => {
    const colorScheme = useColorScheme() ?? 'light';
    const auth = useAuth();
    const [opacity] = useState(() => new Animated.Value(0));
    const [scale] = useState(() => new Animated.Value(0.92));
    const [mounted, setMounted] = useState(false);
    const hasOpenedRef = useRef(false);

    const finalGymColor = gymColor || theme?.gymColor || auth?.gymColor || '#007bff';
    const finalGymLogo = gymLogo || auth?.gymLogo;
    const colors = theme?.colors || Colors[colorScheme];
    const styles = getStyles(colorScheme, finalGymColor, colors);

    // Keep the Modal mounted while opening (render-time sync — avoids setState-in-effect).
    if (!embedded && visible && !mounted) {
        setMounted(true);
    }

    // Enter/exit animation only; unmount after the exit animation finishes.
    useEffect(() => {
        if (embedded) return undefined;
        if (visible) {
            hasOpenedRef.current = true;
            opacity.setValue(0);
            scale.setValue(0.92);
            const animation = Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 220,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.spring(scale, {
                    toValue: 1,
                    friction: 8,
                    tension: 80,
                    useNativeDriver: true,
                }),
            ]);
            animation.start();
            return () => animation.stop();
        }

        if (!hasOpenedRef.current || !mounted) return undefined;

        const animation = Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: 160,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 0.94,
                duration: 160,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
        ]);
        animation.start(({ finished }) => {
            if (finished) setMounted(false);
        });
        return () => animation.stop();
    }, [visible, opacity, scale, embedded, mounted]);

    const logoSource = finalGymLogo
        ? { uri: finalGymLogo }
        : (colorScheme === 'dark'
            ? require('@/assets/images/modo-oscuro-logo.png')
            : require('@/assets/images/modo-claro-logo.png'));

    const handleSelect = (id) => {
        onSelect?.(id);
        onClose?.();
    };

    if (embedded) {
        if (!visible) return null;
        return (
            <View
                pointerEvents="box-none"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 9999,
                    elevation: 9999,
                }}
            >
                <View style={styles.modalOverlayEmbedded}>
                    <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
                    <View style={styles.modalContainer}>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={10}>
                            <Ionicons name="close" size={22} color={colors.text} />
                        </TouchableOpacity>

                        <View style={[styles.iconContainer, { borderColor: colors.cardBackground || colors.background || '#fff' }]}>
                            <View style={[styles.iconInnerContainer, { backgroundColor: finalGymColor }]}>
                                <Image source={logoSource} style={styles.logoImage} resizeMode="cover" />
                            </View>
                        </View>

                        <View style={styles.contentContainer}>
                            <Text style={styles.title}>{title}</Text>
                            <Text style={styles.message}>Elegí una opción para filtrar</Text>
                        </View>

                        <ScrollView
                            style={styles.optionsScroll}
                            contentContainerStyle={styles.optionsContent}
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {options.length === 0 ? (
                                <Text style={styles.emptyText}>No hay opciones disponibles</Text>
                            ) : (
                                options.map((item) => {
                                    const selected = selectedValue === item._id;
                                    return (
                                        <TouchableOpacity
                                            key={String(item._id)}
                                            style={[styles.optionButton, selected ? styles.optionSelected : styles.optionIdle]}
                                            onPress={() => handleSelect(item._id)}
                                            activeOpacity={0.85}
                                        >
                                            <Text style={[styles.optionText, selected ? styles.optionTextSelected : styles.optionTextIdle]}>
                                                {item.nombre}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                    </View>
                </View>
            </View>
        );
    }

    if (!mounted) return null;

    const body = (
        <Animated.View style={[styles.modalOverlay, { opacity }]}>
            <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
            <Animated.View style={[styles.modalContainer, { transform: [{ scale }] }]}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={10}>
                    <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>

                <View style={[styles.iconContainer, { borderColor: colors.cardBackground || colors.background || '#fff' }]}>
                    <View style={[styles.iconInnerContainer, { backgroundColor: finalGymColor }]}>
                        <Image source={logoSource} style={styles.logoImage} resizeMode="cover" />
                    </View>
                </View>

                <View style={styles.contentContainer}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>Elegí una opción para filtrar</Text>
                </View>

                <ScrollView
                    style={styles.optionsScroll}
                    contentContainerStyle={styles.optionsContent}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {options.length === 0 ? (
                        <Text style={styles.emptyText}>No hay opciones disponibles</Text>
                    ) : (
                        options.map((item) => {
                            const selected = selectedValue === item._id;
                            return (
                                <TouchableOpacity
                                    key={String(item._id)}
                                    style={[styles.optionButton, selected ? styles.optionSelected : styles.optionIdle]}
                                    onPress={() => handleSelect(item._id)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.optionText, selected ? styles.optionTextSelected : styles.optionTextIdle]}>
                                        {item.nombre}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>
            </Animated.View>
        </Animated.View>
    );

    return (
        <Modal
            visible={mounted}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
            presentationStyle="overFullScreen"
        >
            {body}
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor, colors) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 12,
    },
    modalOverlayEmbedded: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 12,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContainer: {
        width: '94%',
        maxWidth: 460,
        maxHeight: '78%',
        backgroundColor: colors.cardBackground || colors.background || '#fff',
        borderRadius: 16,
        padding: 24,
        paddingTop: 50,
        alignItems: 'center',
        elevation: 8,
        zIndex: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    closeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 2,
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#f0f0f5',
    },
    iconContainer: {
        position: 'absolute',
        top: -40,
        alignSelf: 'center',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.cardBackground || colors.background || '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    iconInnerContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    contentContainer: {
        alignItems: 'center',
        marginBottom: 16,
        width: '100%',
        paddingHorizontal: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        color: colors.text,
        opacity: 0.7,
        textAlign: 'center',
        lineHeight: 20,
    },
    optionsScroll: {
        width: '100%',
        flexGrow: 0,
        maxHeight: 320,
        marginBottom: 4,
    },
    optionsContent: {
        width: '100%',
        gap: 10,
        paddingBottom: 8,
    },
    optionButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionSelected: {
        backgroundColor: gymColor || '#007bff',
    },
    optionIdle: {
        backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#f0f0f5',
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    optionTextSelected: {
        color: '#FFFFFF',
    },
    optionTextIdle: {
        color: colors.text,
    },
    emptyText: {
        textAlign: 'center',
        color: colors.text,
        opacity: 0.6,
        paddingVertical: 20,
    },
});

export default FilterModal;
