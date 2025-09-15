import mercadopago from 'mercadopago';
import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';


const createPaymentPreference = asyncHandler(async (req, res) => {
    const { itemId, itemType, platform } = req.body;
    const { Settings, Package, TipoClase } = getModels(req.gymDBConnection);
    const userId = req.user._id;

    if (!itemId || !itemType) {
        res.status(400);
        throw new Error('Faltan datos del producto a comprar.');
    }

    // 1. Buscamos el Access Token (esto no cambia)
    const settings = await Settings.findById('main_settings').select('+mercadoPagoAccessToken');
    if (!settings || !settings.mercadoPagoAccessToken) {
        res.status(500);
        throw new Error('El administrador no ha configurado las credenciales de pago.');
    }
    
    // 2. LÓGICA INTELIGENTE: Buscamos el precio en el modelo correcto
    let itemPayload = {};

    if (itemType === 'package') {
        const packageToBuy = await Package.findById(itemId);
        if (!packageToBuy || !packageToBuy.isActive) {
            res.status(404);
            throw new Error('El paquete seleccionado no está disponible.');
        }
        itemPayload = {
            id: packageToBuy._id,
            title: packageToBuy.name,
            price: packageToBuy.price,
            credits: packageToBuy.creditsToReceive
        };
    } else if (itemType === 'tipoClase') {
        const classTypeToBuy = await TipoClase.findById(itemId);
        if (!classTypeToBuy) {
            res.status(404);
            throw new Error('El tipo de turno seleccionado no existe.');
        }
        itemPayload = {
            id: classTypeToBuy._id,
            title: `1 Crédito - ${classTypeToBuy.nombre}`,
            price: classTypeToBuy.price,
            credits: 1 // Al comprar un crédito suelto, se recibe 1
        };
    } else {
        res.status(400);
        throw new Error('Tipo de producto no válido.');
    }

    mercadopago.configure({ access_token: settings.mercadoPagoAccessToken });

    const baseUrl = platform === 'mobile' ? process.env.APP_DEEP_LINK_URL : process.env.WEB_APP_URL;

    // 3. Creamos la preferencia de pago usando el payload que construimos
    const preference = {
        items: [{
            id: itemPayload.id,
            title: itemPayload.title,
            unit_price: Number(itemPayload.price),
            quantity: 1,
            currency_id: 'ARS',
        }],
        payer: { email: req.user.email },
        back_urls: {
            success: `${baseUrl}/payment-success`,
            failure: `${baseUrl}/payment-failure`,
        },
        auto_return: 'approved',
        notification_url: `${process.env.SERVER_URL}/api/payments/webhook?clientId=${req.gymId}`,
        // La referencia externa ahora es más descriptiva
        external_reference: `${userId}_${itemType}_${itemPayload.id}`,
    };

    const response = await mercadopago.preferences.create(preference);
    res.json({ id: response.body.id, checkoutUrl: response.body.init_point });
});


// @desc    Recibir notificaciones de Mercado Pago (Webhook)
// @route   POST /api/payments/webhook
// @access  Public (lo llama Mercado Pago)
const receiveWebhook = asyncHandler(async (req, res) => {
    // Esta función la construiremos en el siguiente paso.
    // Es la que recibe la confirmación del pago y acredita los créditos.
    console.log('Webhook de Mercado Pago recibido:', req.query);
    
    // Aquí irá la lógica para verificar el pago y acreditar los créditos al usuario.

    res.sendStatus(200); // Le decimos a Mercado Pago que recibimos la notificación.
});


export { createPaymentPreference, receiveWebhook };