import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import getModels from '../utils/getModels.js';
import { parseISO, isValid, startOfDay, endOfDay, startOfMonth } from 'date-fns';

const notVoided = {
    $or: [{ voidedAt: null }, { voidedAt: { $exists: false } }],
};

const emptySales = () => ({ count: 0, amount: 0, units: 0 });

const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;

const firstOrEmpty = (rows) => {
    const row = rows?.[0];
    if (!row) return emptySales();
    return {
        count: row.count || 0,
        amount: roundMoney(row.amount),
        units: row.units || row.count || 0,
    };
};

const resolveRange = (query = {}) => {
    const now = new Date();
    let start = query.from ? parseISO(String(query.from)) : startOfMonth(now);
    let end = query.to ? parseISO(String(query.to)) : now;
    if (!isValid(start)) start = startOfMonth(now);
    if (!isValid(end)) end = now;
    let from = startOfDay(start);
    let to = endOfDay(end);
    if (from > to) {
        const swappedFrom = startOfDay(end);
        to = endOfDay(start);
        from = swappedFrom;
    }
    return { from, to };
};

const bucketFormat = (from, to) => {
    const days = (to.getTime() - from.getTime()) / 86400000;
    return days <= 45 ? '%Y-%m-%d' : '%Y-%m';
};

const packageBaseStages = ({ userId, since, until } = {}) => {
    const match = {
        type: 'charge',
        'relatedItem.itemType': 'class_pack',
        ...notVoided,
    };
    if (userId) match.user = userId;
    if (since || until) {
        match.createdAt = {};
        if (since) match.createdAt.$gte = since;
        if (until) match.createdAt.$lte = until;
    }
    const isCredit = {
        $and: [
            { $ne: ['$pkg.isMembresia', true] },
            { $ne: ['$pkg.isPaseLibre', true] },
        ],
    };
    return [
        { $match: match },
        {
            $lookup: {
                from: 'paymentpackages',
                localField: 'relatedItem.itemId',
                foreignField: '_id',
                as: 'pkg',
            },
        },
        { $unwind: { path: '$pkg', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'tipoclases',
                localField: 'pkg.tipoClase',
                foreignField: '_id',
                as: 'tipo',
            },
        },
        { $unwind: { path: '$tipo', preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                kind: {
                    $cond: [
                        { $eq: ['$pkg.isMembresia', true] },
                        'membresia',
                        { $cond: [{ $eq: ['$pkg.isPaseLibre', true] }, 'pase', 'creditos'] },
                    ],
                },
                creditTypeId: { $cond: [isCredit, { $ifNull: ['$pkg.tipoClase', null] }, null] },
                creditTypeName: { $cond: [isCredit, { $ifNull: ['$tipo.nombre', 'Sin tipo'] }, null] },
            },
        },
    ];
};

const packageBreakdownPipeline = (opts) => [
    ...packageBaseStages(opts),
    {
        $group: {
            _id: {
                kind: '$kind',
                creditTypeId: '$creditTypeId',
                creditTypeName: '$creditTypeName',
            },
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
        },
    },
];

const packageByMonthPipeline = (opts) => [
    ...packageBaseStages(opts),
    {
        $group: {
            _id: {
                month: { $dateToString: { format: opts.bucket || '%Y-%m', date: '$createdAt' } },
                kind: '$kind',
            },
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
        },
    },
    { $sort: { '_id.month': 1 } },
];

const shapePackageBreakdown = (rows) => {
    const result = {
        creditos: { count: 0, amount: 0, byType: [] },
        pase: { count: 0, amount: 0 },
        membresia: { count: 0, amount: 0 },
    };
    for (const row of rows || []) {
        const kind = result[row._id?.kind] ? row._id.kind : 'creditos';
        const count = row.count || 0;
        const amount = roundMoney(row.amount);
        result[kind].count += count;
        result[kind].amount = roundMoney(result[kind].amount + amount);
        if (kind === 'creditos') {
            result.creditos.byType.push({
                id: row._id?.creditTypeId ? String(row._id.creditTypeId) : 'none',
                name: row._id?.creditTypeName || 'Sin tipo',
                count,
                amount,
            });
        }
    }
    result.creditos.byType.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'es'));
    return result;
};

