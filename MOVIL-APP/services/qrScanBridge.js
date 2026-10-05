import { Platform } from 'react-native';
import { CameraView } from 'expo-camera';

/**
 * Opens a QR scanner and resolves with the scanned string (or null if cancelled).
 * Prefers the OS modern scanner to avoid black CameraView previews.
 */
let pendingResolve = null;

const resolvePending = (data) => {
    const resolve = pendingResolve;
    pendingResolve = null;
    if (typeof resolve === 'function') resolve(data == null ? null : String(data));
};

export const completeQrScan = (data) => {
    resolvePending(data);
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

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

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

        // Must subscribe BEFORE launchScanner. On Android the native promise resolves
        // in the same success callback as sendEvent, so the JS event can arrive slightly
        // after await — keep the listener alive briefly after resolve.
        subscription = CameraView.onModernBarcodeScanned((event) => {
            const value = extractScanData(event);
            if (!value) return;
            finish(value);
            if (Platform.OS === 'ios') {
                CameraView.dismissScanner().catch(() => {});
            }
        });

        try {
            await CameraView.launchScanner({ barcodeTypes: ['qr'] });

            if (Platform.OS === 'android') {
                // Success path: wait for onModernBarcodeScanned to flush across the bridge
                await delay(900);
                if (!done) finish(null);
            }
            // iOS: launchScanner returns when the sheet is presented; stay listening until scan.
            // Dismiss-without-scan is handled next time openQrScanner runs (cancels pending).
        } catch (_e) {
            // Android cancel / failure rejects the native promise
            finish(null);
        }
    });

export const openQrScanner = async (router) => {
    if (typeof pendingResolve === 'function') {
        pendingResolve(null);
        pendingResolve = null;
    }

    const canUseModern =
        Platform.OS !== 'web' && !!CameraView.isModernBarcodeScannerAvailable;

    if (canUseModern) {
        return scanWithModernScanner();
    }

    return new Promise((resolve) => {
        pendingResolve = resolve;
        router.push('/scan-qr');
    });
};
