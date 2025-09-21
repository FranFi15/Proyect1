import { MercadoPagoConfig, Preference, Payment,  } from 'mercadopago'; 
import crypto from 'crypto';
import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';


const createPaymentPreference = asyncHandler(async (req, res) => {
    const { Settings, Package, TipoClase, Order, User } = getModels(req.gymDBConnection); 
    const { cartItems, platform } = req.body;
    const userId = req.user._id;

    if (!cartItems || cartItems.length === 0) {
        res.status(400);
        throw new Error('El carrito está vacío.');
    }

     const settings = await Settings.findById('main_settings').select('+mpAccessToken');
    if (!settings || !settings.mpAccessToken) {
        res.status(500);
        throw new Error('El administrador no ha configurado las credenciales de pago.');
    }
    

    let totalAmount = 0;
    const orderItems = [];

    for (const item of cartItems) {
        let orderItemData;
        if (item.itemType === 'package') {
            const packageData = await Package.findById(item.itemId);
            if (!packageData || !packageData.isActive) throw new Error(`El paquete ya no está disponible.`);
            orderItemData = {
                itemType: 'package',
                itemId: item.itemId,
                name: packageData.name,
                quantity: item.quantity,
                unitPrice: packageData.price, 
            };
        } else if (item.itemType === 'tipoClase') {
            const classTypeData = await TipoClase.findById(item.itemId);
            if (!classTypeData) throw new Error(`El tipo de crédito ya no está disponible.`);
            orderItemData = {
                itemType: 'tipoClase',
                itemId: item.itemId,
                name: classTypeData.nombre, 
                quantity: item.quantity,
                unitPrice: classTypeData.price, 
            };
        } else {
            continue; 
        }
        totalAmount += orderItemData.unitPrice * orderItemData.quantity;
        orderItems.push(orderItemData);
    }

    if(orderItems.length === 0) {
        throw new Error('No se encontraron productos válidos en el carrito.');
    }
    
    const order = await Order.create({
        user: userId,
        items: orderItems,
        totalAmount: totalAmount,
        status: 'pending',
    });

    // 1. Creamos el cliente de configuración
    const client = new MercadoPagoConfig({ accessToken: settings.mpAccessToken });
    // 2. Creamos una instancia de Preference
    const preference = new Preference(client);

    const baseUrl = platform === 'mobile' ? process.env.APP_DEEP_LINK_URL : process.env.WEB_APP_URL;

    // 3. Creamos la preferencia usando el método .create()
   const preferenceBody = {
        items: orderItems.map(item => ({
            id: item.itemId,
            title: item.name,
            unit_price: Number(item.unitPrice),
            quantity: Number(item.quantity),
            currency_id: 'ARS',
        })),
        payer: { email: req.user.email },
        back_urls: {
            success: `${baseUrl}/payment-success`,
            failure: `${baseUrl}/payment-failure`, 
            pending: `${baseUrl}/payment-pending`, 
        },
        auto_return: 'approved',
       notification_url: `${process.env.SERVER_URL}/api/payments/webhook`, 
        external_reference: `${order._id.toString()}|${req.gymId}`,
    };
    
    console.log("Creando preferencia con el siguiente cuerpo:", JSON.stringify(preferenceBody, null, 2));

    const response = await preference.create({ body: preferenceBody });
    res.json({ id: response.id, checkoutUrl: response.init_point });
});



const receiveWebhook = asyncHandler(async (req, res) => {
    console.log('--- INICIO WEBHOOK ---');
    const paymentInfo = req.body;
    const paymentId = paymentInfo.data?.id;

    if (paymentInfo.type !== 'payment' || !paymentId) {
        // Not a payment notification we are interested in, so we respond OK.
        return res.sendStatus(200);
    }

    try {
        // Since we don't know which gym this is for yet, we can't get the
        // specific access token. For this preliminary step, we must use a
        // general platform token to get the payment details.
        const preliminaryClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
        const preliminaryPayment = new Payment(preliminaryClient);
        const paymentDetails = await preliminaryPayment.get({ id: paymentId });
        
        if (!paymentDetails.external_reference) {
            throw new Error('La referencia externa no fue encontrada en el pago.');
        }

        // Extract the orderId and clientId from the external_reference
        const [orderId, clientId] = paymentDetails.external_reference.split('|');

        if (!orderId || !clientId) {
            throw new Error('La referencia externa tiene un formato inválido.');
        }

        // Now, connect to the correct gym's database
        const gymDBConnection = await getDbConnectionByClientId(clientId);
        const { Settings, User, Order, Package } = getModels(gymDBConnection);

        const settings = await Settings.findById('main_settings').select('+mpWebhookSecret +mpAccessToken');
        const webhookSecret = settings?.mpWebhookSecret;
        
        if (!webhookSecret) {
            console.error(`Webhook secret not configured for clientId: ${clientId}`);
            return res.sendStatus(500);
        }

        // Validate the signature using the gym's specific secret
        const signatureHeader = req.get('x-signature');
        const parts = signatureHeader.split(',').reduce((acc, part) => {
            const [key, value] = part.split('=');
            acc[key.trim()] = value.trim();
            return acc;
        }, {});

        const manifest = `data-id:${paymentId};ts:${parts.ts};`;
        const hmac = crypto.createHmac('sha256', webhookSecret);
        hmac.update(manifest);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== parts.v1) {
            console.warn('Firma de Webhook inválida. Posible intento de fraude.');
            return res.sendStatus(403); 
        }
        
        // If the signature is valid, proceed with the payment details we already have
        if (paymentDetails.status === 'approved') {
            const order = await Order.findById(orderId);

            if (order && order.status === 'pending') {
                order.status = 'completed';
                order.paymentId = paymentDetails.id;
                await order.save();

                const user = await User.findById(order.user);
                if (user) {
                    for (const item of order.items) {
                        let tipoClaseId;
                        let creditsToAdd = 0;

                        if (item.itemType === 'package') {
                            const pkg = await Package.findById(item.itemId);
                            if (pkg) {
                                tipoClaseId = pkg.tipoClase.toString();
                                creditsToAdd = item.quantity * pkg.creditsToReceive;
                            }
                        } else if (item.itemType === 'tipoClase') {
                            tipoClaseId = item.itemId.toString();
                            creditsToAdd = item.quantity;
                        }

                        if (tipoClaseId && creditsToAdd > 0) {
                            const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
                            user.creditosPorTipo.set(tipoClaseId, currentCredits + creditsToAdd);
                        }
                    }
                    user.markModified('creditosPorTipo');
                    await user.save();
                    console.log(`¡ÉXITO! Créditos acreditados para la orden ${orderId}`);
                }
            }
        }
        
        res.sendStatus(200);

    } catch (error) {
        console.error('Error en el webhook de Mercado Pago:', error);
        res.sendStatus(500); // Respond with an error to have MP retry the notification
    }
});

export { createPaymentPreference, receiveWebhook };