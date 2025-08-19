import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { CameraView, Camera } from 'expo-camera';

const QrScannerModal = ({ visible, onClose, onBarcodeScanned }) => {
    const [hasPermission, setHasPermission] = useState(null);

    useEffect(() => {
        const getCameraPermissions = async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        };
        if (visible) {
            getCameraPermissions();
        }
    }, [visible]);

    if (!visible) return null;

    if (hasPermission === null) {
        return <View><Text>Pidiendo permiso para la cámara...</Text></View>;
    }
    if (hasPermission === false) {
        return <View><Text>No tienes acceso a la cámara. Habilítalo en los ajustes.</Text><Button title="Cerrar" onPress={onClose} /></View>;
    }

    return (
        <View style={styles.container}>
            <CameraView
                onBarcodeScanned={onBarcodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
                style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.closeButtonContainer}>
                <Button title="Cancelar" onPress={onClose} color="#fff" />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black' },
    closeButtonContainer: { position: 'absolute', bottom: 40, left: 20, right: 20 },
});

export default QrScannerModal;