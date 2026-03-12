import asyncHandler from 'express-async-handler';
import axios from 'axios';
import getModels from '../utils/getModels.js';
import connectToGymDB from '../config/mongoConnectionManager.js'; // Ajusta la ruta a tu manager de DB

// Variables de entorno que deberás configurar en tu servidor
const MP_APP_ID = process.env.MP_APP_ID;
const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET;
const MP_REDIRECT_URI = process.env.MP_REDIRECT_URI; 

// @desc    1. Iniciar el flujo de vinculación (Redirige a MP)
// @route   GET /api/mercadopago/auth
// @access  Private/Admin (Requiere token del admin y el middleware que inyecta req.gymId)
const linkMercadoPago = asyncHandler(async (req, res) => {
    const gymId = req.gymId; // El ID del tenant actual (ej: "fitclub")

    if (!MP_APP_ID || !MP_REDIRECT_URI) {
        res.status(500);
        throw new Error('Credenciales de la aplicación SaaS de Mercado Pago no configuradas en el servidor.');
    }

    // Usamos el parámetro "state" para enviar el ID del gimnasio. 
    // Así, cuando MP nos responda, sabremos a qué gimnasio pertenece este token.
    const authUrl = `https://auth.mercadopago.com/authorization?client_id=${MP_APP_ID}&response_type=code&platform_id=mp&state=${gymId}&redirect_uri=${MP_REDIRECT_URI}`;

    // Devolvemos la URL para que el frontend (app móvil/web) abra el navegador en esta dirección
    res.json({ url: authUrl });
});

// @desc    2. Callback que recibe Mercado Pago (Guarda los tokens)
// @route   GET /api/mercadopago/callback
// @access  Public (Lo llama Mercado Pago directamente)
const mercadoPagoCallback = asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;

    // Si el usuario canceló o hubo error
    if (error) {
        console.error("Error en la vinculación de MP:", error);
        return res.redirect(`${process.env.WEB_APP_URL}/admin/integrations?error=mp_auth_failed`);
    }

    if (!code || !state) {
        return res.status(400).send('Faltan parámetros requeridos de Mercado Pago.');
    }

    const gymId = state; // Recuperamos el ID del gimnasio que enviamos en el paso 1

    try {
        // 1. Intercambiar el "code" por el "access_token" real
        const tokenResponse = await axios.post('https://api.mercadopago.com/oauth/token', {
            client_secret: MP_CLIENT_SECRET,
            client_id: MP_APP_ID,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: MP_REDIRECT_URI
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
        });

        const { access_token, refresh_token, public_key, user_id } = tokenResponse.data;

        // 2. Conectarnos a la base de datos específica de este gimnasio
        const { connection } = await connectToGymDB(gymId);
        if (!connection) throw new Error('No se pudo conectar a la base de datos del cliente.');

        const { Settings } = getModels(connection);

        // 3. Buscar las configuraciones o crearlas si no existen
        let settings = await Settings.findById('main_settings');
        if (!settings) {
            settings = new Settings({ _id: 'main_settings' });
        }

        // 4. Guardar los datos de Mercado Pago
        settings.mercadoPago = {
            isLinked: true,
            accessToken: access_token,
            refreshToken: refresh_token,
            publicKey: public_key,
            userId: user_id,
            linkedAt: new Date()
        };

        await settings.save();

        // 5. Redirigir al administrador de vuelta a la app/web con mensaje de éxito
        // (Ajusta la URL según cómo manejes las rutas en tu frontend)
        const redirectUrl = `${process.env.WEB_APP_URL}/admin/integrations?success=mp_linked`;
        res.redirect(302, redirectUrl);

    } catch (error) {
        console.error("Error obteniendo el token de MP:", error?.response?.data || error.message);
        const redirectUrl = `${process.env.WEB_APP_URL}/admin/integrations?error=token_exchange_failed`;
        res.redirect(302, redirectUrl);
    }
});

// @desc    3. Obtener el estado de la vinculación (Para la UI del admin)
// @route   GET /api/mercadopago/status
// @access  Private/Admin
const getMercadoPagoStatus = asyncHandler(async (req, res) => {
    const { Settings } = getModels(req.gymDBConnection);
    const settings = await Settings.findById('main_settings');

    if (settings && settings.mercadoPago && settings.mercadoPago.isLinked) {
        res.json({
            isLinked: true,
            linkedAt: settings.mercadoPago.linkedAt,
            publicKey: settings.mercadoPago.publicKey // Segura para enviar al frontend
        });
    } else {
        res.json({ isLinked: false });
    }
});

// @desc    4. Desvincular Mercado Pago
// @route   DELETE /api/mercadopago/unlink
// @access  Private/Admin
const unlinkMercadoPago = asyncHandler(async (req, res) => {
    const { Settings } = getModels(req.gymDBConnection);
    const settings = await Settings.findById('main_settings');

    if (settings && settings.mercadoPago) {
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

    res.json({ message: "Cuenta de Mercado Pago desvinculada exitosamente." });
});

export {
    linkMercadoPago,
    mercadoPagoCallback,
    getMercadoPagoStatus,
    unlinkMercadoPago
};