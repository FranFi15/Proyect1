import React, { useCallback, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Dimensions,
    StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { completeQrScan, cancelQrScan } from '../services/qrScanBridge';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * Full-screen QR scanner route.
 * Avoids CameraView-inside-Modal black screens on Android/iOS.
 */
export default function ScanQrScreen() {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();
    const [cameraKey, setCameraKey] = useState(0);
    const [showCamera, setShowCamera] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [mountError, setMountError] = useState(null);
    const scannedLock = useRef(false);
    const finished = useRef(false);

    const finish = useCallback((data) => {
        if (finished.current) return;
        finished.current = true;
        setShowCamera(false);
        if (data) completeQrScan(data);
        else cancelQrScan();
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/calendar');
    }, [router]);

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            // Stay "finished" briefly so React Strict Mode remount does not cancel the waiter
            finished.current = true;
            const armTimer = setTimeout(() => {
                finished.current = false;
            }, 150);
            scannedLock.current = false;
            setIsFocused(true);
            setMountError(null);
            setShowCamera(false);

            (async () => {
                let granted = permission?.granted;
                if (!granted) {
                    const res = await requestPermission();
                    granted = !!res?.granted;
                }
                if (!granted || cancelled) return;
                await new Promise((r) => setTimeout(r, 350));
                if (cancelled) return;
                setCameraKey((k) => k + 1);
                setShowCamera(true);
            })();

            return () => {
                cancelled = true;
                clearTimeout(armTimer);
                setIsFocused(false);
                setShowCamera(false);
                if (!finished.current) {
                    finished.current = true;
                    cancelQrScan();
                }
            };
        }, [permission?.granted, requestPermission])
    );

    const onBarcodeScanned = useCallback(({ data }) => {
        if (!data || scannedLock.current || !isFocused) return;
        scannedLock.current = true;
        finish(String(data));
    }, [finish, isFocused]);

    const granted = !!permission?.granted;
    const canShowCamera = isFocused && granted && showCamera && !mountError;

    return (
        <View style={styles.container}>
            <StatusBar hidden />
            {canShowCamera ? (
                <CameraView
                    key={`scan-${cameraKey}`}
                    style={styles.camera}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={onBarcodeScanned}
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
                            <ActivityIndicator size="large" color="#fff" />
                            <Text style={[styles.subtitle, { marginTop: 14 }]}>Abriendo cámara…</Text>
                        </>
                    )}
                </View>
            )}

            {canShowCamera && (
                <View style={styles.overlay} pointerEvents="none">
                    <View style={styles.scanFrame} />
                    <Text style={styles.hint}>Apuntá al QR del gimnasio</Text>
                </View>
            )}

            <TouchableOpacity style={styles.closeFab} onPress={() => finish(null)} hitSlop={12}>
                <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBar} onPress={() => finish(null)}>
                <Text style={styles.cancelBarText}>Cancelar</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
        width: '100%',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
        backgroundColor: '#000',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: Math.min(260, SCREEN_W * 0.7),
        height: Math.min(260, SCREEN_W * 0.7),
        borderRadius: 18,
        borderWidth: 2.5,
        borderColor: 'rgba(255,255,255,0.9)',
        backgroundColor: 'transparent',
        marginBottom: 16,
    },
    hint: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        paddingHorizontal: 24,
        textShadowColor: 'rgba(0,0,0,0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
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
