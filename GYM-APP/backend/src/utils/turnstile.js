/**
 * Cloudflare Turnstile verification for public trial endpoints.
 * Set TURNSTILE_SECRET_KEY (+ TURNSTILE_SITE_KEY for the client) to enable.
 * Without a secret, captcha checks are skipped (useful for local/dev).
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const getTurnstilePublicConfig = () => {
    const siteKey = String(process.env.TURNSTILE_SITE_KEY || '').trim();
    const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
    return {
        provider: 'turnstile',
        siteKey,
        required: !!secret,
    };
};

export const verifyTurnstileToken = async (token, remoteip) => {
    const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
    if (!secret) {
        return { ok: true, skipped: true };
    }

    if (!token || typeof token !== 'string') {
        return { ok: false, error: 'Completá la verificación anti-bot.' };
    }

    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    if (remoteip) body.set('remoteip', String(remoteip));

    try {
        const res = await fetch(SITEVERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        const data = await res.json().catch(() => ({}));
        if (!data?.success) {
            return { ok: false, error: 'No pasaste la verificación anti-bot. Probá de nuevo.' };
        }
        return { ok: true };
    } catch (err) {
        console.error('Turnstile verify failed:', err?.message || err);
        return { ok: false, error: 'No se pudo validar la verificación anti-bot.' };
    }
};
