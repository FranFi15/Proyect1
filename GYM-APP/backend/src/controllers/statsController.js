import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import { subMonths, startOfMonth } from 'date-fns';

const getDashboardStats = asyncHandler(async (req, res) => {
    const { User, Clase, PaymentRequest } = getModels(req.gymDBConnection);
    
    // 1. Usuarios Nuevos por Mes (últimos 6 meses)
    const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
    
    const newUsersByMonth = await User.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
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
        { $group: { _id: "$sexo", count: { $sum: 1 } } }
    ]);

    // 3. Distribución por Edad
    const now = new Date();
    const usersForAge = await User.find({ fechaNacimiento: { $exists: true, $ne: null } }).select('fechaNacimiento');
    
    const ageDistribution = {
        '<18': 0,
        '18-25': 0,
        '26-35': 0,
        '36-50': 0,
        '50+': 0
    };

    usersForAge.forEach(u => {
        if (!u.fechaNacimiento) return;
        const ageDifMs = now - u.fechaNacimiento.getTime();
        const ageDate = new Date(ageDifMs);
        const age = Math.abs(ageDate.getUTCFullYear() - 1970);
        
        if (age < 18) ageDistribution['<18']++;
        else if (age <= 25) ageDistribution['18-25']++;
        else if (age <= 35) ageDistribution['26-35']++;
        else if (age <= 50) ageDistribution['36-50']++;
        else ageDistribution['50+']++;
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
                totalInscritos: { $sum: { $size: "$usuariosInscritos" } },
                totalClases: { $sum: 1 }
            } 
        },
        { $project: { average: { $divide: ["$totalInscritos", "$totalClases"] }, totalInscritos: 1, _id: 1 } },
        { $sort: { totalInscritos: -1 } }
    ]);

    // 5. Estado de Suscripción (Activos vs Inactivos)
    const activeUsersCount = await User.countDocuments({
        $or: [
            { paseLibreHasta: { $gte: new Date() } },
            { estadoSuscripcion: { $in: ['activo', 'periodo_prueba'] } }
        ]
    });
    const totalUsersCount = await User.countDocuments({});
    
    const activeUsersStatus = {
        activos: activeUsersCount,
        inactivos: Math.max(0, totalUsersCount - activeUsersCount)
    };

    // 6. Ingresos por Mes (PaymentRequest con estado aprobado)
    let revenueByMonth = [];
    try {
        if (PaymentRequest) {
            revenueByMonth = await PaymentRequest.aggregate([
                { $match: { estado: 'aprobado', createdAt: { $gte: sixMonthsAgo } } },
                { 
                    $group: { 
                        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, 
                        total: { $sum: "$monto" } 
                    } 
                },
                { $sort: { _id: 1 } }
            ]);
        }
    } catch (err) {
        console.error("Error al calcular ingresos por mes:", err);
    }

    res.json({
        newUsersByMonth,
        genderDistribution,
        ageDistribution,
        classAssistance,
        activeUsersStatus,
        revenueByMonth
    });
});

export { getDashboardStats };
