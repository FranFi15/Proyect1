import { sendSingleNotification } from '../controllers/notificationController.js';

export const generateOrderCode = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'T-';
    for (let i = 0; i < 6; i += 1) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
};

const normalizeOptionRows = (rawOptions) => {
    if (!Array.isArray(rawOptions)) return [];
    return rawOptions
        .map((entry) => {
            if (typeof entry === 'string') {
                const name = entry.trim();
                return name ? { name, amount: 0 } : null;
            }
            if (!entry || typeof entry !== 'object') return null;
            const name = String(entry.name || '').trim();
            if (!name) return null;
            return {
                name,
                amount: Math.max(0, Number(entry.amount) || 0),
            };
        })
        .filter(Boolean);
};

/**
 * Mark store order as paid: decrement option stock, notify client with pickup code.
 * Caller must ensure order is currently pending (or already transitioning).
 */
export const fulfillPaidStoreOrder = async ({
    models,
    order,
    user,
    adminNotes,
    reviewedBy,
}) => {
    const { StoreItem, Notification, User } = models;

    for (const line of order.items || []) {
        const item = await StoreItem.findById(line.storeItem);
        if (!item) continue;
        const qty = Math.max(1, Number(line.quantity) || 1);
        const options = normalizeOptionRows(item.options);

        if (options.length > 0 && line.selectedOption) {
            const idx = options.findIndex((o) => o.name === line.selectedOption);
            if (idx >= 0) {
                options[idx].amount = Math.max(0, Number(options[idx].amount || 0) - qty);
            }
            item.options = options;
            item.amount = options.reduce((sum, o) => sum + Number(o.amount || 0), 0);
        } else {
            item.amount = Math.max(0, Number(item.amount || 0) - qty);
        }
        await item.save();
    }

    order.status = 'paid';
    if (adminNotes != null) order.adminNotes = adminNotes;
    if (reviewedBy) order.reviewedBy = reviewedBy;
    order.reviewedAt = Date.now();
    if (!order.orderCode) order.orderCode = generateOrderCode();
    await order.save();

    const itemNames = (order.items || [])
        .map((l) => {
            const base = l.quantity > 1 ? `${l.name} x${l.quantity}` : l.name;
            return l.selectedOption ? `${base} (${l.selectedOption})` : base;
        })
        .join(', ');

    if (Notification && User && user?._id) {
        try {
            await sendSingleNotification(
                Notification,
                User,
                user._id,
                'Pedido confirmado',
                `Tu pedido de tienda fue confirmado. Código: ${order.orderCode}. Productos: ${itemNames || 'Tienda'}. Mostralo en recepción para retirarlo.`,
                'store_order_paid',
                true
            );
        } catch (error) {
            console.error('No se pudo notificar pedido de tienda:', error.message);
        }
    }

    return order;
};

export const markStoreOrderDelivered = async ({
    models,
    order,
    user,
    adminNotes,
    reviewedBy,
}) => {
    const { Notification, User } = models;
    order.status = 'delivered';
    order.deliveredAt = Date.now();
    if (adminNotes != null) order.adminNotes = adminNotes;
    if (reviewedBy) order.reviewedBy = reviewedBy;
    order.reviewedAt = order.reviewedAt || Date.now();
    await order.save();

    if (Notification && User && user?._id) {
        try {
            await sendSingleNotification(
                Notification,
                User,
                user._id,
                'Pedido entregado',
                `Tu pedido ${order.orderCode} fue marcado como entregado. ¡Gracias!`,
                'store_order_delivered',
                false
            );
        } catch (error) {
            console.error('No se pudo notificar entrega de tienda:', error.message);
        }
    }

    return order;
};
