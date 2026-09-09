import asyncHandler from 'express-async-handler';
import axios from 'axios';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import getModels from '../utils/getModels.js';
import connectToGymDB from '../config/mongoConnectionManager.js';
import { fulfillApprovedPayment, resolveTicketCart } from '../services/paymentFulfillment.js';

const MP_APP_ID = process.env.MP_APP_ID;
const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET;
const MP_REDIRECT_URI = process.env.MP_REDIRECT_URI;

const CURRENCY_BY_COUNTRY = {
    Argentina: 'ARS',
    Uruguay: 'UYU',
    Chile: 'CLP',
    Paraguay: 'PYG',
    Peru: 'PEN',
    Colombia: 'COP',
    Mexico: 'MXN',
    Brasil: 'BRL',
    Brazil: 'BRL'
};

export const getPublicBaseUrl = (req) => {
    if (process.env.API_PUBLIC_URL) {
        return process.env.API_PUBLIC_URL.replace(/\/$/, '');
    }
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    return `${proto}://${req.get('host')}`;
};

const parseOAuthState = (state) => {
    if (!state) return {};
    try {
        const decoded = Buffer.from(state, 'base64url').toString('utf8');
        return JSON.parse(decoded);
    } catch {
        return { gymId: state };
    }
};

const isSafeReturnUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return /^(gain-wellness:\/\/|exp:\/\/|exps:\/\/|http:\/\/localhost|https:\/\/)/i.test(url);
};

const getMpSettings = async (Settings) => {
    const settings = await Settings.findById('main_settings');
    if (!settings?.mercadoPago?.isLinked || !settings.mercadoPago.accessToken) {
        return null;
    }
    return settings;
};

const refreshMpAccessToken = async (settings) => {
    const tokenResponse = await axios.post('https://api.mercadopago.com/oauth/token', {
        client_secret: MP_CLIENT_SECRET,
        client_id: MP_APP_ID,
        grant_type: 'refresh_token',
        refresh_token: settings.mercadoPago.refreshToken
    }, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        }
    });

    const { access_token, refresh_token, public_key } = tokenResponse.data;
    settings.mercadoPago.accessToken = access_token;
    if (refresh_token) settings.mercadoPago.refreshToken = refresh_token;
    if (public_key) settings.mercadoPago.publicKey = public_key;
    await settings.save();
    return access_token;
};

const withMpClient = async (settings, fn) => {
    const run = async (accessToken) => {
        const client = new MercadoPagoConfig({ accessToken, options: { timeout: 15000 } });
        return fn(client);
    };

    try {
        return await run(settings.mercadoPago.accessToken);
    } catch (error) {
        const status = error?.status || error?.response?.status;
        if (status === 401 && settings.mercadoPago.refreshToken) {
            const freshToken = await refreshMpAccessToken(settings);
            return run(freshToken);
        }
        throw error;
    }
};

const encodeOAuthState = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');

const linkMercadoPago = asyncHandler(async (req, res) => {
    const gymId = req.gymId;

    if (!MP_APP_ID || !MP_REDIRECT_URI) {
        res.status(500);
        throw new Error('Credenciales de la aplicación SaaS de Mercado Pago no configuradas en el servidor.');
    }

    const returnUrl = isSafeReturnUrl(req.query.returnUrl) ? req.query.returnUrl : 'gain-wellness://mp-oauth';
    const state = encodeOAuthState({ gymId, returnUrl });
    const authUrl = `https://auth.mercadopago.com/authorization?client_id=${MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}`;

    res.json({ url: authUrl });
});

const mercadoPagoCallback = asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;
    const { gymId, returnUrl } = parseOAuthState(state);
    const appReturn = isSafeReturnUrl(returnUrl) ? returnUrl : 'gain-wellness://mp-oauth';
    const separator = appReturn.includes('?') ? '&' : '?';

    if (error || !code || !gymId) {
        console.error('Error en la vinculación de MP:', error || 'faltan parámetros');
        return res.redirect(`${appReturn}${separator}success=0&error=mp_auth_failed`);
    }

    try {
        const tokenResponse = await axios.post('https://api.mercadopago.com/oauth/token', {
            client_secret: MP_CLIENT_SECRET,
            client_id: MP_APP_ID,
            grant_type: 'authorization_code',
            code,
            redirect_uri: MP_REDIRECT_URI
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
        });

        const { access_token, refresh_token, public_key, user_id } = tokenResponse.data;
        const { connection } = await connectToGymDB(gymId);
        if (!connection) throw new Error('No se pudo conectar a la base de datos del cliente.');

        const { Settings } = getModels(connection);
        let settings = await Settings.findById('main_settings');
        if (!settings) {
            settings = new Settings({ _id: 'main_settings' });
        }

        settings.mercadoPago = {
            isLinked: true,
            accessToken: access_token,
            refreshToken: refresh_token,
            publicKey: public_key,
            userId: user_id ? String(user_id) : null,
            linkedAt: new Date()
        };
        await settings.save();

        return res.redirect(`${appReturn}${separator}success=1`);
    } catch (err) {
        console.error('Error obteniendo el token de MP:', err?.response?.data || err.message);
        return res.redirect(`${appReturn}${separator}success=0&error=token_exchange_failed`);
    }
});

