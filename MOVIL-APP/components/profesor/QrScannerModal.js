import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import GymLogoSpinner from '@/components/GymLogoSpinner';

/**
 * Full-screen QR scanner shown as a Modal (no route push).
 * Avoids leaving the parent screen — navigating to /scan-qr was remounting
 * calendar and wiping the presentismo modal state.
 *
 * iOS: prefers the OS modern scanner when available.
 * Android / fallback: in-modal CameraView.
 */
const scanWithModernScanner = () =>
    new Promise(async (resolve) => {
        let done = false;
        let subscription = null;

        const finish = (data) => {
            if (done) return;
            done = true;
            try {
                subscription?.remove?.();
            } catch (_e) {
                /* ignore */
            }
            resolve(data == null ? null : String(data));
        };

        try {
            subscription = CameraView.onModernBarcodeScanned((event) => {
                const value =
                    typeof event === 'string'
                        ? event
                        : event?.data || event?.raw || event?.nativeEvent?.data || null;
                if (!value) return;
                finish(value);
                CameraView.dismissScanner().catch(() => {});
            });
            await CameraView.launchScanner({ barcodeTypes: ['qr'] });
        } catch (_e) {
            finish(null);
        }
    });

const QrScannerModal = ({ visible, onClose, onBarcodeScanned }) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [showCamera, setShowCamera] = useState(false);
    const [cameraKey, setCameraKey] = useState(0);
    const [mountError, setMountError] = useState(null);
    const scannedLock = useRef(false);
    const closedRef = useRef(false);
    const onCloseRef = useRef(onClose);
    const onScanRef = useRef(onBarcodeScanned);
    onCloseRef.current = onClose;
    onScanRef.current = onBarcodeScanned;

    const closeOnce = useCallback(() => {
        if (closedRef.current) return;
        closedRef.current = true;
        setShowCamera(false);
        onCloseRef.current?.();
    }, []);

    const deliverScan = useCallback((data) => {
        if (!data || scannedLock.current) return;
        scannedLock.current = true;
        setShowCamera(false);
        onScanRef.current?.({ data: String(data) });
        closeOnce();
    }, [closeOnce]);

    // iOS modern scanner path (no CameraView modal)
    useEffect(() => {
        if (!visible) {
            closedRef.current = false;
            scannedLock.current = false;
            setShowCamera(false);
            setMountError(null);
            return undefined;
        }

        const canUseModern =
            Platform.OS === 'ios' && !!CameraView.isModernBarcodeScannerAvailable;

        if (!canUseModern) return undefined;

        let cancelled = false;
        closedRef.current = false;
        scannedLock.current = false;

        (async () => {
            try {
                let granted = permission?.granted;
                if (!granted) {
                    const res = await requestPermission();
                    granted = !!res?.granted;
                }
                if (!granted) {
                    if (!cancelled) {
                        Alert.alert('Cámara', 'Necesitamos permiso de cámara para escanear el QR.');
                        closeOnce();
                    }
                    return;
                }

                const data = await scanWithModernScanner();
                if (cancelled) return;
                if (data) deliverScan(data);
                else closeOnce();
            } catch (_e) {
                if (!cancelled) closeOnce();
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [visible, permission?.granted, requestPermission, closeOnce, deliverScan]);

    // Android / fallback: mount CameraView inside this Modal
    useEffect(() => {
        if (!visible) return undefined;

        const canUseModern =
            Platform.OS === 'ios' && !!CameraView.isModernBarcodeScannerAvailable;
        if (canUseModern) return undefined;

        let cancelled = false;
        closedRef.current = false;
        scannedLock.current = false;
        setMountError(null);
        setShowCamera(false);

        (async () => {
            try {
                let granted = permission?.granted;
                if (!granted) {
                    const res = await requestPermission();
                    granted = !!res?.granted;
                }
                if (!granted || cancelled) return;

                // Wait a beat so the Modal animation finishes before CameraView mounts
                await new Promise((r) => setTimeout(r, Platform.OS === 'android' ? 400 : 200));
                if (cancelled || closedRef.current) return;

                setCameraKey((k) => k + 1);
                setShowCamera(true);
            } catch (_e) {
                if (!cancelled) setMountError('No se pudo abrir la cámara');
            }
        })();

        return () => {
            cancelled = true;
            setShowCamera(false);
        };
    }, [visible, permission?.granted, requestPermission]);

    const canUseModern =
        Platform.OS === 'ios' && !!CameraView.isModernBarcodeScannerAvailable;

    // iOS modern path renders nothing — OS sheet handles UI
    if (canUseModern) return null;

    const granted = !!permission?.granted;
    const canShowCamera = visible && granted && showCamera && !mountError;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => closeOnce()}
        >
            <View style={styles.container}>
                <StatusBar hidden={visible} />
                {canShowCamera ? (
                    <CameraView
                        key={`scan-${cameraKey}`}
                        style={styles.camera}
                        facing="back"
                        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                        onBarcodeScanned={({ data }) => deliverScan(data)}
                        onMountError={(e) => {
                            setMountError(e?.message || 'Error al iniciar la cámara');
                            setShowCamera(false);
                        }}
                    />
                ) : (
                    <View style={styles.centered}>
                        {mountError ? (
                            <>
                                <Text style={styles.title}>No se pudo iniciar la cámara</Text>
                                <Text style={styles.subtitle}>{mountError}</Text>
                                <TouchableOpacity
                                    style={styles.primaryBtn}
                                    onPress={() => {
                                        setMountError(null);
                                        setShowCamera(false);
                                        setTimeout(() => {
                                            setCameraKey((k) => k + 1);
                                            setShowCamera(true);
                                        }, 250);
                                    }}
                                >
                                    <Text style={styles.primaryBtnText}>Reintentar</Text>
                                </TouchableOpacity>
                            </>
                        ) : !granted ? (
                            <>
                                <Ionicons name="camera-outline" size={48} color="#fff" style={{ marginBottom: 12 }} />
                                <Text style={styles.title}>Necesitamos acceso a la cámara</Text>
                                <Text style={styles.subtitle}>
                                    Para escanear el QR del gimnasio, habilitá el permiso de cámara.
                                </Text>
                                <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                                    <Text style={styles.primaryBtnText}>Permitir cámara</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <GymLogoSpinner size="large" color="#fff" />
                                <Text style={[styles.subtitle, { marginTop: 14 }]}>Abriendo cámara…</Text>
                            </>
                        )}
                    </View>
                )}

                {canShowCamera && (
                    <View style={styles.hintBar} pointerEvents="none">
                        <Text style={styles.hint}>Apuntá al QR del gimnasio</Text>
                    </View>
                )}

                <TouchableOpacity style={styles.closeFab} onPress={() => closeOnce()} hitSlop={12}>
                    <Ionicons name="close" size={26} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBar} onPress={() => closeOnce()}>
                    <Text style={styles.cancelBarText}>Cancelar</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
        backgroundColor: '#000',
    },
    hintBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 64 : 88,
        left: 24,
        right: 24,
        alignItems: 'center',
        zIndex: 10,
    },
    hint: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 10,
        color: '#fff',
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        opacity: 0.85,
        marginBottom: 22,
        color: '#fff',
        lineHeight: 21,
    },
    primaryBtn: {
        backgroundColor: '#009EE3',
        paddingHorizontal: 22,
        paddingVertical: 12,
        borderRadius: 12,
        minWidth: 180,
        alignItems: 'center',
    },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    closeFab: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 54 : 28,
        right: 18,
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
    },
    cancelBar: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 40 : 28,
        left: 24,
        right: 24,
        backgroundColor: 'rgba(231, 76, 60, 0.92)',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        zIndex: 20,
    },
    cancelBarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

export default QrScannerModal;
