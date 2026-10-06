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
    ticketId,
    transactionMeta = {},
    payLater = false,
}) => {
    const { Transaction, CreditLog, Notification, User } = models;
    const actorId = createdBy || user._id;

    const cart = Array.isArray(packages) && packages.length > 0
        ? packages
        : (pkg ? [{ pkg, quantity: 1 }] : []);

    const catalogSubtotal = cart.reduce((sum, entry) => {
        if (!entry?.pkg) return sum;
        const quantity = Math.max(1, Number(entry.quantity) || 1);
        return sum + (Number(entry.pkg.price) || 0) * quantity;
    }, 0);

    const discountAmount = Math.max(0, Number(transactionMeta.discountAmount) || 0);
    const discountedPackageTotal = Math.max(0, catalogSubtotal - discountAmount);
    const freeAmount = Math.max(0, Number(transactionMeta.freeAmount) || 0);
    const availableCredit = Math.max(0, Number(user.balance) || 0);
    const creditApplied = !payLater
        ? Math.max(0, Math.min(Number(transactionMeta.creditApplied) || 0, availableCredit))
        : 0;

    // Cash actually collected at caja. When credit is used, never record the
    // credit portion as an ingreso — only due - credit + optional extra.
    let cashPaid = Math.max(0, Number(amount) || 0);
    if (!payLater && cart.length > 0 && creditApplied > 0) {
        cashPaid = Math.round((discountedPackageTotal - creditApplied + freeAmount) * 100) / 100;
    }
    if (cashPaid < 0) cashPaid = 0;

    if (!payLater && cashPaid > 0) {
        user.balance += cashPaid;

        const paymentOriginal = transactionMeta.originalAmount != null
            ? transactionMeta.originalAmount
            : (creditApplied > 0 || discountAmount > 0
                ? Math.round((cashPaid + creditApplied + discountAmount) * 100) / 100
                : null);

        await Transaction.create({
            user: user._id,
            type: 'payment',
            amount: cashPaid,
            description,
            createdBy: actorId,
            receiptUrl: receiptUrl || undefined,
            method: transactionMeta.method || 'efectivo',
            source: transactionMeta.source || 'pack',
            originalAmount: paymentOriginal,
            discountAmount: discountAmount || 0,
            discountId: transactionMeta.discountId || null,
            paymentRequestId: transactionMeta.paymentRequestId || ticketId || null,
            sucursal: transactionMeta.sucursal || null,
        });
    }

    const benefitMessages = [];
    for (const entry of cart) {
        const itemPkg = entry.pkg;
        const quantity = Math.max(1, Number(entry.quantity) || 1);
        if (!itemPkg) continue;

        const rawLine = Number(itemPkg.price) * quantity;
        const lineTotal = catalogSubtotal > 0 && discountAmount > 0
            ? Math.round((rawLine / catalogSubtotal) * discountedPackageTotal * 100) / 100
            : rawLine;
        user.balance -= lineTotal;

        await Transaction.create({
            user: user._id,
            type: 'charge',
            amount: lineTotal,
            description: quantity > 1
                ? (payLater
                    ? `Deuda por compra: ${itemPkg.name} x${quantity}`
                    : `Cargo por compra: ${itemPkg.name} x${quantity}`)
                : (payLater
                    ? `Deuda por compra de paquete: ${itemPkg.name}`
                    : `Cargo por compra de paquete: ${itemPkg.name}`),
            createdBy: actorId,
            method: payLater
                ? (transactionMeta.method || 'deuda')
                : (cashPaid > 0 ? (transactionMeta.method || 'efectivo') : 'manual'),
            source: transactionMeta.source || 'pack',
            paymentRequestId: transactionMeta.paymentRequestId || ticketId || null,
            sucursal: transactionMeta.sucursal || null,
        });

        const msg = await grantPackageBenefits(user, itemPkg, ticketId, CreditLog, quantity);
        if (msg) benefitMessages.push(msg);
    }

    user.markModified('creditosPorTipo');
    user.markModified('vencimientosDetallados');
    await user.save();

    const names = cart.map(e => e.quantity > 1 ? `${e.pkg.name} x${e.quantity}` : e.pkg?.name).filter(Boolean);
    const benefitMessage = benefitMessages.join(' ');
    const chargedTotal = payLater ? discountedPackageTotal : cashPaid;
    const notifyTitle = payLater
        ? (names.length === 1 ? `Compra a cuenta: ${names[0]}` : 'Compra a cuenta')
        : (names.length === 1
            ? `Compra confirmada: ${names[0]}`
            : names.length > 1
                ? 'Compra confirmada'
                : 'Pago acreditado');
    const creditNote = creditApplied > 0 ? ` Se usaron $${creditApplied.toFixed(2)} de saldo a favor.` : '';
    const notifyMessage = payLater
        ? `Se cargó una deuda de $${chargedTotal}${names.length > 1 ? ` (${names.join(', ')})` : ''}. ${benefitMessage}`.trim()
        : names.length > 0
            ? `Registramos tu pago de $${cashPaid}${names.length > 1 ? ` (${names.join(', ')})` : ''}.${creditNote} ${benefitMessage}`.trim()
            : `Registramos tu pago de $${cashPaid}.${creditNote} Tu saldo fue actualizado.`.trim();
    if (Notification && User) {
        try {
            await sendSingleNotification(
                Notification,
                User,
                user._id,
                notifyTitle,
                notifyMessage,
                payLater ? 'transaction_charge' : 'transaction_payment',
                false
            );
        } catch (error) {
            console.error('No se pudo notificar el pago acreditado:', error.message);
        }
    }

    return { benefitMessage, cashPaid, creditApplied };
};
