import asyncHandler from 'express-async-handler';
import { PreApproval } from 'mercadopago';
import getModels from '../utils/getModels.js';
import connectToGymDB from '../config/mongoConnectionManager.js';
import { fulfillApprovedPayment } from '../services/paymentFulfillment.js';
import { resolveUserDiscount, computeDiscountAmount } from '../services/pricing.js';
import {
    getMpSettings,
    getPublicBaseUrl,
    withMpClient,
    CURRENCY_BY_COUNTRY,
} from './mercadopagoController.js';

const packageKind = (pkg) => {
    if (pkg?.isPaseLibre) return 'pase';
    if (pkg?.isMembresia) return 'membresia';
    return 'creditos';
};

const buildAutoRecurring = (pkg, amount, currency) => {
    // Credits: always monthly. Membresía / pase: follow durationDays.
    if (!pkg.isPaseLibre && !pkg.isMembresia) {
        return {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: Number(amount),
            currency_id: currency,
        };
    }
    const days = Math.max(1, Number(pkg.durationDays) || 30);
    if (days >= 28 && days <= 31) {
        return {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: Number(amount),
            currency_id: currency,
        };
    }
    return {
        frequency: days,
        frequency_type: 'days',
        transaction_amount: Number(amount),
        currency_id: currency,
    };
};

const mapMpStatus = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'authorized') return 'authorized';
    if (s === 'paused') return 'paused';
    if (s === 'cancelled' || s === 'canceled') return 'cancelled';
    return 'pending';
};

const externalRefFor = (subscriptionId) => `mpsub:${subscriptionId}`;

const parseSubscriptionIdFromRef = (ref) => {
    const value = String(ref || '');
    if (!value.startsWith('mpsub:')) return null;
    return value.slice('mpsub:'.length) || null;
};

/**
 * Create a Mercado Pago preapproval (subscription) for one package.
 * Client must authorize the card via init_point.
 */
const createMpSubscription = asyncHandler(async (req, res) => {
    const { PaymentPackage, Settings, User, Discount, MpSubscription } = getModels(req.gymDBConnection);
    const packageId = req.body.packageId || req.body.package;
    if (!packageId) {
        res.status(400);
        throw new Error('Seleccioná un paquete para el débito automático.');
    }

    const settings = await getMpSettings(Settings);
    if (!settings) {
        res.status(400);
        throw new Error('Este gimnasio todavía no tiene Mercado Pago vinculado.');
    }

    const pkg = await PaymentPackage.findById(packageId).populate('tipoClase', 'nombre');
    if (!pkg || pkg.isActive === false) {
        res.status(404);
        throw new Error('Paquete no encontrado o inactivo.');
    }

    const kind = packageKind(pkg);
    if (kind === 'creditos' && (!pkg.tipoClase || !(pkg.creditsAmount > 0))) {
        res.status(400);
        throw new Error('El paquete de créditos no es válido para suscripción.');
    }

    const user = await User.findById(req.user._id);
    if (!user?.email) {
        res.status(400);
        throw new Error('Tu cuenta necesita un email para suscribirse con Mercado Pago.');
    }

    const existing = await MpSubscription.findOne({
        user: user._id,
        package: pkg._id,
        status: { $in: ['pending', 'authorized', 'paused'] },
    });
    if (existing) {
        res.status(400);
        throw new Error('Ya tenés una suscripción activa o pendiente para este plan. Cancelala antes de crear otra.');
    }

    const catalogPrice = Number(pkg.price) || 0;
    const discount = await resolveUserDiscount(Discount, user);
    const discountAmount = computeDiscountAmount(catalogPrice, { discount });
    const amountToCharge = Math.max(0, Math.round((catalogPrice - discountAmount) * 100) / 100);
    if (!(amountToCharge > 0)) {
        res.status(400);
        throw new Error('El monto de la suscripción no es válido.');
    }

    const currency = CURRENCY_BY_COUNTRY[req.gymPais] || 'ARS';
    const autoRecurring = buildAutoRecurring(pkg, amountToCharge, currency);
    const kindLabel = kind === 'pase' ? 'Pase libre' : kind === 'membresia' ? 'Membresía' : 'Créditos';
    const reason = `Débito automático · ${kindLabel}: ${pkg.name}`;

    // Placeholder doc so we can set a stable external_reference before calling MP.
    const draft = await MpSubscription.create({
        user: user._id,
        package: pkg._id,
        kind,
        preapprovalId: `pending_${Date.now()}_${user._id}`,
        status: 'pending',
        amount: amountToCharge,
        currency,
        frequency: autoRecurring.frequency,
        frequencyType: autoRecurring.frequency_type,
        reason,
        discountId: discount?._id || null,
        discountAmount,
        originalAmount: catalogPrice,
    });

    const publicBase = getPublicBaseUrl(req);
    const backUrl = `${publicBase}/api/mercadopago/return?status=success&flow=subscription`;

    try {
        const body = {
            reason,
            external_reference: externalRefFor(draft._id),
            payer_email: user.email,
            back_url: backUrl,
            auto_recurring: autoRecurring,
            status: 'pending',
            notification_url: `${publicBase}/api/mercadopago/webhook?gymId=${encodeURIComponent(req.gymId)}`,
        };

        const preapproval = await withMpClient(settings, (client) =>
            new PreApproval(client).create({ body })
        );

        draft.preapprovalId = preapproval.id;
        draft.initPoint = preapproval.init_point || null;
        draft.status = mapMpStatus(preapproval.status);
        draft.nextPaymentDate = preapproval.next_payment_date
            ? new Date(preapproval.next_payment_date)
            : null;
        await draft.save();

        res.status(201).json({
            subscriptionId: draft._id,
            preapprovalId: draft.preapprovalId,
            checkoutUrl: draft.initPoint,
            status: draft.status,
            amount: draft.amount,
            currency: draft.currency,
            frequency: draft.frequency,
            frequencyType: draft.frequencyType,
            package: {
                _id: pkg._id,
                name: pkg.name,
                kind,
            },
        });
    } catch (error) {
        await MpSubscription.deleteOne({ _id: draft._id });
        console.error('Error creando suscripción MP:', error?.cause || error?.message || error);
        res.status(502);
        throw new Error('No se pudo iniciar el débito automático con Mercado Pago. Intentá de nuevo.');
    }
});

