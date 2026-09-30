import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import { fulfillApprovedPayment } from '../services/paymentFulfillment.js';

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
    const base = dateInput ? new Date(dateInput) : new Date();
    const dayStr = new Intl.DateTimeFormat('en-CA', { timeZone }).format(base);
    return {
        dayStr,
        start: new Date(`${dayStr}T00:00:00.000Z`),
        end: new Date(`${dayStr}T23:59:59.999Z`),
    };
};

const getMonthBounds = (tz) => {
    const timeZone = tz || 'America/Argentina/Buenos_Aires';
    const nowParts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date());
    const year = nowParts.find((p) => p.type === 'year')?.value;
    const month = nowParts.find((p) => p.type === 'month')?.value;
    const start = new Date(`${year}-${month}-01T00:00:00.000Z`);
    const nextMonth = Number(month) === 12
        ? `${Number(year) + 1}-01`
        : `${year}-${String(Number(month) + 1).padStart(2, '0')}`;
    const end = new Date(`${nextMonth}-01T00:00:00.000Z`);
    end.setMilliseconds(end.getMilliseconds() - 1);
    return { start, end };
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

    let from = req.query.from ? new Date(`${req.query.from}T00:00:00.000Z`) : monthBounds.start;
    let to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : todayBounds.end;
    if (Number.isNaN(from.getTime())) from = monthBounds.start;
    if (Number.isNaN(to.getTime())) to = todayBounds.end;

    const payments = await Transaction.find({
        type: 'payment',
        createdAt: { $gte: from, $lte: to },
    })
        .populate('user', 'nombre apellido')
        .populate('discountId', 'name type value')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

    const monthPayments = await Transaction.find({
        type: 'payment',
        createdAt: { $gte: monthBounds.start, $lte: monthBounds.end },
    }).select('amount createdAt method source').lean();

    const byMethod = { efectivo: 0, transfer: 0, mercadopago: 0, manual: 0 };
    const bySource = { packs: 0, store: 0, account: 0, caja: 0, billing: 0 };

    let rangeTotal = 0;
    for (const p of payments) {
        const amt = Number(p.amount) || 0;
        rangeTotal += amt;
        const method = byMethod[p.method] != null ? p.method : 'manual';
        byMethod[method] += amt;
        const sourceKey = p.source === 'pack' ? 'packs'
            : (p.source === 'caja' ? 'caja'
                : (p.source === 'store' ? 'store'
                    : (p.source === 'account' ? 'account' : 'billing')));
        bySource[sourceKey] = (bySource[sourceKey] || 0) + amt;
    }

    const todayPayments = await Transaction.find({
        type: 'payment',
        createdAt: { $gte: todayBounds.start, $lte: todayBounds.end },
    }).select('amount').lean();
    const todaySum = todayPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const monthSum = monthPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const gastosRange = await Gasto.find({
        spentAt: { $gte: from, $lte: to },
    })
        .populate('createdBy', 'nombre apellido')
        .sort({ spentAt: -1 })
        .limit(200)
        .lean();

    const gastosToday = await Gasto.find({
        spentAt: { $gte: todayBounds.start, $lte: todayBounds.end },
    }).select('amount').lean();

    const gastosMonth = await Gasto.find({
        spentAt: { $gte: monthBounds.start, $lte: monthBounds.end },
    }).select('amount category').lean();

    const gastosRangeSum = gastosRange.reduce((s, g) => s + (Number(g.amount) || 0), 0);
    const gastosTodaySum = gastosToday.reduce((s, g) => s + (Number(g.amount) || 0), 0);
    const gastosMonthSum = gastosMonth.reduce((s, g) => s + (Number(g.amount) || 0), 0);

    const gastosByCategory = {};
    for (const g of gastosRange) {
        const cat = g.category || 'otros';
        gastosByCategory[cat] = (gastosByCategory[cat] || 0) + (Number(g.amount) || 0);
    }

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
        User, PaymentPackage, Transaction, CreditLog, Notification, Discount,
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
    } = req.body;

    if (!userId) {
        res.status(400);
        throw new Error('Debes seleccionar un cliente.');
    }

    const allowedMethods = ['efectivo', 'transfer', 'mercadopago'];
    if (!allowedMethods.includes(method)) {
        res.status(400);
        throw new Error('Método de pago inválido.');
    }

    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }

    const cart = [];
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

    const free = Math.max(0, Number(freeAmount) || 0);
    if (cart.length === 0 && free <= 0) {
        res.status(400);
        throw new Error('Agregá un paquete o un monto libre.');
    }

    const catalogSubtotal = cart.reduce(
        (sum, e) => sum + Number(e.pkg.price) * e.quantity,
        0
    );

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
        if (names.length > 0 && free > 0) {
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

    const result = await fulfillApprovedPayment({
        models: { Transaction, CreditLog, Notification, User },
        user,
        packages: cart,
        amount: amountPaid,
        description: desc,
        createdBy: req.user._id,
        transactionMeta: {
            method,
            source: cart.length > 0 ? 'caja' : 'account',
            originalAmount: catalogSubtotal + free,
            discountAmount: discountValue,
            discountId: discountDoc?._id || null,
        },
    });

    // freeAmount alone is included in payment; no package charges — balance already +amountPaid
    // When only freeAmount, fulfill adds payment and no charges — correct for debt paydown.
    // When packages + free: payment = discounted packs + free, charges = discounted packs only → free reduces debt. Good.

    res.status(201).json({
        message: 'Venta registrada en caja.',
        amountPaid,
        discountAmount: discountValue,
        newBalance: user.balance,
        benefitMessage: result.benefitMessage || '',
    });
});

// --- Discounts CRUD ---

const listDiscounts = asyncHandler(async (req, res) => {
    const { Discount } = getModels(req.gymDBConnection);
    const includeInactive = req.query.all === 'true';
    const filter = includeInactive ? {} : { isActive: true };
    const discounts = await Discount.find(filter).sort({ createdAt: -1 });
    res.json(discounts);
});

const createDiscount = asyncHandler(async (req, res) => {
    const { Discount } = getModels(req.gymDBConnection);
    const { name, type, value, validFrom, validTo, isActive } = req.body;

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

    const discount = await Discount.create({
        name: String(name).trim(),
        type,
        value: numericValue,
        isActive: isActive !== false,
        validFrom: validFrom || null,
        validTo: validTo || null,
    });
    res.status(201).json(discount);
});

const updateDiscount = asyncHandler(async (req, res) => {
    const { Discount } = getModels(req.gymDBConnection);
    const discount = await Discount.findById(req.params.id);
    if (!discount) {
        res.status(404);
        throw new Error('Descuento no encontrado.');
    }

    const { name, type, value, validFrom, validTo, isActive } = req.body;
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
    res.json(discount);
});

const deleteDiscount = asyncHandler(async (req, res) => {
    const { Discount } = getModels(req.gymDBConnection);
    const discount = await Discount.findById(req.params.id);
    if (!discount) {
        res.status(404);
        throw new Error('Descuento no encontrado.');
    }
    discount.isActive = false;
    await discount.save();
    res.json({ message: 'Descuento desactivado.', discount });
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
    const allowedMethods = ['efectivo', 'transfer', 'mercadopago', 'manual'];
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
