import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { openQrScanner } from '../../services/qrScanBridge';

/**
 * Compatibility wrapper: existing screens still pass visible/onClose/onBarcodeScanned.
 * Opens the OS QR scanner (or /scan-qr fallback).
 */
const QrScannerModal = ({ visible, onClose, onBarcodeScanned }) => {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();
    const busyRef = useRef(false);
    const onCloseRef = useRef(onClose);
    const onScanRef = useRef(onBarcodeScanned);
    onCloseRef.current = onClose;
    onScanRef.current = onBarcodeScanned;

    useEffect(() => {
        if (!visible) {
            busyRef.current = false;
            return undefined;
        }
        if (busyRef.current) return undefined;

        let cancelled = false;
        busyRef.current = true;

        (async () => {
            try {
                let granted = permission?.granted;
                if (!granted) {
                    const res = await requestPermission();
                    granted = !!res?.granted;
                }
                if (!granted) {
                    if (!cancelled) {
                        Alert.alert(
                            'Cámara',
                            'Necesitamos permiso de cámara para escanear el QR.',
                            [{ text: 'OK' }]
                        );
                        onCloseRef.current?.();
                    }
                    return;
                }

                const data = await openQrScanner(router);
                if (cancelled) return;
                if (data) {
                    onScanRef.current?.({ data });
                }
                onCloseRef.current?.();
            } catch (_e) {
                if (!cancelled) onCloseRef.current?.();
            } finally {
                busyRef.current = false;
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [visible, router]);

    return null;
};

export default QrScannerModal;
