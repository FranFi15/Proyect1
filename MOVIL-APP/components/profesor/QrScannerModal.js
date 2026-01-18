import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, Modal } from 'react-native'; // Importamos Modal
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ThemedText } from '@/components/ThemedText';

const QrScannerModal = ({ visible, onClose, onBarcodeScanned }) => {
    const [permission, requestPermission] = useCameraPermissions();

    useEffect(() => {
        // Si el modal se va a hacer visible y no tenemos permiso, lo pedimos.
        if (visible && (!permission || !permission.granted)) {
            requestPermission();
        }
    }, [visible, permission, requestPermission]);

    let content = null;

    if (!permission) {
        // El permiso aún no se ha determinado
        content = (
            <View style={styles.permissionContainer}>
                <ActivityIndicator size="large" />
                <ThemedText style={styles.permissionText}>Cargando cámara...</ThemedText>
            </View>
        );
    } else if (!permission.granted) {
        // El permiso fue denegado
        content = (
            <View style={styles.permissionContainer}>
                <ThemedText style={styles.permissionText}>Acceso a la cámara denegado</ThemedText>
                <ThemedText style={styles.permissionSubText}>
                    Para escanear códigos QR, necesitas habilitar el permiso de la cámara.
                </ThemedText>
                <Button title="Permitir Cámara" onPress={requestPermission} />
                <View style={{marginTop: 20}}><Button title="Cerrar" onPress={onClose} color="#888" /></View>
            </View>
        );
    } else {
        // El permiso está concedido, mostramos la cámara
        content = (
            <CameraView
                onBarcodeScanned={onBarcodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                style={StyleSheet.absoluteFillObject}
            >
                <View style={styles.closeButtonContainer}>
                    <Button title="Cancelar" onPress={onClose} color="#e74c3c" />
                </View>
            </CameraView>
        );
    }

    return (
        <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.container}>
                {content}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
    permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'black' },
    permissionText: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: 'white' },
    permissionSubText: { fontSize: 16, textAlign: 'center', opacity: 0.8, marginBottom: 20, color: 'white' },
    closeButtonContainer: { position: 'absolute', bottom: 50, left: 20, right: 20 },
});

export default QrScannerModal;