const splitMonthsByKind = (rows) => {
    const months = { creditos: [], pase: [], membresia: [] };
    for (const row of rows || []) {
        const kind = months[row._id?.kind] ? row._id.kind : null;
        if (!kind || !row._id?.month) continue;
        months[kind].push({
            _id: row._id.month,
            count: row.count || 0,
            amount: roundMoney(row.amount),
        });
    }
    return months;
};

const buildPeriodPackages = (rows, monthRows) => {
    const shaped = shapePackageBreakdown(rows);
    const months = splitMonthsByKind(monthRows);
    const kindBlock = (key) => ({
        count: shaped[key].count,
        amount: shaped[key].amount,
        byMonth: months[key],
    });
    return {
        creditos: { ...kindBlock('creditos'), byType: shaped.creditos.byType },
        pase: kindBlock('pase'),
        membresia: kindBlock('membresia'),
    };
};

const storeSalesStages = ({ userId } = {}) => {
    const match = { status: { $in: ['paid', 'delivered'] } };
    if (userId) match.user = userId;
    return [
        { $match: match },
        {
            $addFields: {
                soldAt: { $ifNull: ['$reviewedAt', '$createdAt'] },
                units: {
                    $sum: {
                        $map: {
                            input: { $ifNull: ['$items', []] },
                            as: 'it',
                            in: { $ifNull: ['$$it.quantity', 1] },
                        },
                    },
                },
            },
        },
    ];
};

