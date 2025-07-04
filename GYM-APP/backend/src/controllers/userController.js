// src/controllers/userController.js
import getModels from '../utils/getModels.js';
import asyncHandler from 'express-async-handler'; 
import { calculateAge } from '../utils/ageUtils.js'; 
import mongoose from 'mongoose';

const getAllUsers = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const { role } = req.query;
    let query = {};
    if (role) {
        query.roles = role;
    }

    const users = await User.find(query)
        .populate({ path: 'monthlySubscriptions.tipoClase', select: 'nombre' })
        .populate({ path: 'planesFijos.tipoClase', select: 'nombre' });

    const usersWithCalculatedAge = users.map(user => ({
        _id: user._id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        roles: user.roles,
        creditosPorTipo: Object.fromEntries(user.creditosPorTipo || new Map()),
        clasesInscritas: user.clasesInscritas,
        telefonoEmergencia: user.telefonoEmergencia,
        dni: user.dni,
        fechaNacimiento: user.fechaNacimiento,
        sexo: user.sexo,
        edad: user.fechaNacimiento ? calculateAge(user.fechaNacimiento) : 'N/A',
        direccion: user.direccion,
        numeroTelefono: user.numeroTelefono,
        obraSocial: user.obraSocial,
        planesFijos: user.planesFijos || [],
        monthlySubscriptions: user.monthlySubscriptions || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }));
    res.json(usersWithCalculatedAge);
});

const getMe = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const user = await User.findById(req.user._id)
        .populate({ path: 'monthlySubscriptions.tipoClase', select: 'nombre' })
        .populate({ path: 'planesFijos.tipoClase', select: 'nombre' });
    
    if (user) {
        const userProfile = {
            _id: user._id,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            roles: user.roles,
            creditosPorTipo: Object.fromEntries(user.creditosPorTipo || new Map()),
            clasesInscritas: user.clasesInscritas,
            telefonoEmergencia: user.telefonoEmergencia,
            dni: user.dni,
            fechaNacimiento: user.fechaNacimiento,
            sexo: user.sexo,
            edad: user.fechaNacimiento ? calculateAge(user.fechaNacimiento) : 'N/A',
            direccion: user.direccion,
            numeroTelefono: user.numeroTelefono,
            obraSocial: user.obraSocial,
            planesFijos: user.planesFijos || [],
            monthlySubscriptions: user.monthlySubscriptions.map(sub => ({
                _id: sub._id,
                tipoClase: sub.tipoClase,
                status: sub.status,
                autoRenewAmount: sub.autoRenewAmount,
                lastRenewalDate: sub.lastRenewalDate,
                startDate: sub.startDate,
            })),
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
        res.json(userProfile);
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
});

const getUserById = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const user = await User.findById(req.params.id).populate({ path: 'monthlySubscriptions.tipoClase', select: 'nombre' });
    if (user) {
        res.json(user);
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
});


// @desc    Actualizar perfil de usuario por Admin
// @route   PUT /api/users/:id
// @access  Admin
const updateUserProfileByAdmin = asyncHandler(async (req, res) => {
    const {User} = getModels(req.gymDBConnection);

    const user = await User.findById(req.params.id);

    if (user) {
        user.nombre = req.body.nombre !== undefined ? req.body.nombre : user.nombre;
        user.apellido = req.body.apellido !== undefined ? req.body.apellido : user.apellido;
        user.email = req.body.email !== undefined ? req.body.email : user.email;
        user.telefonoEmergencia = req.body.telefonoEmergencia !== undefined ? req.body.telefonoEmergencia : user.telefonoEmergencia;
        user.dni = req.body.dni !== undefined ? req.body.dni : user.dni;
        user.fechaNacimiento = req.body.fechaNacimiento ? new Date(req.body.fechaNacimiento) : user.fechaNacimiento;
        user.sexo = req.body.sexo !== undefined ? req.body.sexo : user.sexo;
        user.direccion = req.body.direccion !== undefined ? req.body.direccion : user.direccion;
        user.numeroTelefono = req.body.numeroTelefono !== undefined ? req.body.numeroTelefono : user.numeroTelefono;
        user.obraSocial = req.body.obraSocial !== undefined ? req.body.obraSocial : user.obraSocial;

        if (req.body.planesFijos && typeof req.body.planesFijos === 'object' && !Array.isArray(req.body.planesFijos)) {
            user.planesFijos = new Map(Object.entries(req.body.planesFijos));
        }

        if (req.body.roles && Array.isArray(req.body.roles)) {
            const validRoles = ['cliente', 'admin', 'profesor'];
            const newRoles = req.body.roles.filter(role => validRoles.includes(role));
            if (newRoles.length > 0) { 
                user.roles = newRoles;
            } else {
                res.status(400);
                throw new Error('Roles proporcionados inválidos.');
            }
        }

        if (req.body.contraseña) { 
            user.contraseña = req.body.contraseña; 
        }

        const updatedUser = await user.save(); 

        res.json(updatedUser);
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
});



const deleteUser = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const user = await User.findById(req.params.id);
    if (user) {
        await user.deleteOne();
        res.json({ message: 'Usuario eliminado correctamente.' });
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
});


