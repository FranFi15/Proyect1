import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import getModels from '../utils/getModels.js';
import { subMonths, startOfMonth, subDays } from 'date-fns';

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

const packageBaseStages = ({ userId, since } = {}) => {
    const match = {
        type: 'charge',
        'relatedItem.itemType': 'class_pack',
        ...notVoided,
    };
    if (userId) match.user = userId;
    if (since) match.createdAt = { $gte: since };
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
                month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
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

const attachLast30ToCreditTypes = (totalTypes, last30Types) => {
    const lastById = new Map((last30Types || []).map((row) => [row.id, row]));
    return (totalTypes || []).map((row) => ({
        ...row,
        last30Count: lastById.get(row.id)?.count || 0,
        last30Amount: lastById.get(row.id)?.amount || 0,
    }));
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

const buildDashboardPackages = (totalRows, last30Rows, monthRows) => {
    const total = shapePackageBreakdown(totalRows);
    const last30 = shapePackageBreakdown(last30Rows);
    const months = splitMonthsByKind(monthRows);
    const kindBlock = (key) => ({
        total: { count: total[key].count, amount: total[key].amount },
        last30Days: { count: last30[key].count, amount: last30[key].amount },
        byMonth: months[key],
    });
    return {
        creditos: {
            ...kindBlock('creditos'),
            byType: attachLast30ToCreditTypes(total.creditos.byType, last30.creditos.byType),
        },
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
    
    // 1. Usuarios Nuevos por Mes (últimos 6 meses)
    const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
    
    const newUsersByMonth = await User.aggregate([
        { $match: { roles: 'cliente', createdAt: { $gte: sixMonthsAgo } } },
        { 
            $group: { 
                _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, 
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

    // 4. Clases más populares (agrupadas por tipoClase en el último mes)
    const lastMonth = subMonths(new Date(), 1);
    
    const classAssistance = await Clase.aggregate([
        { $match: { fecha: { $gte: lastMonth }, estado: { $in: ['activa', 'completada'] } } },
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

    const thirtyDaysAgo = subDays(new Date(), 30);
    const storeBase = storeSalesStages();

    const [
        packageTotal,
        packageLast30,
        packageByMonth,
        storeTotal,
        storeLast30,
        storeByMonth,
    ] = await Promise.all([
        Transaction.aggregate(packageBreakdownPipeline()),
        Transaction.aggregate(packageBreakdownPipeline({ since: thirtyDaysAgo })),
        Transaction.aggregate(packageByMonthPipeline({ since: sixMonthsAgo })),
        StoreOrder.aggregate([
            ...storeBase,
            { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amountTransferred' }, units: { $sum: '$units' } } },
        ]),
        StoreOrder.aggregate([
            ...storeBase,
            { $match: { soldAt: { $gte: thirtyDaysAgo } } },
            { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amountTransferred' }, units: { $sum: '$units' } } },
        ]),
        StoreOrder.aggregate([
            ...storeBase,
            { $match: { soldAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$soldAt' } },
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
            packages: buildDashboardPackages(packageTotal, packageLast30, packageByMonth),
            store: {
                total: firstOrEmpty(storeTotal),
                last30Days: firstOrEmpty(storeLast30),
                byMonth: storeByMonth,
            },
        },
    });
});

const getClientStats = asyncHandler(async (req, res) => {
    const { Clase, Transaction, StoreOrder } = getModels(req.gymDBConnection);
    const userId = req.params.id;

    const userObjectId = new mongoose.Types.ObjectId(userId);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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

    const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));

    const storeBase = storeSalesStages({ userId: userObjectId });

    const [
        attendanceTotalRes, attendance30Res,
        favoritesTotalRes, favorites30Res,
        activityByMonth,
        packageTotal, packageLast30,
        storeTotal, storeLast30,
    ] = await Promise.all([
        Clase.aggregate(getAttendanceQuery()),
        Clase.aggregate(getAttendanceQuery({ $gte: thirtyDaysAgo })),
        Clase.aggregate(getFavoritesQuery()),
        Clase.aggregate(getFavoritesQuery({ $gte: thirtyDaysAgo })),
        Clase.aggregate([
            { $match: { usuariosInscritos: userObjectId, fecha: { $gte: sixMonthsAgo } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$fecha" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]),
        Transaction.aggregate(packageBreakdownPipeline({ userId: userObjectId })),
        Transaction.aggregate(packageBreakdownPipeline({ userId: userObjectId, since: thirtyDaysAgo })),
        StoreOrder.aggregate([
            ...storeBase,
            { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amountTransferred' }, units: { $sum: '$units' } } },
        ]),
        StoreOrder.aggregate([
            ...storeBase,
            { $match: { soldAt: { $gte: thirtyDaysAgo } } },
            { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amountTransferred' }, units: { $sum: '$units' } } },
        ]),
    ]);

    res.json({
        totales: {
            attendanceData: attendanceTotalRes.length > 0 ? attendanceTotalRes[0] : { totalInscripciones: 0, totalAsistencias: 0 },
            favoriteClasses: favoritesTotalRes,
            packageSales: shapePackageBreakdown(packageTotal),
            storeSales: firstOrEmpty(storeTotal),
        },
        last30Days: {
            attendanceData: attendance30Res.length > 0 ? attendance30Res[0] : { totalInscripciones: 0, totalAsistencias: 0 },
            favoriteClasses: favorites30Res,
            packageSales: shapePackageBreakdown(packageLast30),
            storeSales: firstOrEmpty(storeLast30),
        },
        activityByMonth
    });
});

export { getDashboardStats, getClientStats };
