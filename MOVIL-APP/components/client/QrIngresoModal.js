import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    StyleSheet,
    TouchableOpacity,
    useColorScheme,
    Image,
    ActivityIndicator,
    useWindowDimensions,
    Pressable,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

/**
 * Shows the admin-uploaded ingreso QR image for the client.
 */
const QrIngresoModal = ({ visible, onClose, qrUrl, userName, gymColor }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const { width: screenW } = useWindowDimensions();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const styles = getStyles(colorScheme, gymColor);
    const qrSize = Math.min(280, screenW * 0.7);

    useEffect(() => {
        if (visible && qrUrl) {
            setLoading(true);
            setError(false);
        }
    }, [visible, qrUrl]);

    if (!qrUrl) return null;

    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Pressable style={styles.modalView} onPress={() => {}}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={12}>
                        <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                    </TouchableOpacity>

                    <ThemedText style={styles.modalTitle}>Tu QR de Ingreso</ThemedText>
                    <ThemedText style={styles.modalSubtitle}>
                        Mostrá este código en recepción
                    </ThemedText>

                    <View style={[styles.qrContainer, { width: qrSize + 32, height: qrSize + 32 }]}>
                        {loading && !error && (
                            <ActivityIndicator
                                size="large"
                                color={gymColor || Colors.light.tint}
                                style={styles.loader}
                            />
                        )}
                        {error ? (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle-outline" size={40} color="#e74c3c" />
                                <ThemedText style={styles.errorText}>
                                    No se pudo cargar el QR
                                </ThemedText>
                            </View>
                        ) : (
                            <Image
                                source={{ uri: qrUrl }}
                                style={{ width: qrSize, height: qrSize }}
                                resizeMode="contain"
                                onLoadStart={() => {
                                    setLoading(true);
                                    setError(false);
                                }}
                                onLoad={() => setLoading(false)}
                                onError={() => {
                                    setLoading(false);
                                    setError(true);
                                }}
                            />
                        )}
                    </View>

                    {!!userName && (
                        <ThemedText style={styles.userName}>{userName}</ThemedText>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 20,
    },
    modalView: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: Colors[colorScheme].cardBackground || Colors[colorScheme].background,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    closeButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 2,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 6,
        marginTop: 8,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 15,
        opacity: 0.7,
        marginBottom: 22,
        textAlign: 'center',
    },
    qrContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors[colorScheme].border || '#e0e0e0',
        overflow: 'hidden',
    },
    loader: {
        position: 'absolute',
        zIndex: 1,
    },
    errorBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.8,
    },
    userName: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 18,
        textAlign: 'center',
    },
});

export default QrIngresoModal;
