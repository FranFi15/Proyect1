import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import { subMonths, startOfMonth } from 'date-fns';

const getDashboardStats = asyncHandler(async (req, res) => {
    const { User, Clase, PaymentRequest } = getModels(req.gymDBConnection);
    
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

    res.json({
        newUsersByMonth,
        genderDistribution,
        ageDistribution,
        classAssistance
    });
});

const getClientStats = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const userId = req.params.id;
    
    const mongoose = (await import('mongoose')).default;
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

    const [
        attendanceTotalRes, attendance30Res, 
        favoritesTotalRes, favorites30Res, 
        activityByMonth
    ] = await Promise.all([
        Clase.aggregate(getAttendanceQuery()),
        Clase.aggregate(getAttendanceQuery({ $gte: thirtyDaysAgo })),
        Clase.aggregate(getFavoritesQuery()),
        Clase.aggregate(getFavoritesQuery({ $gte: thirtyDaysAgo })),
        Clase.aggregate([
            { $match: { usuariosInscritos: userObjectId, fecha: { $gte: sixMonthsAgo } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$fecha" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ])
    ]);

    res.json({
        totales: {
            attendanceData: attendanceTotalRes.length > 0 ? attendanceTotalRes[0] : { totalInscripciones: 0, totalAsistencias: 0 },
            favoriteClasses: favoritesTotalRes
        },
        last30Days: {
            attendanceData: attendance30Res.length > 0 ? attendance30Res[0] : { totalInscripciones: 0, totalAsistencias: 0 },
            favoriteClasses: favorites30Res
        },
        activityByMonth
    });
});

export { getDashboardStats, getClientStats };