const updateUserPlan = asyncHandler(async (req, res) => {
    const { User, CreditLog } = getModels(req.gymDBConnection);
    const { tipoClaseId, creditsToAdd, isSubscription, autoRenewAmount } = req.body;
    const userId = req.params.id;
    const adminId = req.user._id;

    if (!tipoClaseId) {
        return res.status(400).send('Se requiere un tipo de clase.');
    }

    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).send('Usuario no encontrado.');
    }

    if (creditsToAdd !== undefined && Number(creditsToAdd) !== 0) {
        const creditsToAddNum = Number(creditsToAdd);
        const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
        const newTotal = currentCredits + creditsToAddNum;

        if (newTotal < 0) {
            return res.status(400).json({ message: 'La operación no puede resultar en un saldo negativo.' });
        }
        user.creditosPorTipo.set(tipoClaseId, newTotal);

        await CreditLog.create({
            user: userId,
            admin: adminId,
            amount: creditsToAddNum,
            tipoClase: tipoClaseId,
            newBalance: newTotal,
            reason: 'ajuste_manual_admin',
            details: `Ajuste manual desde el panel de administrador.`
        });
    }

    const subscriptionIndex = user.monthlySubscriptions.findIndex(sub => sub.tipoClase.toString() === tipoClaseId);

    if (isSubscription) {
        const newSubscriptionData = {
            tipoClase: tipoClaseId,
            status: 'automatica',
            autoRenewAmount: autoRenewAmount || 8,
            startDate: subscriptionIndex > -1 ? user.monthlySubscriptions[subscriptionIndex].startDate : new Date(),
            lastRenewalDate: subscriptionIndex > -1 ? user.monthlySubscriptions[subscriptionIndex].lastRenewalDate : null,
        };
        if (subscriptionIndex > -1) {
            user.monthlySubscriptions[subscriptionIndex] = newSubscriptionData;
        } else {
            user.monthlySubscriptions.push(newSubscriptionData);
        }
    } else {
        if (subscriptionIndex > -1) {
            user.monthlySubscriptions.splice(subscriptionIndex, 1);
        }
    }

    const updatedUser = await user.save();
    await updatedUser.populate({ path: 'monthlySubscriptions.tipoClase', select: 'nombre' });
    res.json(updatedUser);
});

const clearUserCredits = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const user = await User.findById(req.params.id);
    if (user) {
        user.creditosPorTipo = new Map();
        await user.save();
        res.json({ message: 'Todos los créditos del usuario han sido eliminados.' });
    } else {
        res.status(404).send('Usuario no encontrado.');
    }
});

const removeUserSubscription = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const { userId, tipoClaseId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
        res.status(404).send('Usuario no encontrado.');
        return;
    }
    const subscriptionIndex = user.monthlySubscriptions.findIndex(sub => sub.tipoClase.toString() === tipoClaseId);
    if (subscriptionIndex > -1) {
        user.monthlySubscriptions.splice(subscriptionIndex, 1);
        await user.save();
        res.json({ message: 'Suscripción eliminada exitosamente.' });
    } else {
        res.status(404).send('Suscripción no encontrada.');
    }
});

// @desc    Función lógica para enviar notificaciones de pago mensual (sería llamada por un cron job)
// @access  Interno (No expuesto directamente vía HTTP)
const triggerMonthlyPaymentNotifications = async (req, res) => {
    const {TipoClase, User, Notification } = getModels(req.gymDBConnection);

    const users = await User.find({
        'monthlySubscriptions.status': 'automatica' 
    }).populate({ path: 'monthlySubscriptions.tipoClase', model: TipoClase, select: 'nombre' });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const user of users) {
        for (const subscription of user.monthlySubscriptions) {
            if (subscription.status === 'automatica') {
                if (!subscription.lastRenewalDate || subscription.lastRenewalDate < startOfMonth) {
                    if (!user.creditosPorTipo || !(user.creditosPorTipo instanceof Map)) {
                        user.creditosPorTipo = new Map();
                    }
                    const currentCredits = user.creditosPorTipo.get(subscription.tipoClase._id.toString()) || 0;
                    user.creditosPorTipo.set(subscription.tipoClase._id.toString(), currentCredits + subscription.autoRenewAmount);
                    subscription.lastRenewalDate = now; 
                    
                    const notificationMessage = `Recordatorio de pago: Se ha acreditado ${subscription.autoRenewAmount} créditos para "${subscription.tipoClase.nombre}" en tu plan automático. Por favor, realiza el pago correspondiente.`;
                    await Notification.create({
                        user: user._id,
                        message: notificationMessage,
                        type: 'monthly_payment_reminder',
                        class: undefined, 
                    });
                    console.log(`Notificación de pago mensual enviada a ${user.email} para ${subscription.tipoClase.nombre}.`);
                }
            }
        }
        await user.save(); 
    }
};