const getDashboardStats = asyncHandler(async (req, res) => {
    const { User, Clase, Transaction, StoreOrder } = getModels(req.gymDBConnection);
    const { from, to } = resolveRange(req.query);
    const bucket = bucketFormat(from, to);
    
    const newUsersByMonth = await User.aggregate([
        { $match: { roles: 'cliente', createdAt: { $gte: from, $lte: to } } },
        { 
            $group: { 
                _id: { $dateToString: { format: bucket, date: "$createdAt" } }, 
                count: { $sum: 1 } 
            } 
        },
        { $sort: { _id: 1 } }
    ]);

    // 2. Distribución por Sexo
    const genderDistribution = await User.aggregate([
        { $match: { roles: 'cliente' } },
        { $group: { _id: "$sexo", count: { $sum: 1 } } }
    ]);

    // 3. Distribución por Edad (Más detallado)
    const now = new Date();
    const usersForAge = await User.find({ roles: 'cliente', fechaNacimiento: { $exists: true, $ne: null } }).select('fechaNacimiento');
    
    const ageDistribution = {
        '<18': 0,
        '18-24': 0,
        '25-34': 0,
        '35-44': 0,
        '45-54': 0,
        '55-64': 0,
        '65+': 0
    };

    usersForAge.forEach(u => {
        if (!u.fechaNacimiento) return;
        const ageDifMs = now - u.fechaNacimiento.getTime();
        const ageDate = new Date(ageDifMs);
        const age = Math.abs(ageDate.getUTCFullYear() - 1970);
        
        if (age < 18) ageDistribution['<18']++;
        else if (age <= 24) ageDistribution['18-24']++;
        else if (age <= 34) ageDistribution['25-34']++;
        else if (age <= 44) ageDistribution['35-44']++;
        else if (age <= 54) ageDistribution['45-54']++;
        else if (age <= 64) ageDistribution['55-64']++;
        else ageDistribution['65+']++;
    });

    const classAssistance = await Clase.aggregate([
        { $match: { fecha: { $gte: from, $lte: to }, estado: { $in: ['activa', 'completada'] } } },
        { 
            $lookup: {
                from: 'tipoclases', 
                localField: 'tipoClase', 
                foreignField: '_id', 
                as: 'tipoClaseData'
            }
        },
        { $unwind: "$tipoClaseData" },
        { 
            $group: { 
                _id: "$tipoClaseData.nombre",
                totalInscritos: { $sum: { $size: { $ifNull: ["$usuariosInscritos", []] } } },
                totalAsistencias: { $sum: { $size: { $ifNull: ["$asistencias", []] } } },
                totalClases: { $sum: 1 }
            } 
        },
        { 
            $project: { 
                _id: 1,
                averageInscritos: { 
                    $cond: [{ $eq: ["$totalClases", 0] }, 0, { $divide: ["$totalInscritos", "$totalClases"] }] 
                },
                attendancePercentage: {
                    $cond: [{ $eq: ["$totalInscritos", 0] }, 0, { $multiply: [{ $divide: ["$totalAsistencias", "$totalInscritos"] }, 100] }]
                }
            } 
        },
        { $sort: { averageInscritos: -1 } }
    ]);

    const storeBase = storeSalesStages();
    const rangeOpts = { since: from, until: to, bucket };

    const [
        packageRows,
        packageByMonth,
        storeTotal,
        storeByMonth,
    ] = await Promise.all([
        Transaction.aggregate(packageBreakdownPipeline(rangeOpts)),
        Transaction.aggregate(packageByMonthPipeline(rangeOpts)),
        StoreOrder.aggregate([
            ...storeBase,
            { $match: { soldAt: { $gte: from, $lte: to } } },
            { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amountTransferred' }, units: { $sum: '$units' } } },
        ]),
        StoreOrder.aggregate([
            ...storeBase,
            { $match: { soldAt: { $gte: from, $lte: to } } },
            {
                $group: {
                    _id: { $dateToString: { format: bucket, date: '$soldAt' } },
                    count: { $sum: 1 },
                    amount: { $sum: '$amountTransferred' },
                    units: { $sum: '$units' },
                },
            },
            { $sort: { _id: 1 } },
        ]),
    ]);

    res.json({
        newUsersByMonth,
        genderDistribution,
        ageDistribution,
        classAssistance,
        sales: {
            packages: buildPeriodPackages(packageRows, packageByMonth),
            store: {
                ...firstOrEmpty(storeTotal),
                byMonth: storeByMonth,
            },
        },
    });
});

const getClientStats = asyncHandler(async (req, res) => {
    const { Clase, Transaction, StoreOrder } = getModels(req.gymDBConnection);
    const userId = req.params.id;

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const { from, to } = resolveRange(req.query);
    const bucket = bucketFormat(from, to);
    const dateFilter = { $gte: from, $lte: to };

    const getMatchFilter = (dateFilter = null) => {
        const match = { 
            usuariosInscritos: userObjectId,
            estado: { $in: ['activa', 'completada'] }
        };
        if (dateFilter) match.fecha = dateFilter;
        return { $match: match };
    };

    const getAttendanceQuery = (dateFilter = null) => [
        getMatchFilter(dateFilter),
        {
            $group: {
                _id: null,
                totalInscripciones: { $sum: 1 },
                totalAsistencias: { $sum: { $cond: [{ $in: [userObjectId, { $ifNull: ["$asistencias", []] }] }, 1, 0] } }
            }
        }
    ];

    const getFavoritesQuery = (dateFilter = null) => [
        getMatchFilter(dateFilter),
        { $lookup: { from: 'tipoclases', localField: 'tipoClase', foreignField: '_id', as: 'tipoClaseData' } },
        { $unwind: "$tipoClaseData" },
        { $group: { _id: "$tipoClaseData.nombre", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ];

    const storeBase = storeSalesStages({ userId: userObjectId });

    const [
        attendanceRes,
        favoritesRes,
        activityByMonth,
        packageRows,
        storeTotal,
    ] = await Promise.all([
        Clase.aggregate(getAttendanceQuery(dateFilter)),
        Clase.aggregate(getFavoritesQuery(dateFilter)),
        Clase.aggregate([
            { $match: { usuariosInscritos: userObjectId, fecha: dateFilter } },
            { $group: { _id: { $dateToString: { format: bucket, date: "$fecha" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]),
        Transaction.aggregate(packageBreakdownPipeline({ userId: userObjectId, since: from, until: to })),
        StoreOrder.aggregate([
            ...storeBase,
            { $match: { soldAt: dateFilter } },
            { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amountTransferred' }, units: { $sum: '$units' } } },
        ]),
    ]);

    res.json({
        attendanceData: attendanceRes.length > 0 ? attendanceRes[0] : { totalInscripciones: 0, totalAsistencias: 0 },
        favoriteClasses: favoritesRes,
        packageSales: shapePackageBreakdown(packageRows),
        storeSales: firstOrEmpty(storeTotal),
        activityByMonth,
    });
});

export { getDashboardStats, getClientStats };
