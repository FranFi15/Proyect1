import asyncHandler from 'express-async-handler';
import mercadopago from 'mercadopago';
import Client from '../models/Client.js';

// @desc    Generar la URL para que un cliente conecte su cuenta de MP
// @route   GET /api/connect/mercadopago/url
// @access  Private (para el admin del gimnasio logueado en su panel de GYM-APP)
const generateConnectUrl = asyncHandler(async (req, res) => {
    // El clientId lo recibiremos desde el GYM-APP, que lo obtiene del usuario logueado.
    const { clientId } = req.user; 
    const { platform } = req.body; 

    if (!platform) {
        res.status(400);
        throw new Error("Se requiere especificar la plataforma de origen.");
    }
    
     const redirectUri = `${process.env.SERVER_URL}/api/connect/mercadopago/callback`;
    
    // URL de autorización de Mercado Pago
     const state = `${clientId}|${platform}`;
    
    const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${process.env.MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${redirectUri}`;

    res.json({ authUrl });
});

// @desc    Callback que Mercado Pago llama después de la autorización
// @route   GET /api/connect/mercadopago/callback
// @access  Public
const handleConnectCallback = asyncHandler(async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state) {
        throw new Error('Respuesta inválida de Mercado Pago. Faltan el código o el estado.');
    }
    
    // 1. Extraemos el clientId y la plataforma desde el 'state'
    const [clientId, platform] = state.split('|');

    if (!clientId || !platform) {
        throw new Error('El parámetro de estado tiene un formato inválido.');
    }
    
    // 2. Configuramos el cliente del SDK de Mercado Pago con TUS credenciales
    const client = new MercadoPagoConfig({
        accessToken: process.env.MP_SECRET_KEY, // Tu Client Secret actúa como Access Token aquí
        options: {
            clientId: process.env.MP_APP_ID,
        }
    });
    const oauth = new OAuth(client);

    // 3. Intercambiamos el código por los tokens permanentes del gimnasio
    const response = await oauth.create({
        body: {
            client_secret: process.env.MP_SECRET_KEY,
            client_id: process.env.MP_APP_ID,
            code,
            redirect_uri: `${process.env.SERVER_URL}/api/connect/mercadopago/callback`,
        }
    });

    const { access_token, refresh_token, user_id } = response;

    // 4. Guardamos los tokens en la base de datos del cliente (gimnasio)
    await Client.findOneAndUpdate(
        { clientId },
        {
            mpAccessToken: access_token,
            mpRefreshToken: refresh_token,
            mpUserId: user_id,
            mpConnected: true,
        }
    );

    // 5. Redirigimos al admin a la URL correcta según su plataforma
    const baseUrl = platform === 'mobile'
        ? process.env.ADMIN_PANEL_URL_MOBILE
        : process.env.ADMIN_PANEL_URL_WEB;  

    res.redirect(`${baseUrl}/class-type?mp-status=success`);
});

export { generateConnectUrl, handleConnectCallback };