const getUserMetrics = asyncHandler(async (req, res) => {
    const { TipoClase, User } = getModels(req.gymDBConnection);

    // 1. Distribución por Sexo (sin cambios, ya estaba bien)
    const genderDistribution = await User.aggregate([
        { $match: { roles: 'cliente' } },
        { $match: { sexo: { $in: ['Masculino', 'Femenino', 'Otro'] } } },
        { $group: { _id: '$sexo', count: { $sum: 1 } } },
        { $project: { name: '$_id', value: '$count', _id: 0 } }
    ]);

    // 2. Distribución por Edad (LÓGICA CORREGIDA Y MEJORADA)
    const ageDistribution = await User.aggregate([
        { $match: {  roles: 'cliente', fechaNacimiento: { $exists: true, $ne: null } } },
        { 
            $addFields: {
                age: {
                    $divide: [
                        { $subtract: [ new Date(), "$fechaNacimiento" ] },
                        (365 * 24 * 60 * 60 * 1000) // milisegundos en un año
                    ]
                }
            }
        },
        {
            $bucket: {
                groupBy: "$age",
                boundaries: [ 0, 18, 26, 36, 46, 65, 120 ],
                default: "Otro",
                output: { "count": { $sum: 1 } }
            }
        },
        { 
            $project: { 
                name: {
                    $switch: {
                       branches: [
                          { case: { $eq: [ "$_id", 0 ] }, then: "<18" },
                          { case: { $eq: [ "$_id", 18 ] }, then: "18-25" },
                          { case: { $eq: [ "$_id", 26 ] }, then: "26-35" },
                          { case: { $eq: [ "$_id", 36 ] }, then: "36-45" },
                          { case: { $eq: [ "$_id", 46 ] }, then: "46-65" },
                          { case: { $eq: [ "$_id", 65 ] }, then: "65+" },
                       ],
                       default: "Otro"
                    }
                }, 
                value: '$count',
                _id: 0
            }
        }
    ]);

    // 3. Créditos totales por tipo de clase (sin cambios, ya estaba bien)
    const creditsPerClassType = await User.aggregate([
        { $match: { roles: 'cliente' } },
        { $project: { creditosArray: { $objectToArray: "$creditosPorTipo" } } },
        { $unwind: "$creditosArray" },
        { $group: { _id: "$creditosArray.k", totalCredits: { $sum: "$creditosArray.v" } } },
        { $lookup: { from: TipoClase.collection.name, localField: "_id", foreignField: "_id", as: "classTypeInfo" } },
        { $unwind: "$classTypeInfo" },
        { $project: { name: "$classTypeInfo.nombre", value: "$totalCredits", _id: 0 } }
    ]);
    
    // 4. Nuevos socios por mes (sin cambios, ya estaba bien)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const newClientsPerMonth = await User.aggregate([
        { $match: { roles: 'cliente', createdAt: { $gte: oneYearAgo } } },
        { $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            count: { $sum: 1 }
        }},
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $project: { 
            name: { $concat: [ { $toString: "$_id.month" }, "/", { $toString: "$_id.year" } ] },
            value: "$count", 
            _id: 0 
        }}
    ]);

    res.json({
        genderDistribution,
        ageDistribution,
        creditsPerClassType,
        newClientsPerMonth
    });
});

