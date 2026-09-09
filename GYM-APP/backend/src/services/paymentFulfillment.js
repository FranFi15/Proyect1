import { sendSingleNotification } from '../controllers/notificationController.js';
import { format } from 'date-fns';

const grantPackageBenefits = async (user, pkg, ticketId, CreditLog, quantity = 1) => {
    if (!pkg) return '';
    const qty = Math.max(1, Number(quantity) || 1);

    if (pkg.isPaseLibre) {
        const base = user.paseLibreHasta && user.paseLibreHasta > new Date()
            ? new Date(user.paseLibreHasta)
            : new Date();
        if (!user.paseLibreDesde || !user.paseLibreHasta || user.paseLibreHasta < new Date()) {
            user.paseLibreDesde = new Date();
        }
        const vencimientoPase = new Date(base);
        vencimientoPase.setDate(vencimientoPase.getDate() + ((pkg.durationDays || 30) * qty));
        vencimientoPase.setUTCHours(23, 59, 59, 999);
        user.paseLibreHasta = vencimientoPase;
        return `Tu Pase Libre es válido hasta el ${format(vencimientoPase, 'dd/MM/yyyy')}.`;
    }

    if (pkg.isMembresia) {
        const base = user.membresiaHasta && user.membresiaHasta > new Date()
            ? new Date(user.membresiaHasta)
            : new Date();
        if (!user.membresiaDesde || !user.membresiaHasta || user.membresiaHasta < new Date()) {
            user.membresiaDesde = new Date();
        }
        const vencimientoMembresia = new Date(base);
        vencimientoMembresia.setDate(vencimientoMembresia.getDate() + ((pkg.durationDays || 30) * qty));
        vencimientoMembresia.setUTCHours(23, 59, 59, 999);
        user.membresiaHasta = vencimientoMembresia;
        return `Tu membresía es válida hasta el ${format(vencimientoMembresia, 'dd/MM/yyyy')}.`;
    }

    if (pkg.tipoClase && pkg.creditsAmount > 0) {
        const tipoClaseId = pkg.tipoClase.toString();
        const creditsToAdd = pkg.creditsAmount * qty;
        if (!user.creditosPorTipo || !(user.creditosPorTipo instanceof Map)) {
            user.creditosPorTipo = new Map();
        }
        const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
        const newTotal = currentCredits + creditsToAdd;
        user.creditosPorTipo.set(tipoClaseId, newTotal);

        const fechaVto = new Date();
        fechaVto.setDate(fechaVto.getDate() + 30);

        if (!Array.isArray(user.vencimientosDetallados)) {
            user.vencimientosDetallados = [];
        }
        user.vencimientosDetallados.push({
            tipoClaseId,
            cantidad: creditsToAdd,
            fechaVencimiento: fechaVto,
            idCarga: ticketId?.toString()
        });

        if (CreditLog) {
            try {
                await CreditLog.create({
                    user: user._id,
                    amount: creditsToAdd,
                    tipoClase: tipoClaseId,
                    newBalance: newTotal,
                    reason: 'compra_pack',
                    details: `Compra de paquete: ${pkg.name}${qty > 1 ? ` x${qty}` : ''}`
                });
            } catch (error) {
                console.error('No se pudo guardar el credit log de la compra:', error.message);
            }
        }

        return `Se acreditaron ${creditsToAdd} créditos.`;
    }

    return '';
};

export const resolveTicketCart = (ticket) => {
    if (Array.isArray(ticket.items) && ticket.items.length > 0) {
        return ticket.items
            .filter(item => item.package)
            .map(item => ({
                pkg: item.package,
                quantity: Math.max(1, Number(item.quantity) || 1)
            }));
    }
    if (ticket.package) {
        return [{ pkg: ticket.package, quantity: 1 }];
    }
    return [];
};

export const fulfillApprovedPayment = async ({
    models,
    user,
    pkg,
    packages,
    amount,
    description,
    createdBy,
    receiptUrl,
    ticketId
}) => {
    const { Transaction, CreditLog, Notification, User } = models;
    const actorId = createdBy || user._id;

    const cart = Array.isArray(packages) && packages.length > 0
        ? packages
        : (pkg ? [{ pkg, quantity: 1 }] : []);

    user.balance += amount;

    await Transaction.create({
        user: user._id,
        type: 'payment',
        amount,
        description,
        createdBy: actorId,
        receiptUrl: receiptUrl || undefined
    });

    const benefitMessages = [];
    for (const entry of cart) {
        const itemPkg = entry.pkg;
        const quantity = Math.max(1, Number(entry.quantity) || 1);
        if (!itemPkg) continue;

        const lineTotal = Number(itemPkg.price) * quantity;
        user.balance -= lineTotal;

        await Transaction.create({
            user: user._id,
            type: 'charge',
            amount: lineTotal,
            description: quantity > 1
                ? `Cargo por compra: ${itemPkg.name} x${quantity}`
                : `Cargo por compra de paquete: ${itemPkg.name}`,
            createdBy: actorId
        });

        const msg = await grantPackageBenefits(user, itemPkg, ticketId, CreditLog, quantity);
        if (msg) benefitMessages.push(msg);
    }

    user.markModified('creditosPorTipo');
    user.markModified('vencimientosDetallados');
    await user.save();

    const names = cart.map(e => e.quantity > 1 ? `${e.pkg.name} x${e.quantity}` : e.pkg?.name).filter(Boolean);
    const notifyTitle = names.length === 1
        ? `Compra confirmada: ${names[0]}`
        : names.length > 1
            ? 'Compra confirmada'
            : 'Pago acreditado';
    const benefitMessage = benefitMessages.join(' ');
    const notifyMessage = names.length > 0
        ? `Registramos tu pago de $${amount}${names.length > 1 ? ` (${names.join(', ')})` : ''}. ${benefitMessage}`.trim()
        : `Registramos tu pago de $${amount}. Tu saldo fue actualizado.`;

    if (Notification && User) {
        try {
            await sendSingleNotification(
                Notification,
                User,
                user._id,
                notifyTitle,
                notifyMessage,
                'transaction_payment',
                false
            );
        } catch (error) {
            console.error('No se pudo notificar el pago acreditado:', error.message);
        }
    }

    return { benefitMessage };
};
