// src/controllers/userController.js
import getUserModel from '../models/User.js'; 
import getTipoClaseModel from '../models/TipoClase.js'; 
import getNotificationModel from '../models/Notification.js'; 
import asyncHandler from 'express-async-handler'; 
import { calculateAge } from '../utils/ageUtils.js'; 
import mongoose from 'mongoose';

// @desc    Obtener todos los usuarios (socios, profesores, etc.)
// @route   GET /api/users
// @access  Admin
const getAllUsers = asyncHandler(async (req, res) => {
    const User = getUserModel(req.gymDBConnection);
    const TipoClase = getTipoClaseModel(req.gymDBConnection); 
    
    const { role } = req.query; 
    let query = {};
    if (role) {
        query.roles = role; 
    }

    const users = await User.find(query).populate({ path: 'monthlySubscriptions.tipoClase', model: TipoClase, select: 'nombre' }); 

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
        planesFijos: Object.fromEntries(user.planesFijos || new Map()), 
        monthlySubscriptions: user.monthlySubscriptions.map(sub => ({
            _id: sub._id, 
            tipoClase: sub.tipoClase, 
            status: sub.status,
            autoRenewAmount: sub.autoRenewAmount,
            lastRenewalDate: sub.lastRenewalDate,
        })),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }));

    res.json(usersWithCalculatedAge);
});

