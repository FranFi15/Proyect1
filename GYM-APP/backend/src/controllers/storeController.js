import asyncHandler from 'express-async-handler';
import { Expo } from 'expo-server-sdk';
import getModels from '../utils/getModels.js';
import { sendSingleNotification } from './notificationController.js';
import { createCheckoutPreference, getMpSettings } from './mercadopagoController.js';
import {
    generateOrderCode,
    fulfillPaidStoreOrder,
    markStoreOrderDelivered,
} from '../services/storeFulfillment.js';

const expo = new Expo();

const parseStoreCartPayload = (body) => {
    let raw = body.items ?? body.cart;
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch {
            raw = [];
        }
    }
    if (!Array.isArray(raw)) return [];
    return raw
        .map((entry) => ({
            storeItemId: entry.storeItemId || entry.storeItem || entry.id,
            quantity: Math.max(1, Number(entry.quantity) || 1),
            selectedOption: (entry.selectedOption || entry.option || '').toString().trim(),
        }))
        .filter((entry) => !!entry.storeItemId);
};

const loadStoreCart = async (StoreItem, entries) => {
    const cart = [];
    for (const entry of entries) {
        const item = await StoreItem.findById(entry.storeItemId);
        if (!item || !item.isActive) {
            const err = new Error('Uno de los productos no está disponible.');
            err.statusCode = 400;
            throw err;
        }
        const qty = entry.quantity;
        if (Number(item.amount) < qty) {
            const err = new Error(`Stock insuficiente para "${item.name}". Disponible: ${item.amount}.`);
            err.statusCode = 400;
            throw err;
        }
        if (Array.isArray(item.options) && item.options.length > 0) {
            if (!entry.selectedOption || !item.options.includes(entry.selectedOption)) {
                const err = new Error(`Elegí una opción válida para "${item.name}".`);
                err.statusCode = 400;
                throw err;
            }
        }
        cart.push({
            item,
            quantity: qty,
            selectedOption: entry.selectedOption || '',
        });
    }
    return cart;
};

const cartToOrderItems = (cart) =>
    cart.map((entry) => ({
        storeItem: entry.item._id,
        name: entry.item.name,
        price: Number(entry.item.price),
        quantity: entry.quantity,
        selectedOption: entry.selectedOption || '',
    }));

const cartTotal = (cart) =>
    cart.reduce((sum, entry) => sum + Number(entry.item.price) * entry.quantity, 0);

const notifyAdminsNewStoreOrder = async (User, clientUser, amount, orderCode) => {
    try {
        const admins = await User.find({
            roles: 'admin',
            pushToken: { $exists: true, $ne: '' },
        });
        const messages = [];
        for (const admin of admins) {
            if (!Expo.isExpoPushToken(admin.pushToken)) continue;
            messages.push({
                to: admin.pushToken,
                sound: 'default',
                title: 'Nuevo pedido de Tienda',
                body: `${clientUser.nombre} pidió por $${amount} · código ${orderCode}`,
                data: { route: 'Tienda' },
            });
        }
        for (const chunk of expo.chunkPushNotifications(messages)) {
            await expo.sendPushNotificationsAsync(chunk);
        }
    } catch (error) {
        console.error('Error notificando admins de pedido tienda:', error.message);
    }
};

// ---------- Items CRUD ----------

const parseStoreOptions = (options) => {
    if (Array.isArray(options)) {
        return options.map((o) => String(o).trim()).filter(Boolean);
    }
    if (typeof options !== 'string' || !options.trim()) return [];
    try {
        const parsed = JSON.parse(options);
        if (Array.isArray(parsed)) {
            return parsed.map((o) => String(o).trim()).filter(Boolean);
        }
    } catch {
        // newline / comma separated free text
    }
    return options.split(/\n|,/).map((o) => o.trim()).filter(Boolean);
};

