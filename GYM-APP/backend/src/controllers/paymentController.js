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
    console.log('Webhook Query:', req.query);
   const paymentInfo = req.body;
    const { Settings, Package, Order, User } = getModels(req.gymDBConnection);
    

    try {
        const signatureHeader = req.get('x-signature');
        const paymentId = paymentInfo.data?.id;
        
        if (!signatureHeader || !paymentId) {
            return res.sendStatus(400);
        }

        const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error('Webhook no configurado.');
            return res.sendStatus(500);
        }

       
        const parts = signatureHeader.split(',').reduce((acc, part) => {
            const [key, value] = part.split('=');
            acc[key.trim()] = value.trim();
            return acc;
        }, {});

        const ts = parts.ts;
        const hash = parts.v1;

        const manifest = `id:${paymentId};request-id:${req.get('x-request-id')};ts:${ts};`;
        
        const hmac = crypto.createHmac('sha256', webhookSecret);
        hmac.update(manifest);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== hash) {
            console.warn('Webhook Signature inválida. Posible intento de fraude.');
            return res.sendStatus(403);
        }
        console.log('Firma del webhook validada correctamente.');

       
        const settings = await Settings.findById('main_settings').select('+mercadoPagoAccessToken');
        const client = new MercadoPagoConfig({ accessToken: settings.mercadoPagoAccessToken });
        const payment = new Payment(client);
        const paymentDetails = await payment.get({ id: paymentId });
            
        if (paymentDetails.status === 'approved' && paymentDetails.external_reference) {
            const order = await Order.findById(paymentDetails.external_reference);

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
                    console.log(`Créditos añadidos a ${user.email} para la orden ${order._id}`);
                }
            }
        }
        
        res.sendStatus(200);

    } catch (error) {
        console.error('Error en Mercado Pago webhook:', error);
        res.sendStatus(500);
    }
});

export { createPaymentPreference, receiveWebhook };