const subscribeUserToPlan = asyncHandler(async (req, res) => {
    const { Clase, User } = getModels(req.gymDBConnection);

    // 1. AÑADIMOS 'horaInicio' A LOS DATOS RECIBIDOS
    const { tipoClaseId, diasDeSemana, fechaInicio, fechaFin, horaInicio, horaFin } = req.body;
    const userId = req.params.id;

    // 2. VALIDACIÓN ACTUALIZADA
    if (!tipoClaseId || !diasDeSemana || !fechaInicio || !fechaFin || !horaInicio) {
        res.status(400);
        throw new Error('Faltan datos: tipo de clase, días, rango de fechas y horario son requeridos.');
    }

    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }

    // 3. BÚSQUEDA ACTUALIZADA para ser más específica
    const classesToEnroll = await Clase.find({
        tipoClase: tipoClaseId,
        diaDeSemana: { $in: diasDeSemana },
        horaInicio: horaInicio, // <-- FILTRO CLAVE: Busca solo el horario exacto
        fecha: {
            $gte: new Date(`${fechaInicio}T00:00:00Z`),
            $lte: new Date(`${fechaFin}T23:59:59Z`),
        },
        estado: 'activa'
    });

    if (classesToEnroll.length === 0) {
        res.status(404);
        throw new Error('No se encontraron clases que coincidan con los criterios exactos (días, fechas y horario).');
    }

    // El resto de la función se mantiene igual, ya que ahora solo procesará las clases del horario correcto.
    let enrolledCount = 0;
    for (const classInstance of classesToEnroll) {
        if (!classInstance.usuariosInscritos.includes(userId) && classInstance.usuariosInscritos.length < classInstance.capacidad) {
            classInstance.usuariosInscritos.push(userId);

            if (classInstance.usuariosInscritos.length >= classInstance.capacidad) {
                classInstance.estado = 'llena';
            }
            await classInstance.save();

            if (!user.clasesInscritas.includes(classInstance._id)) {
                user.clasesInscritas.push(classInstance._id);
            }
            enrolledCount++;
        }
    }

    const planDefinition = {
    tipoClase: tipoClaseId,
    diasDeSemana,
    horaInicio,
    horaFin, 
    fechaInicio: new Date(`${fechaInicio}T00:00:00Z`),
    fechaFin: new Date(`${fechaFin}T23:59:59Z`),
};

user.planesFijos.push(planDefinition);
await user.save(); // Este save ahora guarda también el plan fijo

res.status(200).json({ // El resto se mantiene
    message: `Inscripción masiva completada. El usuario fue añadido a ${enrolledCount} clases.`
});
});
const removeFixedPlan = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const { userId, planId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }

    // --- LÓGICA A PRUEBA DE ERRORES ---
    // 1. Verificamos si 'planesFijos' es un array.
    if (Array.isArray(user.planesFijos)) {
        // 2. Si es un array, usamos .filter() para crear uno nuevo sin el plan a eliminar.
        //    Esto es más seguro que .pull() con datos potencialmente inconsistentes.
        user.planesFijos = user.planesFijos.filter(
            (plan) => plan._id.toString() !== planId
        );
    } else {
        // 3. Si no es un array (es un dato antiguo), simplemente lo ignoramos o lo reseteamos.
        //    De esta forma, la operación nunca falla.
        console.warn(`El usuario ${userId} tenía un campo 'planesFijos' con formato incorrecto. Se ha ignorado.`);
    }

    await user.save();
    res.status(200).json({ message: 'Plan de horario fijo eliminado.' });
});
// @desc    Obtener el perfil del usuario logueado
// @route   GET /api/users/me
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const user = await User.findById(req.user._id).select('-contraseña');
    if (user) {
        res.json(user);
    } else {
        res.status(404).send('Usuario no encontrado.');
    }
});

// @desc    Actualizar el perfil del usuario
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const user = await User.findById(req.user._id);

    if (user) {
        // Actualizamos todos los campos que pueden venir del formulario
        user.nombre = req.body.nombre || user.nombre;
        user.apellido = req.body.apellido || user.apellido;
        user.email = req.body.email || user.email;
        user.dni = req.body.dni || user.dni;
        user.fechaNacimiento = req.body.fechaNacimiento || user.fechaNacimiento;
        user.sexo = req.body.sexo || user.sexo;
        user.numeroTelefono = req.body.numeroTelefono || user.numeroTelefono;
        user.obraSocial = req.body.obraSocial || user.obraSocial;
        user.telefonoEmergencia = req.body.telefonoEmergencia || user.telefonoEmergencia;
        user.direccion = req.body.direccion || user.direccion;
        
        const updatedUser = await user.save();
        
        res.json({
            _id: updatedUser._id,
            nombre: updatedUser.nombre,
            apellido: updatedUser.apellido,
            email: updatedUser.email,
            // Devuelve todos los datos actualizados que necesites en el frontend
        });
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado');
    }
});

const changeUserPassword = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const user = await User.findById(req.user._id);
    const { currentPassword, newPassword } = req.body;
    if (user && (await user.matchPassword(currentPassword))) {
        user.contraseña = newPassword;
        await user.save();
        res.json({ message: 'Contraseña actualizada con éxito.' });
    } else {
        res.status(401).send('La contraseña actual es incorrecta.');
    }
});


export {
    getAllUsers,
    getUserById,
    getMe,
    deleteUser,
    updateUserProfileByAdmin,
    updateUserPlan, 
    triggerMonthlyPaymentNotifications, 
    getUserMetrics,
    clearUserCredits,
    removeUserSubscription,
    subscribeUserToPlan,
    removeFixedPlan,
    getUserProfile,
    updateUserProfile,
    changeUserPassword,
};
