import { DeviceEventEmitter, Platform } from 'react-native';
import { CameraView } from 'expo-camera';

/**
 * Opens a QR scanner and resolves with the scanned string (or null if cancelled).
 * iOS: prefers the OS modern scanner.
 * Android: always uses the in-app /scan-qr CameraView — Google Code Scanner
 * (CameraView.launchScanner) has been crashing production builds on some devices.
 */
export const QR_SCAN_EVENT = 'movil-qr-scan-result';

let pendingResolve = null;

const resolvePending = (data) => {
    const resolve = pendingResolve;
    pendingResolve = null;
    if (typeof resolve === 'function') {
        resolve(data == null ? null : String(data));
    }
};

export const completeQrScan = (data) => {
    const value = data == null ? null : String(data);
    resolvePending(value);
    // Backup channel: survives cases where the promise waiter was already cleared
    // by a remount/blur cancel, so the calendar can still open presentismo.
    if (value) {
        DeviceEventEmitter.emit(QR_SCAN_EVENT, value);
    }
};

export const cancelQrScan = () => {
    resolvePending(null);
};

const extractScanData = (event) => {
    if (event == null) return null;
    if (typeof event === 'string') return event;
    return (
        event.data
        || event.raw
        || event?.nativeEvent?.data
        || event?.nativeEvent?.raw
        || null
    );
};

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

        subscription = CameraView.onModernBarcodeScanned((event) => {
            const value = extractScanData(event);
            if (!value) return;
            finish(value);
            CameraView.dismissScanner().catch(() => {});
        });

        try {
            await CameraView.launchScanner({ barcodeTypes: ['qr'] });
        } catch (_e) {
            finish(null);
        }
    });

const scanWithRoute = (router) =>
    new Promise((resolve) => {
        pendingResolve = resolve;
        try {
            router.push('/scan-qr');
        } catch (_e) {
            pendingResolve = null;
            resolve(null);
        }
    });

export const openQrScanner = async (router) => {
    if (typeof pendingResolve === 'function') {
        pendingResolve(null);
        pendingResolve = null;
    }

    const canUseModern =
        Platform.OS === 'ios' && !!CameraView.isModernBarcodeScannerAvailable;

    if (canUseModern) {
        try {
            return await scanWithModernScanner();
        } catch (_e) {
            // Fall through to CameraView route.
        }
    }

    return scanWithRoute(router);
};
