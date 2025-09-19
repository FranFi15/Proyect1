import asyncHandler from 'express-async-handler';
import { MercadoPagoConfig, OAuth } from 'mercadopago';
import getModels from '../utils/getModels.js';
import connectToGymDB from '../utils/mongoConnectionManager.js';

const generateConnectUrl = asyncHandler(async (req, res) => {
    const { platform } = req.body;
    const redirectUri = `${process.env.SERVER_URL}/api/connect/mercadopago/callback`;
    const state = platform;
    const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${process.env.MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${redirectUri}`;
    res.json({ authUrl });
});

const handleConnectCallback = asyncHandler(async (req, res) => {
    const { code, state } = req.query;
    const [clientId, platform] = state.split('|');

    if (!code || !clientId || !platform) {
        throw new Error('Respuesta inválida de Mercado Pago.');
    }
    
    try {
        // 1. Usamos la función para obtener el objeto de conexión
        const { connection: gymDBConnection } = await connectToGymDB(clientId);
        
        // 2. Ahora sí podemos obtener el modelo Settings
        const { Settings } = getModels(gymDBConnection);

        // 3. El resto de la lógica funciona igual
        const client = new MercadoPagoConfig({ accessToken: process.env.MP_SECRET_KEY, options: { clientId: process.env.MP_APP_ID }});
        const oauth = new OAuth(client);
        
        const response = await oauth.create({
            body: {
                client_secret: process.env.MP_SECRET_KEY,
                client_id: process.env.MP_APP_ID,
                code,
                redirect_uri: `${process.env.SERVER_URL}/api/connect/mercadopago/callback`,
            }
        });

        const { access_token, refresh_token, user_id } = response;

        await Settings.findByIdAndUpdate('main_settings', {
            mpAccessToken: access_token,
            mpRefreshToken: refresh_token,
            mpUserId: user_id,
            mpConnected: true,
        }, { upsert: true, new: true });

        const baseUrl = platform === 'mobile' ? process.env.ADMIN_PANEL_URL_MOBILE : process.env.WEB_APP_URL;
        const finalRedirectUrl = `${baseUrl}/class-type?mp-status=success`;

        res.send(`<!DOCTYPE html><html><head><script>window.location.replace("${finalRedirectUrl}");</script></head></html>`);

    } catch (error) {
        console.error("Error en el callback de Mercado Pago:", error);
        res.status(500).send("Ocurrió un error al procesar la conexión.");
    }
});

export { generateConnectUrl, handleConnectCallback };