const getMercadoPagoStatus = asyncHandler(async (req, res) => {
    const { Settings } = getModels(req.gymDBConnection);
    const settings = await Settings.findById('main_settings');

    if (settings?.mercadoPago?.isLinked) {
        res.json({
            isLinked: true,
            linkedAt: settings.mercadoPago.linkedAt,
            publicKey: settings.mercadoPago.publicKey || null
        });
    } else {
        res.json({ isLinked: false });
    }
});

const unlinkMercadoPago = asyncHandler(async (req, res) => {
    const { Settings } = getModels(req.gymDBConnection);
    const settings = await Settings.findById('main_settings');

    if (settings?.mercadoPago) {
        settings.mercadoPago = {
            isLinked: false,
            accessToken: null,
            refreshToken: null,
            publicKey: null,
            userId: null,
            linkedAt: null
        };
        await settings.save();
    }

    res.json({ message: 'Cuenta de Mercado Pago desvinculada exitosamente.' });
});

const mercadoPagoReturn = asyncHandler(async (req, res) => {
    const status = req.query.status || req.query.collection_status || 'unknown';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pago Mercado Pago</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#f4f6f8; color:#1f2a37; }
    .card { background:#fff; padding:28px 24px; border-radius:16px; text-align:center; box-shadow:0 8px 30px rgba(0,0,0,.08); max-width:360px; }
    h1 { font-size:20px; margin:0 0 8px; }
    p { margin:0; opacity:.75; line-height:1.4; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${status === 'approved' || status === 'success' ? 'Pago recibido' : status === 'pending' ? 'Pago pendiente' : 'Volvé a la app'}</h1>
    <p>Ya podés cerrar esta ventana y volver a Gain Wellness. Si el pago se acreditó, tus créditos o pases se actualizan solos.</p>
  </div>
  <script>
    try { window.location.href = 'gain-wellness://payment-result?status=${encodeURIComponent(status)}'; } catch (e) {}
  </script>
</body>
</html>`);
});

const extractPaymentId = (req) => {
    return req.body?.data?.id || req.body?.data?.id?.toString?.() || req.query['data.id'] || req.query.id || null;
};

const fulfillMercadoPagoPayment = async (gymId, paymentId) => {
    const { connection, pais } = await connectToGymDB(gymId);
    const models = getModels(connection);
    const { Settings, PaymentRequest, User } = models;

    const settings = await getMpSettings(Settings);
    if (!settings) {
        throw new Error(`Mercado Pago no vinculado para el gimnasio ${gymId}`);
    }

    const payment = await withMpClient(settings, (client) => new Payment(client).get({ id: paymentId }));
    if (!payment) return { skipped: true, reason: 'payment_not_found' };

    const ticketId = payment.external_reference;
    if (!ticketId) return { skipped: true, reason: 'no_external_reference' };

    if (payment.status === 'rejected' || payment.status === 'cancelled') {
        await PaymentRequest.findOneAndUpdate(
            { _id: ticketId, status: 'pending' },
            {
                $set: {
                    status: 'rejected',
                    mpPaymentId: String(payment.id),
                    mpStatus: payment.status,
                    adminNotes: `Mercado Pago: ${payment.status_detail || payment.status}`,
                    reviewedAt: Date.now()
                }
            }
        );
        return { skipped: true, reason: payment.status };
    }

    if (payment.status !== 'approved') {
        await PaymentRequest.findOneAndUpdate(
            { _id: ticketId },
            { $set: { mpPaymentId: String(payment.id), mpStatus: payment.status } }
        );
        return { skipped: true, reason: payment.status };
    }

    const ticket = await PaymentRequest.findOneAndUpdate(
        { _id: ticketId, status: 'pending' },
        {
            $set: {
                status: 'approved',
                mpPaymentId: String(payment.id),
                mpStatus: payment.status,
                adminNotes: `Aprobado automáticamente por Mercado Pago (${payment.status_detail || 'accredited'}).`,
                reviewedAt: Date.now()
            }
        },
        { new: true }
    ).populate('package').populate('items.package');

    if (!ticket) {
        return { skipped: true, reason: 'already_approved' };
    }

    const user = await User.findById(ticket.user);
    if (!user) throw new Error('Usuario del ticket no encontrado');

    const cart = resolveTicketCart(ticket);
    const names = cart.map(e => e.quantity > 1 ? `${e.pkg.name} x${e.quantity}` : e.pkg.name);

    try {
        await fulfillApprovedPayment({
            models,
            user,
            packages: cart,
            amount: Number(payment.transaction_amount || ticket.amountTransferred),
            description: names.length > 0
                ? `Pago Mercado Pago: ${names.join(', ')}`
                : 'Abono de saldo por Mercado Pago',
            createdBy: user._id,
            receiptUrl: undefined,
            ticketId: ticket._id
        });
    } catch (error) {
        ticket.status = 'pending';
        ticket.adminNotes = 'Error al acreditar el paquete. El webhook se reintentará.';
        await ticket.save();
        throw error;
    }

    return { ok: true, currencyHint: CURRENCY_BY_COUNTRY[pais] || 'ARS' };
};

const mercadoPagoWebhook = asyncHandler(async (req, res) => {
    const type = req.body?.type || req.body?.topic || req.query.topic || req.query.type;
    const action = req.body?.action || '';
    const gymId = req.query.gymId;

    const normalizedType = String(type || action || '').toLowerCase();
    if (normalizedType && !normalizedType.includes('payment')) {
        return res.sendStatus(200);
    }

    const paymentId = extractPaymentId(req);
    if (!paymentId) {
        return res.sendStatus(200);
    }

    if (!gymId) {
        console.error('Webhook MP sin gymId', { paymentId, query: req.query });
        return res.sendStatus(200);
    }

    try {
        await fulfillMercadoPagoPayment(gymId, paymentId);
        return res.sendStatus(200);
    } catch (error) {
        console.error('Error procesando webhook de Mercado Pago:', error?.response?.data || error.message);
        return res.status(500).json({ message: 'Error procesando webhook' });
    }
});

const createCheckoutPreference = async ({ req, settings, ticket, pkg, cart, amountToPay, user }) => {
    const publicBase = getPublicBaseUrl(req);
    const currency = CURRENCY_BY_COUNTRY[req.gymPais] || 'ARS';

    const resolvedCart = Array.isArray(cart) && cart.length > 0
        ? cart
        : (pkg ? [{ pkg, quantity: 1 }] : []);

    const items = resolvedCart.length > 0
        ? resolvedCart.map(entry => ({
            id: entry.pkg._id.toString(),
            title: entry.pkg.name,
            description: entry.pkg.description || `Paquete ${entry.pkg.name}`,
            quantity: Math.max(1, Number(entry.quantity) || 1),
            unit_price: Number(entry.pkg.price),
            currency_id: currency
        }))
        : [{
            id: 'saldo',
            title: 'Pago de saldo',
            description: 'Abono de saldo',
            quantity: 1,
            unit_price: Number(amountToPay),
            currency_id: currency
        }];

    const body = {
        items,
        payer: {
            name: user.nombre,
            surname: user.apellido,
            email: user.email
        },
        back_urls: {
            success: `${publicBase}/api/mercadopago/return?status=success`,
            failure: `${publicBase}/api/mercadopago/return?status=failure`,
            pending: `${publicBase}/api/mercadopago/return?status=pending`
        },
        auto_return: 'approved',
        notification_url: `${publicBase}/api/mercadopago/webhook?gymId=${encodeURIComponent(req.gymId)}`,
        external_reference: ticket._id.toString(),
        metadata: {
            gymId: req.gymId,
            ticketId: ticket._id.toString(),
            userId: user._id.toString(),
            itemCount: items.length
        },
        statement_descriptor: 'GAIN WELLNESS'
    };

    return withMpClient(settings, (client) => new Preference(client).create({ body }));
};

export {
    linkMercadoPago,
    mercadoPagoCallback,
    getMercadoPagoStatus,
    unlinkMercadoPago,
    mercadoPagoWebhook,
    mercadoPagoReturn,
    createCheckoutPreference,
    getMpSettings
};
