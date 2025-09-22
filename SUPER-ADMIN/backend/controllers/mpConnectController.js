import asyncHandler from 'express-async-handler';
import { MercadoPagoConfig, OAuth } from 'mercadopago';
import Client from '../models/Client.js';
import axios from 'axios';

const generateConnectUrl = asyncHandler(async (req, res) => {
    const { clientId } = req.user; // Viene del middleware 'protect' de SUPER-ADMIN
    const { platform } = req.body;
    const redirectUri = `${process.env.SERVER_URL}/api/connect/mercadopago/callback`;
    const state = `${clientId}|${platform}`;
    
    const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${process.env.MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${redirectUri}`;
    res.json({ authUrl });
});

const handleConnectCallback = asyncHandler(async (req, res) => {
    const { code, state } = req.query;
    const [clientId, platform] = state.split('|');
    if (!code || !clientId || !platform) throw new Error('Respuesta inválida de Mercado Pago.');
    
    const clientOauth = new MercadoPagoConfig({ accessToken: process.env.MP_SECRET_KEY, options: { clientId: process.env.MP_APP_ID }});
    const oauth = new OAuth(clientOauth);

    const response = await oauth.create({
        body: {
            client_secret: process.env.MP_SECRET_KEY,
            client_id: process.env.MP_APP_ID,
            code,
            redirect_uri: `${process.env.SERVER_URL}/api/connect/mercadopago/callback`,
        }
    });

    const { access_token, refresh_token, user_id } = response;

    // Automáticamente configuramos el webhook para el usuario
    const webhookUrl = `${process.env.SERVER_URL}/api/payments/webhook`; // La URL de webhook de nuestro SUPER-ADMIN
    await axios.put(`https://api.mercadopago.com/applications/${process.env.MP_APP_ID}/notification_url`, 
        { notification_url: webhookUrl },
        { headers: { 'Authorization': `Bearer ${access_token}` } }
    );

    await Client.findOneAndUpdate({ clientId }, {
        mpAccessToken: access_token,
        mpRefreshToken: refresh_token,
        mpUserId: user_id,
        mpConnected: true,
        mpWebhookSecret: response.webhook_secret,
    });

    const baseUrl = platform === 'mobile' ? process.env.ADMIN_PANEL_URL_MOBILE : process.env.ADMIN_PANEL_URL_WEB;
    const finalRedirectUrl = `${baseUrl}/class-type?mp-status=success`;

    res.send(`<!DOCTYPE html><html><head><script>window.location.replace("${finalRedirectUrl}");</script></head></html>`);
});

export { generateConnectUrl, handleConnectCallback };