const listMyMpSubscriptions = asyncHandler(async (req, res) => {
    const { MpSubscription } = getModels(req.gymDBConnection);
    const items = await MpSubscription.find({ user: req.user._id })
        .populate('package', 'name price isPaseLibre isMembresia creditsAmount durationDays tipoClase')
        .sort({ createdAt: -1 });
    res.json(items);
});

const listMpSubscriptionsAdmin = asyncHandler(async (req, res) => {
    const { MpSubscription } = getModels(req.gymDBConnection);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.userId) filter.user = req.query.userId;
    const items = await MpSubscription.find(filter)
        .populate('user', 'nombre apellido email dni')
        .populate('package', 'name price isPaseLibre isMembresia creditsAmount durationDays')
        .sort({ createdAt: -1 })
        .limit(Math.min(200, Number(req.query.limit) || 100));
    res.json(items);
});

const updateMpSubscription = asyncHandler(async (req, res) => {
    const { MpSubscription, Settings } = getModels(req.gymDBConnection);
    const sub = await MpSubscription.findById(req.params.id);
    if (!sub) {
        res.status(404);
        throw new Error('Suscripción no encontrada.');
    }

    const isOwner = String(sub.user) === String(req.user._id);
    const isAdmin = Array.isArray(req.user.roles) && req.user.roles.includes('admin');
    if (!isOwner && !isAdmin) {
        res.status(403);
        throw new Error('No tenés permiso para modificar esta suscripción.');
    }

    const settings = await getMpSettings(Settings);
    if (!settings) {
        res.status(400);
        throw new Error('Mercado Pago no está vinculado.');
    }

    const { amount, status } = req.body;
    const body = {};

    if (amount != null) {
        if (!isAdmin) {
            res.status(403);
            throw new Error('Solo un admin puede cambiar el monto.');
        }
        const numeric = Number(amount);
        if (Number.isNaN(numeric) || numeric <= 0) {
            res.status(400);
            throw new Error('Monto inválido.');
        }
        body.auto_recurring = {
            transaction_amount: numeric,
            currency_id: sub.currency || 'ARS',
        };
    }

    if (status != null) {
        const next = String(status).toLowerCase();
        if (!['paused', 'cancelled', 'canceled', 'authorized'].includes(next)) {
            res.status(400);
            throw new Error('Estado inválido. Usá paused, cancelled o authorized.');
        }
        // Clients may only cancel/pause their own.
        if (!isAdmin && next === 'authorized') {
            res.status(403);
            throw new Error('No podés reactivar la suscripción desde la app. Pedile al gimnasio.');
        }
        body.status = next === 'canceled' ? 'cancelled' : next;
    }

    if (Object.keys(body).length === 0) {
        res.status(400);
        throw new Error('Nada para actualizar.');
    }

    try {
        const updated = await withMpClient(settings, (client) =>
            new PreApproval(client).update({ id: sub.preapprovalId, body })
        );

        if (amount != null) {
            sub.amount = Number(amount);
            sub.originalAmount = Number(amount);
            sub.discountAmount = 0;
        }
        if (updated.status) sub.status = mapMpStatus(updated.status);
        if (updated.next_payment_date) sub.nextPaymentDate = new Date(updated.next_payment_date);
        if (mapMpStatus(updated.status) === 'cancelled') {
            sub.cancelledAt = new Date();
            sub.cancelledBy = req.user._id;
        }
        await sub.save();

        const populated = await MpSubscription.findById(sub._id)
            .populate('user', 'nombre apellido email')
            .populate('package', 'name price isPaseLibre isMembresia creditsAmount durationDays');

        res.json(populated);
    } catch (error) {
        console.error('Error actualizando suscripción MP:', error?.cause || error?.message || error);
        res.status(502);
        throw new Error('No se pudo actualizar la suscripción en Mercado Pago.');
    }
});

