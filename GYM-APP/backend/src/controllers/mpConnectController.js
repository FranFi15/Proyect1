import asyncHandler from 'express-async-handler';
import { MercadoPagoConfig, OAuth } from 'mercadopago';
import getModels from '../utils/getModels.js';

const generateConnectUrl = asyncHandler(async (req, res) => {
    const { platform } = req.body;
    const redirectUri = `${process.env.SERVER_URL}/api/connect/mercadopago/callback`;
    
    const state = `${req.gymId}|${platform}`;
    
    const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${process.env.MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${redirectUri}`;
    res.json({ authUrl });
});

const handleConnectCallback = asyncHandler(async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state) throw new Error('Respuesta inválida de Mercado Pago.');
    
    const [clientId, platform] = state.split('|');
    if (!clientId || !platform) throw new Error('El parámetro de estado tiene un formato inválido.');
    
    const gymDBConnection = await getDbConnectionByClientId(clientId);
    const { Settings } = getModels(gymDBConnection);
    
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_SECRET_KEY, options: { clientId: process.env.MP_APP_ID }});
    const oauth = new OAuth(client);

    const response = await oauth.create({ });
    
    await Settings.findByIdAndUpdate('main_settings', {
        mpAccessToken: response.access_token,
        mpRefreshToken: response.refresh_token,
        mpUserId: response.user_id,
        mpConnected: true,
    }, { upsert: true, new: true });

    const baseUrl = platform === 'mobile' ? process.env.ADMIN_PANEL_URL_MOBILE : process.env.ADMIN_PANEL_URL_WEB;
    const finalRedirectUrl = `${baseUrl}/class-type?mp-status=success`;

    res.send(`<!DOCTYPE html><html><head><script>window.location.replace("${finalRedirectUrl}");</script></head></html>`);
});

export { generateConnectUrl, handleConnectCallback };