// @desc    Obtener perfil del usuario logeado
// @route   GET /api/users/me
// @access  Authenticated User
const getMe = asyncHandler(async (req, res) => {
    const User = getUserModel(req.gymDBConnection);
    const TipoClase = getTipoClaseModel(req.gymDBConnection); 

    const user = await User.findById(req.user._id).populate({ path: 'monthlySubscriptions.tipoClase', model: TipoClase, select: 'nombre' });
    
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
            planesFijos: Object.fromEntries(user.planesFijos || new Map()), 
            monthlySubscriptions: user.monthlySubscriptions.map(sub => ({
                _id: sub._id,
                tipoClase: sub.tipoClase,
                status: sub.status,
                autoRenewAmount: sub.autoRenewAmount,
                lastRenewalDate: sub.lastRenewalDate,
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

// @desc    Obtener usuario por ID (para Admin/Teacher)
// @route   GET /api/users/:id
// @access  Admin, Teacher
const getUserById = asyncHandler(async (req, res) => {
    const User = getUserModel(req.gymDBConnection);
    const TipoClase = getTipoClaseModel(req.gymDBConnection); 

    const user = await User.findById(req.params.id).populate({ path: 'monthlySubscriptions.tipoClase', model: TipoClase, select: 'nombre' });

    if (user) {
        const requestingUserRoles = req.user.roles; 
        let userData;

        if (requestingUserRoles.includes('admin') || requestingUserRoles.includes('profesor')) {
            userData = {
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
                planesFijos: Object.fromEntries(user.planesFijos || new Map()), 
                monthlySubscriptions: user.monthlySubscriptions.map(sub => ({
                    _id: sub._id,
                    tipoClase: sub.tipoClase,
                    status: sub.status,
                    autoRenewAmount: sub.autoRenewAmount,
                    lastRenewalDate: sub.lastRenewalDate,
                })),
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            };
        } else {
            // Para otros roles (ej. 'user'), solo devuelve información básica
            userData = {
                _id: user._id,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                roles: user.roles,
                creditosPorTipo: Object.fromEntries(user.creditosPorTipo || new Map()),
                clasesInscritas: user.clasesInscritas,
            };
        }
        res.json(userData);
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
});


// @desc    Actualizar perfil de usuario por Admin
// @route   PUT /api/users/:id
// @access  Admin
const updateUserProfileByAdmin = asyncHandler(async (req, res) => {
    const User = getUserModel(req.gymDBConnection);
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

        res.json({
            _id: updatedUser._id,
            nombre: updatedUser.nombre,
            apellido: updatedUser.apellido,
            email: updatedUser.email,
            roles: updatedUser.roles,
            creditosPorTipo: Object.fromEntries(updatedUser.creditosPorTipo || new Map()),
            clasesInscritas: updatedUser.clasesInscritas,
            telefonoEmergencia: updatedUser.telefonoEmergencia,
            dni: updatedUser.dni,
            fechaNacimiento: updatedUser.fechaNacimiento,
            sexo: updatedUser.sexo,
            edad: calculateAge(updatedUser.fechaNacimiento),
            direccion: updatedUser.direccion, 
            numeroTelefono: updatedUser.numeroTelefono,
            obraSocial: updatedUser.obraSocial,
            planesFijos: Object.fromEntries(updatedUser.planesFijos || new Map()), 
            monthlySubscriptions: updatedUser.monthlySubscriptions.map(sub => ({ // Asegurar que se devuelvan
                _id: sub._id,
                tipoClase: sub.tipoClase, // No se popula aquí, solo el ID
                status: sub.status,
                autoRenewAmount: sub.autoRenewAmount,
                lastRenewalDate: sub.lastRenewalDate,
            })),
        });
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
});



// @desc    Eliminar un usuario (Admin)
// @route   DELETE /api/users/:id
// @access  Admin
const deleteUser = asyncHandler(async (req, res) => {
    const User = getUserModel(req.gymDBConnection);
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
    const User = getUserModel(req.gymDBConnection);
    const { tipoClaseId, creditsToAdd, isSubscription, autoRenewAmount } = req.body;
    const userId = req.params.id;

    if (!tipoClaseId) {
        return res.status(400).send('Se requiere un tipo de clase.');
    }

    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).send('Usuario no encontrado.');
    }

    // --- LÓGICA MEJORADA PARA SUMAR Y RESTAR ---
    if (creditsToAdd !== 0) {
        const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
        const newTotal = currentCredits + Number(creditsToAdd);

        if (newTotal < 0) {
            // Impedimos que el saldo sea negativo
            return res.status(400).json({ message: 'La operación no puede resultar en un saldo de créditos negativo.' });
        }
        user.creditosPorTipo.set(tipoClaseId, newTotal);
    }
    // 2. Gestionar la suscripción (esta lógica no cambia)
    const subscriptionIndex = user.monthlySubscriptions.findIndex(sub => sub.tipoClase.toString() === tipoClaseId);

    if (isSubscription) {
        const newSubscriptionData = {
            tipoClase: tipoClaseId,
            status: 'automatica',
            autoRenewAmount: autoRenewAmount || 8,
            lastRenewalDate: subscriptionIndex > -1 ? user.monthlySubscriptions[subscriptionIndex].lastRenewalDate : null // Mantiene la fecha si ya existía
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
    // Populamos la info para devolverla completa al frontend
    await updatedUser.populate({ path: 'monthlySubscriptions.tipoClase', select: 'nombre' });
    res.json(updatedUser);
});

const clearUserCredits = asyncHandler(async (req, res) => {
    const User = getUserModel(req.gymDBConnection);
    const user = await User.findById(req.params.id);

    if (user) {
        // Resetea el mapa de créditos a un mapa vacío
        user.creditosPorTipo = new Map();
        
        const updatedUser = await user.save();
        res.json({
            message: 'Todos los créditos del usuario han sido eliminados.',
            creditosPorTipo: Object.fromEntries(updatedUser.creditosPorTipo)
        });
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
});

const removeUserSubscription = asyncHandler(async (req, res) => {
    const User = getUserModel(req.gymDBConnection);
    const { userId, tipoClaseId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }

    // Buscamos el índice de la suscripción a eliminar
    const subscriptionIndex = user.monthlySubscriptions.findIndex(
        sub => sub.tipoClase.toString() === tipoClaseId
    );

    if (subscriptionIndex === -1) {
        res.status(404);
        throw new Error('El usuario no tiene una suscripción activa para este tipo de clase.');
    }

    // Eliminamos la suscripción del array
    user.monthlySubscriptions.splice(subscriptionIndex, 1);

    await user.save();
    res.json({ message: 'Suscripción eliminada exitosamente.' });
});

// @desc    Función lógica para enviar notificaciones de pago mensual (sería llamada por un cron job)
// @access  Interno (No expuesto directamente vía HTTP)
const triggerMonthlyPaymentNotifications = async (gymDBConnection) => {
    const User = getUserModel(gymDBConnection);
    const Notification = getNotificationModel(gymDBConnection);
    const TipoClase = getTipoClaseModel(gymDBConnection); 

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
    const User = getUserModel(req.gymDBConnection);
    const TipoClase = getTipoClaseModel(req.gymDBConnection);

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
};
