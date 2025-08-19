import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

const QrModal = ({ visible, onClose, user, gymColor }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

    if (!user) return null;

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalView}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close-circle" size={30} color="#ccc" />
                    </TouchableOpacity>

                    <ThemedText style={styles.modalTitle}>Tu Credencial Digital</ThemedText>
                    <ThemedText style={styles.modalSubtitle}>Muestra este código para tu Turno</ThemedText>

                    <View style={styles.qrContainer}>
                        <QRCode
                            value={user._id} // El QR contiene el ID único del usuario
                            size={250}
                            backgroundColor="white"
                            color="black"
                        />
                    </View>
                    
                    <ThemedText style={styles.userName}>{user.nombre} {user.apellido}</ThemedText>
                </View>
            </View>
        </Modal>
    );
};

const getStyles = (colorScheme, gymColor) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    modalView: {
        width: '90%',
        maxWidth: 340,
        backgroundColor: Colors[colorScheme].background,
        borderRadius: 12,
        padding: 25,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 16,
        opacity: 0.7,
        marginBottom: 25,
        textAlign: 'center',
    },
    qrContainer: {
        padding: 20,
        backgroundColor: 'white',
        borderRadius: 12,
    },
    userName: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 20,
    },
});

export default QrModal;