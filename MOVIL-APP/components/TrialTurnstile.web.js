import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise = null;

const loadTurnstileScript = () => {
    if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise((resolve, reject) => {
        const existing = document.getElementById(SCRIPT_ID);
        if (existing) {
            existing.addEventListener('load', () => resolve(window.turnstile));
            existing.addEventListener('error', reject);
            if (window.turnstile) resolve(window.turnstile);
            return;
        }
        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(window.turnstile);
        script.onerror = reject;
        document.head.appendChild(script);
    });

    return scriptPromise;
};

/**
 * Cloudflare Turnstile widget (web only).
 * Managed mode — low friction for humans, blocks common bots.
 */
export default function TrialTurnstile({ siteKey, onToken, onExpire, theme = 'auto' }) {
    const wrapRef = useRef(null);
    const widgetIdRef = useRef(null);
    const onTokenRef = useRef(onToken);
    const onExpireRef = useRef(onExpire);
    onTokenRef.current = onToken;
    onExpireRef.current = onExpire;

    useEffect(() => {
        if (!siteKey || !wrapRef.current) return undefined;
        let cancelled = false;
        const host = document.createElement('div');
        // RN Web View ref is the DOM node.
        const parent = wrapRef.current;
        parent.appendChild(host);

        loadTurnstileScript()
            .then((turnstile) => {
                if (cancelled || !turnstile) return;
                widgetIdRef.current = turnstile.render(host, {
                    sitekey: siteKey,
                    theme,
                    callback: (token) => onTokenRef.current?.(token),
                    'expired-callback': () => {
                        onTokenRef.current?.('');
                        onExpireRef.current?.();
                    },
                    'error-callback': () => onTokenRef.current?.(''),
                });
            })
            .catch((err) => {
                console.warn('Turnstile failed to load', err);
            });

        return () => {
            cancelled = true;
            if (widgetIdRef.current != null && window.turnstile) {
                try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
                widgetIdRef.current = null;
            }
            try { host.remove(); } catch { /* ignore */ }
        };
    }, [siteKey, theme]);

    if (!siteKey) return null;

    return <View ref={wrapRef} style={styles.wrap} />;
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 4,
        minHeight: 65,
    },
});
