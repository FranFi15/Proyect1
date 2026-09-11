import { sendSingleNotification } from '../controllers/notificationController.js';

export const generateOrderCode = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'T-';
    for (let i = 0; i < 6; i += 1) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
};

/**
 * Mark store order as paid: decrement stock, notify client with pickup code.
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
        item.amount = Math.max(0, Number(item.amount || 0) - qty);
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
