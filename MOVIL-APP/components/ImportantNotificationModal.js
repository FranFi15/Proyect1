import React from 'react';
import {
    Modal,
    StyleSheet,
    TouchableOpacity,
    View,
    Image,
    Text,
    ScrollView,
    Pressable,
    useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAuth } from '../contexts/AuthContext';

const ImportantNotificationModal = ({ visible, notification, onClose }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const { gymLogo, gymColor } = useAuth();
    const accent = gymColor || '#1a5276';
    const styles = getStyles(colorScheme, accent);

    if (!visible || !notification) {
        return null;
    }

    const title = notification.title || 'Aviso importante';
    const message = notification.message || notification.body || '';
    const logoSource = gymLogo
        ? { uri: gymLogo }
        : (colorScheme === 'dark'
            ? require('@/assets/images/modo-oscuro-logo.png')
            : require('@/assets/images/modo-claro-logo.png'));

    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent
            presentationStyle="overFullScreen"
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />

                <View style={styles.card}>
                    <TouchableOpacity style={styles.closeIcon} onPress={onClose} hitSlop={10}>
                        <Ionicons name="close" size={22} color={Colors[colorScheme].text} />
                    </TouchableOpacity>

                    <View style={[styles.logoRing, { borderColor: Colors[colorScheme].cardBackground || Colors[colorScheme].background }]}>
                        <View style={[styles.logoInner, { backgroundColor: accent }]}>
                            {gymLogo ? (
                                <Image source={logoSource} style={styles.logoImage} resizeMode="cover" />
                            ) : (
                                <Ionicons name="notifications" size={32} color="#fff" />
                            )}
                        </View>
                    </View>

                    <View style={styles.content}>
                        <Text style={styles.kicker}>Aviso importante</Text>
                        <Text style={styles.title}>{title}</Text>
                        <ScrollView
                            style={styles.messageScroll}
                            contentContainerStyle={styles.messageContent}
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                        >
                            <Text style={styles.message}>{message}</Text>
                        </ScrollView>
                    </View>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: accent }]}
                        onPress={onClose}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.buttonText}>Entendido</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const getStyles = (colorScheme, accent) => {
    const colors = Colors[colorScheme];
    return StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.55)',
            paddingHorizontal: 20,
        },
        backdrop: {
            ...StyleSheet.absoluteFillObject,
        },
        card: {
            width: '94%',
            maxWidth: 420,
            maxHeight: '78%',
            backgroundColor: colors.cardBackground || colors.background,
            borderRadius: 18,
            paddingHorizontal: 22,
            paddingTop: 52,
            paddingBottom: 20,
            alignItems: 'center',
            zIndex: 2,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
        },
        closeIcon: {
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 3,
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colorScheme === 'dark' ? '#2c2c2e' : '#f0f0f5',
        },
        logoRing: {
            position: 'absolute',
            top: -40,
            alignSelf: 'center',
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.cardBackground || colors.background,
            justifyContent: 'center',
            alignItems: 'center',
            elevation: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
        },
        logoInner: {
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
        content: {
            width: '100%',
            alignItems: 'center',
            marginBottom: 18,
            flexShrink: 1,
        },
        kicker: {
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: accent,
            opacity: 0.9,
            marginBottom: 8,
            textAlign: 'center',
        },
        title: {
            fontSize: 22,
            fontWeight: '800',
            color: colors.text,
            textAlign: 'center',
            marginBottom: 12,
        },
        messageScroll: {
            width: '100%',
            maxHeight: 280,
            flexGrow: 0,
        },
        messageContent: {
            paddingBottom: 4,
        },
        message: {
            fontSize: 15,
            lineHeight: 22,
            color: colors.text,
            opacity: 0.75,
            textAlign: 'center',
        },
        button: {
            width: '100%',
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        buttonText: {
            color: '#fff',
            fontWeight: '800',
            fontSize: 16,
        },
    });
};

export default ImportantNotificationModal;
