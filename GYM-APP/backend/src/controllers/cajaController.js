import asyncHandler from 'express-async-handler';
import moment from 'moment-timezone';
import getModels from '../utils/getModels.js';
import { fulfillApprovedPayment } from '../services/paymentFulfillment.js';
import { enrollUserInFixedPlan } from '../services/fixedPlanEnrollment.js';

const CURRENCY_BY_COUNTRY = {
    Argentina: 'ARS',
    Brasil: 'BRL',
    Mexico: 'MXN',
    Chile: 'CLP',
    Uruguay: 'UYU',
    Colombia: 'COP',
    Peru: 'PEN',
};

const getGymDayBounds = (tz, dateInput) => {
    const timeZone = tz || 'America/Argentina/Buenos_Aires';
    const m = dateInput
        ? moment.tz(dateInput, timeZone)
        : moment.tz(timeZone);
    return {
        dayStr: m.format('YYYY-MM-DD'),
        start: m.clone().startOf('day').toDate(),
        end: m.clone().endOf('day').toDate(),
    };
};

const getMonthBounds = (tz) => {
    const timeZone = tz || 'America/Argentina/Buenos_Aires';
    const m = moment.tz(timeZone);
    return {
        start: m.clone().startOf('month').toDate(),
        end: m.clone().endOf('month').toDate(),
    };
};

const isDiscountValidNow = (discount, now = new Date()) => {
    if (!discount?.isActive) return false;
    if (discount.validFrom && new Date(discount.validFrom) > now) return false;
    if (discount.validTo && new Date(discount.validTo) < now) return false;
    return true;
};

const computeDiscountAmount = (subtotal, { discount, discountPercent, discountAmount }) => {
    const base = Math.max(0, Number(subtotal) || 0);
    if (discount && isDiscountValidNow(discount)) {
        if (discount.type === 'percent') {
            return Math.min(base, Math.round(base * (Number(discount.value) / 100) * 100) / 100);
        }
        return Math.min(base, Number(discount.value) || 0);
    }
    if (discountPercent != null && discountPercent !== '') {
        const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
        return Math.min(base, Math.round(base * (pct / 100) * 100) / 100);
    }
    if (discountAmount != null && discountAmount !== '') {
        return Math.min(base, Math.max(0, Number(discountAmount) || 0));
    }
    return 0;
};

