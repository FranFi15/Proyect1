import React, { useCallback, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    StatusBar,
    BackHandler,
} from 'react-native';
import GymLogoSpinner from '@/components/GymLogoSpinner';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { completeQrScan, cancelQrScan } from '../services/qrScanBridge';

/**
 * Full-screen QR scanner route.
 * Avoids CameraView-inside-Modal black screens on Android/iOS.
 */
export default function ScanQrScreen() {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();
    const [cameraKey, setCameraKey] = useState(0);
    const [showCamera, setShowCamera] = useState(false);
    const [mountError, setMountError] = useState(null);
    const scannedLock = useRef(false);
    const finished = useRef(false);
    const blurCancelTimer = useRef(null);
    const permissionRef = useRef(permission);
    const requestPermissionRef = useRef(requestPermission);
    permissionRef.current = permission;
    requestPermissionRef.current = requestPermission;

    const goBack = useCallback(() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/calendar');
    }, [router]);

    const finish = useCallback((data) => {
        if (finished.current) return;
        finished.current = true;
        scannedLock.current = true;
        setShowCamera(false);

        if (blurCancelTimer.current) {
            clearTimeout(blurCancelTimer.current);
            blurCancelTimer.current = null;
        }

        // Resolve waiter first so calendar can fetch options, then pop.
        if (data) completeQrScan(String(data));
        else cancelQrScan();

        setTimeout(goBack, 60);
    }, [goBack]);

    useFocusEffect(
        useCallback(() => {
            let active = true;

            // A previous blur scheduled a cancel — this remount/refocus means
            // the scan session is still alive (Strict Mode or brief blur).
            if (blurCancelTimer.current) {
                clearTimeout(blurCancelTimer.current);
                blurCancelTimer.current = null;
            }

            // Only arm a fresh session if we are not already closing after a scan
            if (!finished.current) {
                scannedLock.current = false;
            }
            setMountError(null);
            setShowCamera(false);

            const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
                finish(null);
                return true;
            });

            (async () => {
                try {
                    let granted = permissionRef.current?.granted;
                    if (!granted) {
                        const res = await requestPermissionRef.current?.();
                        granted = !!res?.granted;
                    }
                    if (!granted || !active || finished.current) return;

                    await new Promise((r) => setTimeout(r, Platform.OS === 'android' ? 450 : 250));
                    if (!active || finished.current) return;

                    setCameraKey((k) => k + 1);
                    setShowCamera(true);
                } catch (_e) {
                    if (active) setMountError('No se pudo abrir la cámara');
                }
            })();

            return () => {
                active = false;
                backSub.remove();
                setShowCamera(false);

                // Defer cancel so Strict Mode remount can clear this timer.
                // Real leave (user backed out) keeps the timer and cancels the waiter.
                blurCancelTimer.current = setTimeout(() => {
                    blurCancelTimer.current = null;
                    if (!finished.current) {
                        finished.current = true;
                        cancelQrScan();
                    }
                }, 500);
            };
        }, [finish])
    );

    const onBarcodeScanned = useCallback(({ data }) => {
        if (!data || scannedLock.current || finished.current) return;
        scannedLock.current = true;
        finish(String(data));
    }, [finish]);

    const granted = !!permission?.granted;
    const canShowCamera = granted && showCamera && !mountError;

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