const parseStoreIsActive = (value, fallback = true) => {
    if (value == null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    return fallback;
};

const getUploadedImageUrl = (file) =>
    file?.secure_url || file?.path || file?.url || '';

const createStoreItem = asyncHandler(async (req, res) => {
    const { StoreItem } = getModels(req.gymDBConnection);
    const { name, price, amount, options, isActive } = req.body;
    if (!name || price == null || price === '') {
        res.status(400);
        throw new Error('Nombre y precio son obligatorios.');
    }

    const item = await StoreItem.create({
        name: String(name).trim(),
        price: Number(price),
        amount: Math.max(0, Number(amount) || 0),
        options: parseStoreOptions(options),
        imageUrl: getUploadedImageUrl(req.file),
        isActive: parseStoreIsActive(isActive, true),
    });
    res.status(201).json(item);
});

const getStoreItems = asyncHandler(async (req, res) => {
    const { StoreItem } = getModels(req.gymDBConnection);
    const isAdmin = req.user?.roles?.includes('admin');
    const query = isAdmin && req.query.all === '1'
        ? {}
        : { isActive: true, amount: { $gt: 0 } };
    const items = await StoreItem.find(query).sort({ createdAt: -1 });
    res.json(items);
});

const updateStoreItem = asyncHandler(async (req, res) => {
    const { StoreItem } = getModels(req.gymDBConnection);
    const item = await StoreItem.findById(req.params.id);
    if (!item) {
        res.status(404);
        throw new Error('Producto no encontrado.');
    }
    const { name, price, amount, options, isActive, clearImage } = req.body;
    if (name != null) item.name = String(name).trim();
    if (price != null && price !== '') item.price = Number(price);
    if (amount != null && amount !== '') item.amount = Math.max(0, Number(amount) || 0);
    if (options != null) item.options = parseStoreOptions(options);
    if (isActive != null && isActive !== '') item.isActive = parseStoreIsActive(isActive, item.isActive);

    const uploadedUrl = getUploadedImageUrl(req.file);
    if (uploadedUrl) {
        item.imageUrl = uploadedUrl;
    } else if (parseStoreIsActive(clearImage, false)) {
        item.imageUrl = '';
    }

    await item.save();
    res.json(item);
});

const deleteStoreItem = asyncHandler(async (req, res) => {
    const { StoreItem } = getModels(req.gymDBConnection);
    const item = await StoreItem.findById(req.params.id);
    if (!item) {
        res.status(404);
        throw new Error('Producto no encontrado.');
    }
    item.isActive = false;
    await item.save();
    res.json({ message: 'Producto desactivado.' });
});

// ---------- Orders ----------

const submitStoreTransferOrder = asyncHandler(async (req, res) => {
    const { StoreItem, StoreOrder, User } = getModels(req.gymDBConnection);
    const { amountTransferred } = req.body;
    const entries = parseStoreCartPayload(req.body);

    let receiptUrl = null;
    if (req.file) {
        receiptUrl = req.file.secure_url || req.file.path || req.file.url;
    }
    if (!amountTransferred || !receiptUrl) {
        res.status(400);
        throw new Error('El monto y el comprobante son obligatorios.');
    }
    if (entries.length === 0) {
        res.status(400);
        throw new Error('El carrito de tienda está vacío.');
    }

    let cart;
    try {
        cart = await loadStoreCart(StoreItem, entries);
    } catch (error) {
        res.status(error.statusCode || 400);
        throw error;
    }

    const expected = cartTotal(cart);
    const amount = Number(amountTransferred);
    if (Math.abs(amount - expected) > 0.01) {
        res.status(400);
        throw new Error(`El monto no coincide con el carrito ($${expected}).`);
    }

    const orderCode = generateOrderCode();
    const order = await StoreOrder.create({
        user: req.user._id,
        items: cartToOrderItems(cart),
        orderCode,
        amountTransferred: amount,
        receiptUrl,
        status: 'pending',
        method: 'transfer',
    });

    await notifyAdminsNewStoreOrder(User, req.user, amount, orderCode);

    res.status(201).json({
        message: 'Pedido enviado. Esperando confirmación del administrador.',
        order,
    });
});

const createStoreMercadoPagoPreference = asyncHandler(async (req, res) => {
    const { StoreItem, StoreOrder, Settings } = getModels(req.gymDBConnection);
    const entries = parseStoreCartPayload(req.body);
    if (entries.length === 0) {
        res.status(400);
        throw new Error('El carrito de tienda está vacío.');
    }

    const settings = await getMpSettings(Settings);
    if (!settings) {
        res.status(400);
        throw new Error('Este gimnasio todavía no tiene Mercado Pago vinculado.');
    }

    let cart;
    try {
        cart = await loadStoreCart(StoreItem, entries);
    } catch (error) {
        res.status(error.statusCode || 400);
        throw error;
    }

    const amountToPay = cartTotal(cart);
    const orderCode = generateOrderCode();
    const order = await StoreOrder.create({
        user: req.user._id,
        items: cartToOrderItems(cart),
        orderCode,
        amountTransferred: amountToPay,
        receiptUrl: '',
        status: 'pending',
        method: 'mercadopago',
    });

    const preferenceCart = cart.map((entry) => ({
        pkg: {
            _id: entry.item._id,
            name: entry.selectedOption
                ? `${entry.item.name} (${entry.selectedOption})`
                : entry.item.name,
            description: 'Compra tienda',
            price: entry.item.price,
        },
        quantity: entry.quantity,
    }));

    try {
        const preference = await createCheckoutPreference({
            req,
            settings,
            ticket: { _id: `store:${order._id}` },
            cart: preferenceCart,
            amountToPay,
            user: req.user,
        });

        order.mpPreferenceId = preference.id;
        await order.save();

        res.status(201).json({
            orderId: order._id,
            ticketId: order._id,
            preferenceId: preference.id,
            checkoutUrl: preference.init_point || preference.sandbox_init_point || preference.body?.init_point,
            orderCode: order.orderCode,
        });
    } catch (error) {
        order.status = 'rejected';
        order.adminNotes = 'No se pudo crear la preferencia de Mercado Pago.';
        await order.save();
        console.error('Error creando preferencia MP tienda:', error?.cause || error?.message || error);
        res.status(502);
        throw new Error('No se pudo iniciar el pago con Mercado Pago. Intentá de nuevo.');
    }
});

const getMyStoreOrder = asyncHandler(async (req, res) => {
    const { StoreOrder } = getModels(req.gymDBConnection);
    const order = await StoreOrder.findById(req.params.id);
    if (!order || order.user.toString() !== req.user._id.toString()) {
        res.status(404);
        throw new Error('Pedido no encontrado');
    }
    res.json({
        _id: order._id,
        status: order.status,
        method: order.method,
        amountTransferred: order.amountTransferred,
        orderCode: order.orderCode,
        mpStatus: order.mpStatus || null,
        items: order.items || [],
        createdAt: order.createdAt,
    });
});

const listStoreOrders = asyncHandler(async (req, res) => {
    const { StoreOrder } = getModels(req.gymDBConnection);
    const status = req.query.status;
    const query = {};
    if (status && status !== 'all') {
        query.status = status;
    }
    const orders = await StoreOrder.find(query)
        .populate('user', 'nombre apellido email dni')
        .sort({ createdAt: -1 })
        .limit(200);
    res.json(orders);
});

const processStoreOrder = asyncHandler(async (req, res) => {
    const models = getModels(req.gymDBConnection);
    const { StoreOrder, User, Notification } = models;
    const { action, adminNotes } = req.body;
    const order = await StoreOrder.findById(req.params.id);
    if (!order) {
        res.status(404);
        throw new Error('Pedido no encontrado');
    }

    const user = await User.findById(order.user);

    if (action === 'reject') {
        if (order.status !== 'pending') {
            res.status(400);
            throw new Error('Solo se pueden rechazar pedidos pendientes.');
        }
        order.status = 'rejected';
        order.adminNotes = adminNotes || 'Pedido rechazado.';
        order.reviewedBy = req.user._id;
        order.reviewedAt = Date.now();
        await order.save();

        if (user) {
            await sendSingleNotification(
                Notification,
                User,
                user._id,
                'Pedido rechazado',
                `Tu pedido ${order.orderCode} fue rechazado. ${order.adminNotes}`,
                'store_order_rejected',
                true
            );
        }
        return res.json({ message: 'Pedido rechazado.', order });
    }

    if (action === 'approve' || action === 'paid') {
        if (order.status !== 'pending') {
            res.status(400);
            throw new Error('Solo se pueden confirmar pedidos pendientes.');
        }
        await fulfillPaidStoreOrder({
            models,
            order,
            user,
            adminNotes: adminNotes || 'Pago verificado. Listo para retirar.',
            reviewedBy: req.user._id,
        });
        return res.json({ message: 'Pedido confirmado (pagado).', order });
    }

    if (action === 'deliver' || action === 'delivered') {
        if (order.status !== 'paid') {
            res.status(400);
            throw new Error('Solo se pueden entregar pedidos ya pagados/confirmados.');
        }
        await markStoreOrderDelivered({
            models,
            order,
            user,
            adminNotes: adminNotes || 'Entregado en recepción.',
            reviewedBy: req.user._id,
        });
        return res.json({ message: 'Pedido marcado como entregado.', order });
    }

    res.status(400);
    throw new Error('Acción no válida.');
});

export {
    createStoreItem,
    getStoreItems,
    updateStoreItem,
    deleteStoreItem,
    submitStoreTransferOrder,
    createStoreMercadoPagoPreference,
    getMyStoreOrder,
    listStoreOrders,
    processStoreOrder,
};