// GET /api/caja/dashboard
const getCajaDashboard = asyncHandler(async (req, res) => {
    const {
        Transaction, PaymentRequest, StoreOrder, User, Settings, Gasto,
    } = getModels(req.gymDBConnection);
    const tz = req.gymTimezone || 'America/Argentina/Buenos_Aires';
    const currency = CURRENCY_BY_COUNTRY[req.gymPais] || 'ARS';

    const todayBounds = getGymDayBounds(tz);
    const monthBounds = getMonthBounds(tz);

    let from = req.query.from
        ? moment.tz(req.query.from, tz).startOf('day').toDate()
        : monthBounds.start;
    let to = req.query.to
        ? moment.tz(req.query.to, tz).endOf('day').toDate()
        : todayBounds.end;
    if (Number.isNaN(from.getTime())) from = monthBounds.start;
    if (Number.isNaN(to.getTime())) to = todayBounds.end;

    const sumField = async (Model, match) => {
        const rows = await Model.aggregate([
            { $match: match },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        return rows[0]?.total || 0;
    };

    const [rangeTotal, todaySum, monthSum, gastosRangeSum, gastosTodaySum, gastosMonthSum] = await Promise.all([
        sumField(Transaction, { type: 'payment', createdAt: { $gte: from, $lte: to } }),
        sumField(Transaction, { type: 'payment', createdAt: { $gte: todayBounds.start, $lte: todayBounds.end } }),
        sumField(Transaction, { type: 'payment', createdAt: { $gte: monthBounds.start, $lte: monthBounds.end } }),
        sumField(Gasto, { spentAt: { $gte: from, $lte: to } }),
        sumField(Gasto, { spentAt: { $gte: todayBounds.start, $lte: todayBounds.end } }),
        sumField(Gasto, { spentAt: { $gte: monthBounds.start, $lte: monthBounds.end } }),
    ]);

    const prCollection = PaymentRequest.collection.name;

    const methodAgg = await Transaction.aggregate([
        {
            $match: {
                type: 'payment',
                createdAt: { $gte: from, $lte: to },
            },
        },
        {
            $lookup: {
                from: prCollection,
                localField: 'paymentRequestId',
                foreignField: '_id',
                as: '_pr',
            },
        },
        {
            $addFields: {
                _prMethod: { $arrayElemAt: ['$_pr.method', 0] },
                _desc: { $toLower: { $ifNull: ['$description', ''] } },
            },
        },
        {
            $addFields: {
                resolvedMethod: {
                    $switch: {
                        branches: [
                            {
                                case: { $in: ['$method', ['efectivo', 'transfer', 'mercadopago']] },
                                then: '$method',
                            },
                            {
                                case: { $eq: ['$_prMethod', 'mercadopago'] },
                                then: 'mercadopago',
                            },
                            {
                                case: { $eq: ['$_prMethod', 'transfer'] },
                                then: 'transfer',
                            },
                            {
                                case: {
                                    $regexMatch: {
                                        input: '$_desc',
                                        regex: 'mercado\\s*pago',
                                    },
                                },
                                then: 'mercadopago',
                            },
                            {
                                case: {
                                    $regexMatch: {
                                        input: '$_desc',
                                        regex: 'transferencia',
                                    },
                                },
                                then: 'transfer',
                            },
                        ],
                        default: null,
                    },
                },
            },
        },
        { $match: { resolvedMethod: { $in: ['efectivo', 'transfer', 'mercadopago'] } } },
        { $group: { _id: '$resolvedMethod', total: { $sum: '$amount' } } },
    ]);
    const byMethod = { efectivo: 0, transfer: 0, mercadopago: 0 };
    for (const row of methodAgg) {
        if (byMethod[row._id] != null) {
            byMethod[row._id] += row.total || 0;
        }
    }

    // Fallback: approved MP tickets in range (covers older payments without method set)
    if (byMethod.mercadopago === 0) {
        const mpTicketAgg = await PaymentRequest.aggregate([
            {
                $match: {
                    method: 'mercadopago',
                    status: 'approved',
                    $or: [
                        { reviewedAt: { $gte: from, $lte: to } },
                        {
                            reviewedAt: null,
                            updatedAt: { $gte: from, $lte: to },
                        },
                    ],
                },
            },
            { $group: { _id: null, total: { $sum: '$amountTransferred' } } },
        ]);
        if (mpTicketAgg[0]?.total) {
            byMethod.mercadopago = mpTicketAgg[0].total;
        }
    }

    const sourceAgg = await Transaction.aggregate([
        { $match: { type: 'payment', createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$source', total: { $sum: '$amount' } } },
    ]);
    const bySource = { packs: 0, store: 0, account: 0, caja: 0, billing: 0 };
    for (const row of sourceAgg) {
        const sourceKey = row._id === 'pack' ? 'packs'
            : (row._id === 'caja' ? 'caja'
                : (row._id === 'store' ? 'store'
                    : (row._id === 'account' ? 'account' : 'billing')));
        bySource[sourceKey] = (bySource[sourceKey] || 0) + (row.total || 0);
    }

    const gastosCatAgg = await Gasto.aggregate([
        { $match: { spentAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
    ]);
    const gastosByCategory = {};
    for (const row of gastosCatAgg) {
        gastosByCategory[row._id || 'otros'] = row.total || 0;
    }

    const payments = await Transaction.find({
        type: 'payment',
        createdAt: { $gte: from, $lte: to },
    })
        .populate('user', 'nombre apellido')
        .populate('discountId', 'name type value')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

    const gastosRange = await Gasto.find({
        spentAt: { $gte: from, $lte: to },
    })
        .populate('createdBy', 'nombre apellido')
        .sort({ spentAt: -1 })
        .limit(200)
        .lean();

    const pendingTickets = await PaymentRequest.find({ status: 'pending' })
        .populate('user', 'nombre apellido email dni')
        .populate({ path: 'package', populate: { path: 'tipoClase', select: 'nombre' } })
        .populate({ path: 'items.package', populate: { path: 'tipoClase', select: 'nombre' } })
        .sort({ createdAt: 1 })
        .lean();

    const pendingStore = await StoreOrder.find({ status: 'pending' })
        .populate('user', 'nombre apellido')
        .sort({ createdAt: 1 })
        .lean();

    const pendingTransfers = pendingTickets.filter((t) => t.method !== 'mercadopago');
    const pendingMp = pendingTickets.filter((t) => t.method === 'mercadopago');

    const sumPending = (list, field = 'amountTransferred') =>
        list.reduce((s, i) => s + (Number(i[field]) || 0), 0);

    const debtStats = await User.aggregate([
        { $match: { roles: 'cliente', balance: { $lt: 0 } } },
        { $group: { _id: null, totalDebt: { $sum: '$balance' }, debtorCount: { $sum: 1 } } },
    ]);
    const totalDebt = debtStats.length > 0 ? Math.abs(debtStats[0].totalDebt) : 0;
    const debtorCount = debtStats.length > 0 ? debtStats[0].debtorCount : 0;

    const creditStats = await User.aggregate([
        { $match: { roles: 'cliente', balance: { $gt: 0 } } },
        { $group: { _id: null, totalCredit: { $sum: '$balance' }, creditCount: { $sum: 1 } } },
    ]);
    const totalCredit = creditStats.length > 0 ? creditStats[0].totalCredit : 0;
    const creditCount = creditStats.length > 0 ? creditStats[0].creditCount : 0;

    const recentMp = await PaymentRequest.find({
        method: 'mercadopago',
        status: 'approved',
        reviewedAt: { $gte: from, $lte: to },
    })
        .populate('user', 'nombre apellido')
        .sort({ reviewedAt: -1 })
        .limit(30)
        .lean();

    const settings = await Settings.findById('main_settings').select('mercadoPago.isLinked').lean();

    res.json({
        currency,
        range: { from, to },
        totals: {
            range: rangeTotal,
            today: todaySum,
            month: monthSum,
            gastosRange: gastosRangeSum,
            gastosToday: gastosTodaySum,
            gastosMonth: gastosMonthSum,
            netRange: rangeTotal - gastosRangeSum,
            netToday: todaySum - gastosTodaySum,
            netMonth: monthSum - gastosMonthSum,
        },
        byMethod,
        bySource,
        gastosByCategory,
        pending: {
            transfers: {
                count: pendingTransfers.length,
                amount: sumPending(pendingTransfers),
                items: pendingTransfers,
            },
            mercadopago: {
                count: pendingMp.length,
                amount: sumPending(pendingMp),
                items: pendingMp,
            },
            store: {
                count: pendingStore.length,
                amount: sumPending(pendingStore),
                items: pendingStore,
            },
        },
        debt: { totalDebt, debtorCount },
        credit: { totalCredit, creditCount },
        movements: payments.map((p) => ({
            _id: p._id,
            date: p.createdAt,
            amount: p.amount,
            description: p.description,
            method: p.method,
            source: p.source,
            originalAmount: p.originalAmount,
            discountAmount: p.discountAmount,
            discount: p.discountId,
            clientName: p.user ? `${p.user.nombre || ''} ${p.user.apellido || ''}`.trim() : '—',
            userId: p.user?._id,
            receiptUrl: p.receiptUrl,
            kind: 'ingreso',
        })),
        gastos: gastosRange.map((g) => ({
            _id: g._id,
            date: g.spentAt || g.createdAt,
            amount: g.amount,
            name: g.name,
            category: g.category,
            method: g.method,
            notes: g.notes,
            createdByName: g.createdBy
                ? `${g.createdBy.nombre || ''} ${g.createdBy.apellido || ''}`.trim()
                : '—',
            kind: 'gasto',
        })),
        recentMercadoPago: recentMp.map((t) => ({
            _id: t._id,
            date: t.reviewedAt || t.updatedAt,
            amount: t.amountTransferred,
            method: 'mercadopago',
            status: t.status,
            clientName: t.user ? `${t.user.nombre || ''} ${t.user.apellido || ''}`.trim() : '—',
            mpStatus: t.mpStatus,
        })),
        mercadoPagoLinked: !!settings?.mercadoPago?.isLinked,
    });
});

// POST /api/caja/sale
const createCajaSale = asyncHandler(async (req, res) => {
    const {
        User, PaymentPackage, Transaction, CreditLog, Notification, Discount, TipoClase, Clase,
    } = getModels(req.gymDBConnection);

    const {
        userId,
        items = [],
        freeAmount = 0,
        discountId,
        discountPercent,
        discountAmount,
        method = 'efectivo',
        description,
        payLater = false,
        customItem = null,
        customPrice = null,
    } = req.body;

    if (!userId) {
        res.status(400);
        throw new Error('Debes seleccionar un cliente.');
    }

    const isPayLater = Boolean(payLater);
    const allowedMethods = ['efectivo', 'transfer', 'mercadopago'];
    if (!isPayLater && !allowedMethods.includes(method)) {
        res.status(400);
        throw new Error('Método de pago inválido.');
    }

    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }

    const cart = [];
    let dateOverrides = null;
    let horarioFijoPayload = null;

    for (const item of items) {
        if (!item?.packageId) continue;
        const pkg = await PaymentPackage.findById(item.packageId);
        if (!pkg || !pkg.isActive) {
            res.status(400);
            throw new Error(`Paquete no disponible: ${item.packageId}`);
        }
        cart.push({
            pkg,
            quantity: Math.max(1, Number(item.quantity) || 1),
        });
    }

    if (customItem && cart.length === 0) {
        const kind = customItem.kind;
        const listPrice = Math.max(0, Number(customItem.price) || 0);
        if (listPrice <= 0) {
            res.status(400);
            throw new Error('Indicá el precio de la venta personalizada.');
        }

        if (kind === 'credits') {
            const creditsAmount = Number(customItem.creditsAmount);
            if (!customItem.tipoClaseId || !Number.isFinite(creditsAmount) || creditsAmount <= 0) {
                res.status(400);
                throw new Error('Créditos personalizados requieren tipo de turno y cantidad positiva.');
            }
            const tipo = await TipoClase.findById(customItem.tipoClaseId).select('nombre');
            if (!tipo) {
                res.status(400);
                throw new Error('Tipo de turno no encontrado.');
            }
            cart.push({
                pkg: {
                    name: customItem.name?.trim()
                        || `Créditos ${tipo.nombre} x${creditsAmount}`,
                    price: listPrice,
                    tipoClase: customItem.tipoClaseId,
                    creditsAmount,
                    isPaseLibre: false,
                    isMembresia: false,
                },
                quantity: 1,
            });
        } else if (kind === 'pase' || kind === 'membresia') {
            const isPase = kind === 'pase';
            let durationDays = Math.max(0, Number(customItem.durationDays) || 0);
            const desde = customItem.desde ? new Date(`${customItem.desde}T12:00:00.000Z`) : null;
            const hasta = customItem.hasta ? new Date(`${customItem.hasta}T12:00:00.000Z`) : null;
            if (desde && hasta && !Number.isNaN(desde.getTime()) && !Number.isNaN(hasta.getTime())) {
                if (hasta < desde) {
                    res.status(400);
                    throw new Error('La fecha hasta debe ser posterior a desde.');
                }
                durationDays = Math.max(1, Math.round((hasta - desde) / (1000 * 60 * 60 * 24)));
                dateOverrides = {
                    kind,
                    desde: new Date(`${customItem.desde}T00:00:00.000Z`),
                    hasta: new Date(`${customItem.hasta}T23:59:59.999Z`),
                };
            }
            if (durationDays <= 0) {
                res.status(400);
                throw new Error(isPase
                    ? 'Indicá fechas o duración del acceso libre.'
                    : 'Indicá fechas o duración de la membresía.');
            }
            cart.push({
                pkg: {
                    name: customItem.name?.trim()
                        || (isPase ? `Acceso libre ${durationDays}d` : `Membresía ${durationDays}d`),
                    price: listPrice,
                    isPaseLibre: isPase,
                    isMembresia: !isPase,
                    durationDays,
                    creditsAmount: 0,
                },
                quantity: 1,
            });
        } else if (kind === 'horario_fijo') {
            const {
                tipoClaseId,
                diasDeSemana,
                fechaInicio,
                fechaFin,
                horaInicio,
                horaFin,
                name,
            } = customItem;
            if (!tipoClaseId || !Array.isArray(diasDeSemana) || diasDeSemana.length === 0 || !fechaInicio || !horaInicio) {
                res.status(400);
                throw new Error('Completá tipo, días, fechas y horario del plan fijo.');
            }
            const tipo = await TipoClase.findById(tipoClaseId).select('nombre');
            if (!tipo) {
                res.status(400);
                throw new Error('Tipo de turno no encontrado.');
            }
            horarioFijoPayload = {
                tipoClaseId,
                diasDeSemana,
                fechaInicio,
                fechaFin: fechaFin || fechaInicio,
                horaInicio,
                horaFin: horaFin || horaInicio,
            };
            cart.push({
                pkg: {
                    name: name?.trim() || `Horario fijo ${tipo.nombre} ${horaInicio}`,
                    price: listPrice,
                    isPaseLibre: false,
                    isMembresia: false,
                    creditsAmount: 0,
                },
                quantity: 1,
            });
        } else {
            res.status(400);
            throw new Error('Tipo de venta personalizada inválido.');
        }
    }

    const free = isPayLater ? 0 : Math.max(0, Number(freeAmount) || 0);
    if (cart.length === 0 && free <= 0) {
        res.status(400);
        throw new Error('Agregá un paquete, una venta personalizada o un monto libre.');
    }

    if (isPayLater && cart.length === 0) {
        res.status(400);
        throw new Error('Paga luego solo aplica a ventas con paquetes o ítems personalizados.');
    }

    let catalogSubtotal = cart.reduce(
        (sum, e) => sum + Number(e.pkg.price) * e.quantity,
        0
    );

    if (customPrice != null && customPrice !== '' && cart.length === 1 && !customItem) {
        const override = Math.max(0, Number(customPrice));
        if (Number.isFinite(override) && override > 0) {
            catalogSubtotal = override;
            cart[0] = {
                ...cart[0],
                pkg: {
                    ...(typeof cart[0].pkg.toObject === 'function'
                        ? cart[0].pkg.toObject()
                        : cart[0].pkg),
                    price: override,
                },
            };
        }
    }

    if (cart.length === 0 && free > 0 && !String(description || '').trim()) {
        res.status(400);
        throw new Error('El abono libre necesita un nombre / descripción.');
    }

    let discountDoc = null;
    if (discountId) {
        discountDoc = await Discount.findById(discountId);
        if (!discountDoc || !isDiscountValidNow(discountDoc)) {
            res.status(400);
            throw new Error('El descuento seleccionado no está disponible.');
        }
    }

    const discountValue = computeDiscountAmount(catalogSubtotal, {
        discount: discountDoc,
        discountPercent,
        discountAmount,
    });

    const amountPaid = Math.round((catalogSubtotal - discountValue + free) * 100) / 100;
    if (amountPaid <= 0) {
        res.status(400);
        throw new Error('El monto a cobrar debe ser mayor a 0.');
    }

    const names = cart.map((e) => (e.quantity > 1 ? `${e.pkg.name} x${e.quantity}` : e.pkg.name));
    let desc = description?.trim();
    if (!desc) {
        if (isPayLater) {
            desc = `Caja (paga luego): ${names.join(', ')}`;
        } else if (names.length > 0 && free > 0) {
            desc = `Caja: ${names.join(', ')} + extra a favor $${free}`;
        } else if (names.length > 0) {
            desc = `Caja: ${names.join(', ')}`;
        } else {
            desc = 'Caja: abono / saldo a favor';
        }
        if (discountValue > 0) {
            desc += ` (dto. $${discountValue.toFixed(2)})`;
        }
    }

    if (horarioFijoPayload) {
        const probe = await Clase.find({
            tipoClase: horarioFijoPayload.tipoClaseId,
            diaDeSemana: { $in: horarioFijoPayload.diasDeSemana },
            horaInicio: horarioFijoPayload.horaInicio,
            fecha: {
                $gte: new Date(`${horarioFijoPayload.fechaInicio}T00:00:00Z`),
                $lte: new Date(`${horarioFijoPayload.fechaFin}T23:59:59Z`),
            },
            estado: 'activa',
        }).select('usuariosInscritos capacidad');
        if (probe.length === 0) {
            res.status(404);
            throw new Error('No se encontraron turnos activos que coincidan con los criterios del plan.');
        }
        const uid = user._id.toString();
        for (const classInstance of probe) {
            if (classInstance.usuariosInscritos.length >= classInstance.capacidad) {
                res.status(400);
                throw new Error('No se puede cobrar: algún turno del plan está lleno.');
            }
            if (classInstance.usuariosInscritos.some((id) => id.toString() === uid)) {
                res.status(400);
                throw new Error('El usuario ya está inscrito en alguno de esos turnos.');
            }
        }
    }

    const result = await fulfillApprovedPayment({
        models: { Transaction, CreditLog, Notification, User },
        user,
        packages: cart,
        amount: amountPaid,
        description: desc,
        createdBy: req.user._id,
        payLater: isPayLater,
        transactionMeta: {
            method: isPayLater ? 'deuda' : method,
            source: cart.length > 0 ? 'caja' : 'account',
            originalAmount: catalogSubtotal + free,
            discountAmount: discountValue,
            discountId: discountDoc?._id || null,
        },
    });

    let benefitMessage = result.benefitMessage || '';

    if (dateOverrides) {
        if (dateOverrides.kind === 'pase') {
            user.paseLibreDesde = dateOverrides.desde;
            user.paseLibreHasta = dateOverrides.hasta;
        } else {
            user.membresiaDesde = dateOverrides.desde;
            user.membresiaHasta = dateOverrides.hasta;
        }
        await user.save();
    }

    if (horarioFijoPayload) {
        try {
            const enrollResult = await enrollUserInFixedPlan({
                models: { Clase, TipoClase, Notification, User },
                user,
                ...horarioFijoPayload,
                gymTimezone: req.gymTimezone || 'America/Argentina/Buenos_Aires',
                notify: true,
            });
            benefitMessage = [benefitMessage, enrollResult.benefitMessage].filter(Boolean).join(' ');
        } catch (error) {
            res.status(error.statusCode || 500);
            throw new Error(
                `El cobro se registró, pero falló la inscripción al horario fijo: ${error.message}`
            );
        }
    }

    res.status(201).json({
        message: isPayLater
            ? 'Venta cargada como deuda al cliente.'
            : 'Venta registrada en caja.',
        amountPaid: isPayLater ? 0 : amountPaid,
        amountCharged: amountPaid,
        payLater: isPayLater,
        discountAmount: discountValue,
        newBalance: user.balance,
        benefitMessage,
    });
});

// --- Discounts CRUD ---

const normalizeUserIdList = (raw) => {
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((id) => String(id)).filter(Boolean))];
};

/**
 * Keep Discount.assignedUsers and User.assignedDiscountId in sync.
 * A client can only be linked to one discount at a time.
 */
const syncDiscountAssignedUsers = async (User, Discount, discountId, nextUserIds) => {
    const next = normalizeUserIdList(nextUserIds);
    const discount = await Discount.findById(discountId);
    if (!discount) return null;

    const prev = (discount.assignedUsers || []).map((id) => id.toString());
    const removed = prev.filter((id) => !next.includes(id));

    if (removed.length) {
        await User.updateMany(
            { _id: { $in: removed }, assignedDiscountId: discountId },
            { $set: { assignedDiscountId: null } }
        );
    }

    if (next.length) {
        await Discount.updateMany(
            { _id: { $ne: discountId }, assignedUsers: { $in: next } },
            { $pull: { assignedUsers: { $in: next } } }
        );
        await User.updateMany(
            { _id: { $in: next } },
            { $set: { assignedDiscountId: discountId } }
        );
    }

    discount.assignedUsers = next;
    await discount.save();
    return discount;
};

const listDiscounts = asyncHandler(async (req, res) => {
    const { Discount } = getModels(req.gymDBConnection);
    const includeInactive = req.query.all === 'true';
    const filter = includeInactive ? {} : { isActive: true };
    const discounts = await Discount.find(filter)
        .populate('assignedUsers', 'nombre apellido email')
        .sort({ createdAt: -1 });
    res.json(discounts);
});

const createDiscount = asyncHandler(async (req, res) => {
    const { Discount, User } = getModels(req.gymDBConnection);
    const { name, type, value, validFrom, validTo, isActive, assignedUsers } = req.body;

    if (!name || !type || value == null) {
        res.status(400);
        throw new Error('Nombre, tipo y valor son obligatorios.');
    }
    if (!['percent', 'fixed'].includes(type)) {
        res.status(400);
        throw new Error('Tipo de descuento inválido.');
    }
    const numericValue = Number(value);
    if (Number.isNaN(numericValue) || numericValue < 0) {
        res.status(400);
        throw new Error('Valor de descuento inválido.');
    }
    if (type === 'percent' && numericValue > 100) {
        res.status(400);
        throw new Error('El porcentaje no puede superar 100.');
    }

    let discount = await Discount.create({
        name: String(name).trim(),
        type,
        value: numericValue,
        isActive: isActive !== false,
        validFrom: validFrom || null,
        validTo: validTo || null,
        assignedUsers: [],
    });

    if (assignedUsers !== undefined) {
        discount = await syncDiscountAssignedUsers(User, Discount, discount._id, assignedUsers);
    }

    const populated = await Discount.findById(discount._id)
        .populate('assignedUsers', 'nombre apellido email');
    res.status(201).json(populated);
});

const updateDiscount = asyncHandler(async (req, res) => {
    const { Discount, User } = getModels(req.gymDBConnection);
    const discount = await Discount.findById(req.params.id);
    if (!discount) {
        res.status(404);
        throw new Error('Descuento no encontrado.');
    }

    const { name, type, value, validFrom, validTo, isActive, assignedUsers } = req.body;
    if (name != null) discount.name = String(name).trim();
    if (type != null) {
        if (!['percent', 'fixed'].includes(type)) {
            res.status(400);
            throw new Error('Tipo de descuento inválido.');
        }
        discount.type = type;
    }
    if (value != null) {
        const numericValue = Number(value);
        if (Number.isNaN(numericValue) || numericValue < 0) {
            res.status(400);
            throw new Error('Valor de descuento inválido.');
        }
        discount.value = numericValue;
    }
    if (validFrom !== undefined) discount.validFrom = validFrom || null;
    if (validTo !== undefined) discount.validTo = validTo || null;
    if (isActive !== undefined) discount.isActive = !!isActive;

    await discount.save();

    if (assignedUsers !== undefined) {
        await syncDiscountAssignedUsers(User, Discount, discount._id, assignedUsers);
    }

    const populated = await Discount.findById(discount._id)
        .populate('assignedUsers', 'nombre apellido email');
    res.json(populated);
});

const deleteDiscount = asyncHandler(async (req, res) => {
    const { Discount, User } = getModels(req.gymDBConnection);
    const discount = await Discount.findById(req.params.id);
    if (!discount) {
        res.status(404);
        throw new Error('Descuento no encontrado.');
    }
    const linked = (discount.assignedUsers || []).map((id) => id.toString());
    if (linked.length) {
        await User.updateMany(
            { _id: { $in: linked }, assignedDiscountId: discount._id },
            { $set: { assignedDiscountId: null } }
        );
    }
    await discount.deleteOne();
    res.json({ message: 'Descuento eliminado.' });
});

const GASTO_CATEGORIES = ['alquiler', 'servicios', 'sueldos', 'insumos', 'mantenimiento', 'impuestos', 'otros'];

const createGasto = asyncHandler(async (req, res) => {
    const { Gasto } = getModels(req.gymDBConnection);
    const { name, amount, category = 'otros', method = 'efectivo', notes, spentAt } = req.body;

    if (!name || !String(name).trim()) {
        res.status(400);
        throw new Error('El gasto necesita un nombre.');
    }
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
        res.status(400);
        throw new Error('El monto del gasto debe ser mayor a 0.');
    }
    if (!GASTO_CATEGORIES.includes(category)) {
        res.status(400);
        throw new Error('Categoría de gasto inválida.');
    }
    const allowedMethods = ['efectivo', 'transfer', 'mercadopago'];
    if (!allowedMethods.includes(method)) {
        res.status(400);
        throw new Error('Método de pago inválido.');
    }

    const gasto = await Gasto.create({
        name: String(name).trim(),
        amount: numericAmount,
        category,
        method,
        notes: notes ? String(notes).trim() : '',
        createdBy: req.user._id,
        spentAt: spentAt ? new Date(spentAt) : new Date(),
    });

    res.status(201).json({ message: 'Gasto registrado.', gasto });
});

const deleteGasto = asyncHandler(async (req, res) => {
    const { Gasto } = getModels(req.gymDBConnection);
    const gasto = await Gasto.findById(req.params.id);
    if (!gasto) {
        res.status(404);
        throw new Error('Gasto no encontrado.');
    }
    await gasto.deleteOne();
    res.json({ message: 'Gasto eliminado.' });
});

export {
    getCajaDashboard,
    createCajaSale,
    listDiscounts,
    createDiscount,
    updateDiscount,
    deleteDiscount,
    createGasto,
    deleteGasto,
};
