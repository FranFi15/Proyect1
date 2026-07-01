import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

const ReceptionQrModal = ({ visible, onClose, gymColor }) => {
    const colorScheme = useColorScheme() ?? 'light';
    const styles = getStyles(colorScheme, gymColor);

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
                        <Ionicons name="close-circle" size={30} color={Colors[colorScheme].icon} />
                    </TouchableOpacity>

                    <ThemedText style={styles.modalTitle}>QR de Recepción</ThemedText>
                    <ThemedText style={styles.modalSubtitle}>Los clientes escanean este código para registrar su asistencia</ThemedText>

                    <View style={styles.qrContainer}>
                        <QRCode
                            value="GYM_RECEPTION_CHECKIN"
                            size={250}
                            backgroundColor="white"
                            color="black"
                        />
                    </View>
                    
                    <ThemedText style={styles.footerText}>Coloca este QR visible en mostrador o recepción</ThemedText>
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
        maxWidth: 360,
        backgroundColor: Colors[colorScheme].background,
        borderRadius: 10,
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
        fontSize: 15,
        opacity: 0.7,
        marginBottom: 25,
        textAlign: 'center',
    },
    qrContainer: {
        padding: 20,
        backgroundColor: 'white',
        borderRadius: 8,
    },
    footerText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 20,
        textAlign: 'center',
        color: gymColor || Colors[colorScheme].text,
    },
});

export default ReceptionQrModal;