/**
 * Sync local subscription status from MP preapproval payload / fetch.
 */
const syncMpSubscriptionFromPreapproval = async (MpSubscription, settings, preapprovalId) => {
    if (!preapprovalId) return null;
    const remote = await withMpClient(settings, (client) =>
        new PreApproval(client).get({ id: preapprovalId })
    );
    if (!remote) return null;

    const localId = parseSubscriptionIdFromRef(remote.external_reference);
    const sub = localId
        ? await MpSubscription.findById(localId)
        : await MpSubscription.findOne({ preapprovalId: String(remote.id) });
    if (!sub) return null;

    sub.status = mapMpStatus(remote.status);
    if (remote.next_payment_date) sub.nextPaymentDate = new Date(remote.next_payment_date);
    if (remote.auto_recurring?.transaction_amount != null) {
        sub.amount = Number(remote.auto_recurring.transaction_amount);
    }
    if (sub.status === 'cancelled' && !sub.cancelledAt) {
        sub.cancelledAt = new Date();
    }
    await sub.save();
    return sub;
};

/**
 * Fulfill an approved MP payment that belongs to a subscription (external_reference mpsub:…).
 */
const fulfillMpSubscriptionPayment = async (gymId, payment) => {
    const subscriptionId = parseSubscriptionIdFromRef(payment.external_reference);
    if (!subscriptionId) return { skipped: true, reason: 'not_subscription' };
    if (payment.status !== 'approved') {
        return { skipped: true, reason: payment.status, kind: 'subscription' };
    }

    const { connection } = await connectToGymDB(gymId);
    const models = getModels(connection);
    const { MpSubscription, User, PaymentPackage } = models;

    const sub = await MpSubscription.findById(subscriptionId);
    if (!sub) return { skipped: true, reason: 'subscription_not_found', kind: 'subscription' };

    const paymentId = String(payment.id);
    if ((sub.processedPaymentIds || []).includes(paymentId)) {
        return { skipped: true, reason: 'already_processed', kind: 'subscription' };
    }

    const user = await User.findById(sub.user);
    const pkg = await PaymentPackage.findById(sub.package);
    if (!user || !pkg) {
        return { skipped: true, reason: 'missing_user_or_package', kind: 'subscription' };
    }

    const amount = Number(payment.transaction_amount || sub.amount) || 0;

    await fulfillApprovedPayment({
        models,
        user,
        packages: [{ pkg, quantity: 1 }],
        amount,
        description: `Débito automático MP: ${pkg.name}`,
        createdBy: user._id,
        ticketId: sub._id,
        transactionMeta: {
            method: 'mercadopago',
            source: 'subscription',
            originalAmount: sub.originalAmount != null ? sub.originalAmount : amount,
            discountAmount: sub.discountAmount || 0,
            discountId: sub.discountId || null,
        },
    });

    sub.processedPaymentIds = [...(sub.processedPaymentIds || []), paymentId].slice(-50);
    sub.lastPaymentId = paymentId;
    sub.lastChargedAt = new Date();
    sub.status = 'authorized';
    await sub.save();

    return { ok: true, kind: 'subscription', subscriptionId: sub._id };
};

export {
    createMpSubscription,
    listMyMpSubscriptions,
    listMpSubscriptionsAdmin,
    updateMpSubscription,
    syncMpSubscriptionFromPreapproval,
    fulfillMpSubscriptionPayment,
    parseSubscriptionIdFromRef,
    packageKind,
};
