import mercadopago from 'mercadopago';
import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';


const createPaymentPreference = asyncHandler(async (req, res) => {
    const { Settings, Package, TipoClase, Order } = getModels(req.gymDBConnection);
    const { cartItems, platform } = req.body;
    const userId = req.user._id;

    if (!cartItems || cartItems.length === 0) {
        res.status(400);
        throw new Error('El carrito está vacío.');
    }

    // 1. Buscamos el Access Token (esto no cambia)
    const settings = await Settings.findById('main_settings').select('+mercadoPagoAccessToken');
    if (!settings || !settings.mercadoPagoAccessToken) {
        res.status(500);
        throw new Error('La institución no ha configurado el pago por Mercado Pago.');
    }
    
    // 2. LÓGICA INTELIGENTE: Buscamos el precio en el modelo correcto
    let totalAmount = 0;
    const orderItems = [];

    // 2. Verificamos los precios en el servidor (¡Paso de seguridad clave!)
    for (const item of cartItems) {
        if (item.itemType === 'package') {
            const packageData = await Package.findById(item.itemId);
            if (!packageData || !packageData.isActive) throw new Error(`El paquete "${item.name}" ya no está disponible.`);
            totalAmount += packageData.price * item.quantity;
            orderItems.push({ ...item, name: packageData.name, unitPrice: packageData.price });
        } else if (item.itemType === 'tipoClase') {
            const classTypeData = await TipoClase.findById(item.itemId);
            if (!classTypeData) throw new Error(`El crédito para "${item.name}" ya no está disponible.`);
            totalAmount += classTypeData.price * item.quantity;
            orderItems.push({ ...item, name: classTypeData.name, unitPrice: classTypeData.price });
        }
    }

    // 3. Creamos la orden en nuestra base de datos con estado "pendiente"
    const order = await Order.create({
        user: userId,
        items: orderItems,
        totalAmount: totalAmount,
        status: 'pending',
    });

    mercadopago.configure({ access_token: settings.mercadoPagoAccessToken });
    const baseUrl = platform === 'mobile' ? process.env.APP_DEEP_LINK_URL : process.env.WEB_APP_URL;

    const preference = {
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
        },
        auto_return: 'approved',
        notification_url: `${process.env.SERVER_URL}/api/payments/webhook?clientId=${req.gymId}`,
        // 4. Usamos el ID de nuestra orden como referencia externa
        external_reference: order._id.toString(),
    };

    const response = await mercadopago.preferences.create(preference);
    res.json({ id: response.body.id, checkoutUrl: response.body.init_point });
});



const receiveWebhook = asyncHandler(async (req, res) => {
    // El 'clientId' lo pasamos en la URL de notificación para saber a qué DB conectarnos
    const { clientId } = req.query; 
    const { User, Package, TipoClase, Order } = getModels(req.gymDBConnection);

    // La información del pago viene en el 'query' de la notificación de MP
    const paymentInfo = req.query;

    console.log('Webhook recibido para clientId:', clientId, 'Datos:', paymentInfo);

    try {
        if (paymentInfo.type === 'payment') {
            // Con el ID del pago, le pedimos a Mercado Pago todos los detalles
            const payment = await mercadopago.payment.findById(paymentInfo['data.id']);
            const paymentDetails = payment.body;
            
            // 1. Verificamos que el pago esté APROBADO
            if (paymentDetails.status === 'approved') {
                const orderId = paymentDetails.external_reference;
                
                // 2. Buscamos nuestra orden 'pendiente' en la base de datos
                const order = await Order.findById(orderId);

                if (order && order.status === 'pending') {
                    // 3. (Seguridad) Verificamos que el monto pagado coincida con nuestra orden
                    const paidAmount = paymentDetails.transaction_amount;
                    if (Number(paidAmount) !== Number(order.totalAmount)) {
                        console.error(`Alerta de seguridad: El monto pagado (${paidAmount}) no coincide con el total de la orden (${order.totalAmount}). Order ID: ${orderId}`);
                        order.status = 'failed';
                        await order.save();
                        return res.sendStatus(200); 
                    }

                    // 4. Actualizamos la orden a 'completada'
                    order.status = 'completed';
                    order.paymentId = paymentDetails.id;
                    await order.save();

                    // 5. ¡ACREDITAMOS LOS CRÉDITOS AL USUARIO!
                    const user = await User.findById(order.user);
                    if (user) {
                        for (const item of order.items) {
                            if (item.itemType === 'package') {
                                const pkg = await Package.findById(item.itemId);
                                if (pkg) {
                                    const tipoClaseId = pkg.tipoClase.toString();
                                    const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
                                    user.creditosPorTipo.set(tipoClaseId, currentCredits + item.quantity * pkg.creditsToReceive);
                                }
                            } else if (item.itemType === 'tipoClase') {
                                const tipoClaseId = item.itemId.toString();
                                const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
                                user.creditosPorTipo.set(tipoClaseId, currentCredits + item.quantity);
                            }
                        }
                        user.markModified('creditosPorTipo'); 
                        await user.save();
                        console.log(`Créditos acreditados al usuario ${user.email} por la orden ${orderId}`);
                    }
                }
            }
        }
        // Le decimos a Mercado Pago que recibimos la notificación correctamente
        res.sendStatus(200);

    } catch (error) {
        console.error('Error en el webhook de Mercado Pago:', error);
        res.sendStatus(500); // Si algo falla, enviamos un error para que MP reintente
    }
});


export { createPaymentPreference, receiveWebhook };