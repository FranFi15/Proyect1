import { sendSingleNotification } from '../controllers/notificationController.js';
import { format } from 'date-fns';

const grantPackageBenefits = async (user, pkg, ticketId, CreditLog) => {
    if (!pkg) return '';

    if (pkg.isPaseLibre) {
        const hoy = new Date();
        user.paseLibreDesde = hoy;
        const vencimientoPase = new Date(hoy);
        vencimientoPase.setDate(hoy.getDate() + (pkg.durationDays || 30));
        vencimientoPase.setUTCHours(23, 59, 59, 999);
        user.paseLibreHasta = vencimientoPase;
        return `Tu Pase Libre es válido hasta el ${format(vencimientoPase, 'dd/MM/yyyy')}.`;
    }

    if (pkg.isMembresia) {
        const hoy = new Date();
        user.membresiaDesde = hoy;
        const vencimientoMembresia = new Date(hoy);
        vencimientoMembresia.setDate(hoy.getDate() + (pkg.durationDays || 30));
        vencimientoMembresia.setUTCHours(23, 59, 59, 999);
        user.membresiaHasta = vencimientoMembresia;
        return `Tu membresía es válida hasta el ${format(vencimientoMembresia, 'dd/MM/yyyy')}.`;
    }

    if (pkg.tipoClase && pkg.creditsAmount > 0) {
        const tipoClaseId = pkg.tipoClase.toString();
        if (!user.creditosPorTipo || !(user.creditosPorTipo instanceof Map)) {
            user.creditosPorTipo = new Map();
        }
        const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
        const newTotal = currentCredits + pkg.creditsAmount;
        user.creditosPorTipo.set(tipoClaseId, newTotal);

        const fechaVto = new Date();
        fechaVto.setDate(fechaVto.getDate() + 30);

        if (!Array.isArray(user.vencimientosDetallados)) {
            user.vencimientosDetallados = [];
        }
        user.vencimientosDetallados.push({
            tipoClaseId,
            cantidad: pkg.creditsAmount,
            fechaVencimiento: fechaVto,
            idCarga: ticketId?.toString()
        });

        if (CreditLog) {
            try {
                await CreditLog.create({
                    user: user._id,
                    amount: pkg.creditsAmount,
                    tipoClase: tipoClaseId,
                    newBalance: newTotal,
                    reason: 'compra_pack',
                    details: `Compra de paquete: ${pkg.name}`
                });
            } catch (error) {
                console.error('No se pudo guardar el credit log de la compra:', error.message);
            }
        }

        return `Se acreditaron ${pkg.creditsAmount} créditos.`;
    }

    return '';
};

export const fulfillApprovedPayment = async ({
    models,
    user,
    pkg,
    amount,
    description,
    createdBy,
    receiptUrl,
    ticketId
}) => {
    const { Transaction, CreditLog, Notification, User } = models;
    const actorId = createdBy || user._id;

    user.balance += amount;

    await Transaction.create({
        user: user._id,
        type: 'payment',
        amount,
        description,
        createdBy: actorId,
        receiptUrl: receiptUrl || undefined
    });

    let benefitMessage = '';
    if (pkg) {
        user.balance -= pkg.price;

        await Transaction.create({
            user: user._id,
            type: 'charge',
            amount: pkg.price,
            description: `Cargo por compra de paquete: ${pkg.name}`,
            createdBy: actorId
        });

        benefitMessage = await grantPackageBenefits(user, pkg, ticketId, CreditLog);
    }

    user.markModified('creditosPorTipo');
    user.markModified('vencimientosDetallados');
    await user.save();

    const notifyTitle = pkg ? `Compra confirmada: ${pkg.name}` : 'Pago acreditado';
    const notifyMessage = pkg
        ? `Registramos tu pago de $${amount}. ${benefitMessage}`.trim()
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
