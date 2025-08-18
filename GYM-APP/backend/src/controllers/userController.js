// src/controllers/userController.js
import getModels from '../utils/getModels.js';
import asyncHandler from 'express-async-handler'; 
import { calculateAge } from '../utils/ageUtils.js'; 
import mongoose from 'mongoose';
import { sendSingleNotification } from './notificationController.js';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { updateClientCount, getClientSubscriptionInfo, upgradeClientPlan, checkClientLimit } from '../utils/superAdminApiClient.js';


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
        ordenMedicaRequerida: user.ordenMedicaRequerida,
        ordenMedicaEntregada: user.ordenMedicaEntregada,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }));
    res.json(usersWithCalculatedAge);
});

const getMe = asyncHandler(async (req, res) => {
    const { User , Notification } = getModels(req.gymDBConnection);
    // Fetch the user. Ensure 'requestedSpotNotifications' is included.
    // If you use .select(), make sure to include the fields you need,
    // or simply don't use .select() for inclusion if you want all fields by default.
    const user = await User.findById(req.user._id)
        .populate({ path: 'monthlySubscriptions.tipoClase', select: 'nombre' })
        .populate({ path: 'planesFijos.tipoClase', select: 'nombre' });
    
    if (user) {
        const unreadNotificationsCount = await Notification.countDocuments({
            user: user._id,
            read: false
        });
        const admin = await User.findOne({ roles: 'admin' });
        const adminPhoneNumber = admin ? admin.numeroTelefono : null;

        const userProfile = {
            _id: user._id,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            roles: user.roles,
            balance: user.balance,
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
            })),
            pushToken: user.pushToken, 
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            requestedSpotNotifications: user.requestedSpotNotifications || [], 
            adminPhoneNumber: adminPhoneNumber,
            unreadNotificationsCount: unreadNotificationsCount,
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


const updateUserProfileByAdmin = asyncHandler(async (req, res) => {
    const {User} = getModels(req.gymDBConnection);

    const user = await User.findById(req.params.id);

    if (user) {
        const wasClient = user.roles.includes('cliente');

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


        if (req.body.ordenMedicaRequerida !== undefined) {
            user.ordenMedicaRequerida = req.body.ordenMedicaRequerida;
        }
        if (req.body.ordenMedicaEntregada !== undefined) {
            user.ordenMedicaEntregada = req.body.ordenMedicaEntregada;
        }

        if (req.body.planesFijos && typeof req.body.planesFijos === 'object' && !Array.isArray(req.body.planesFijos)) {
            user.planesFijos = new Map(Object.entries(req.body.planesFijos));
        }

        let isNowClient = wasClient;

        if (req.body.roles && Array.isArray(req.body.roles)) {
            const validRoles = ['cliente', 'admin', 'profesor'];
            const newRoles = req.body.roles.filter(role => validRoles.includes(role));
            if (newRoles.length > 0) { 
                user.roles = newRoles;
                isNowClient = user.roles.includes('cliente');
            } else {
                res.status(400);
                throw new Error('Roles proporcionados inválidos.');
            }
        }

        if (req.body.contraseña) { 
            user.contraseña = req.body.contraseña; 
        }

        if (!wasClient && isNowClient) {
            const hasSpace = await checkClientLimit(req.gymId, req.apiSecretKey);
            if (!hasSpace) {
                res.status(403);
                throw new Error('No se puede cambiar el rol a "cliente" porque el gimnasio ha alcanzado su límite de socios activos.');
            }
        }

        const updatedUser = await user.save(); 

        if (!wasClient && isNowClient) {
            updateClientCount(req.gymId, req.apiSecretKey, 'increment');
        } else if (wasClient && !isNowClient) {
            updateClientCount(req.gymId, req.apiSecretKey, 'decrement');
        }

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
        const wasClient = user.roles.includes('cliente'); 

        await user.deleteOne();

        if (wasClient) {
            updateClientCount(req.gymId, req.apiSecretKey, 'decrement');
        }

        res.json({ message: 'Usuario eliminado correctamente.' });
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
});

const deleteMyAccount = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const user = await User.findById(req.user._id);

    if (user) {
        const wasClient = user.roles.includes('cliente');
        
        await user.deleteOne();
        if (wasClient) {
            updateClientCount(req.gymId, req.apiSecretKey, 'decrement');
        }

        res.json({ message: 'Tu cuenta ha sido eliminada exitosamente.' });
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
});

const updateUserPlan = asyncHandler(async (req, res) => {
    const { User, CreditLog, TipoClase, Notification, Transaction } = getModels(req.gymDBConnection);
    const { tipoClaseId, creditsToAdd, isSubscription, autoRenewAmount } = req.body;
    const userId = req.params.id;
    const adminId = req.user._id;

    if (!tipoClaseId) {
        return res.status(400).send('Se requiere un tipo de turno.');
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).send('Usuario no encontrado.');
    
    const tipoClase = await TipoClase.findById(tipoClaseId);
    if (!tipoClase) return res.status(404).send('Tipo de turno no encontrado.');

    // --- LÓGICA PARA AÑADIR CRÉDITOS Y GENERAR CARGO ---
    if (creditsToAdd !== undefined && Number(creditsToAdd) !== 0) {
        const creditsToAddNum = Number(creditsToAdd);
        
        // Lógica de validación de créditos (sin cambios)
        // ...

        const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
        const newTotal = currentCredits + creditsToAddNum;

        if (newTotal < 0) {
            return res.status(400).json({ message: 'La operación resultaría en un saldo de créditos negativo.' });
        }
        
        user.creditosPorTipo.set(tipoClaseId, newTotal);
        
        // --- CORRECCIÓN DE LÓGICA DE CARGO AUTOMÁTICO ---
        if (creditsToAddNum > 0 && tipoClase.price > 0) {
            const chargeAmount = tipoClase.price * creditsToAddNum; 
            // RESTAMOS el cargo para que la deuda sea negativa
            user.balance -= chargeAmount;

            await Transaction.create({
                user: userId,
                type: 'charge',
                amount: chargeAmount,
                description: `Cargo por ${creditsToAddNum} crédito(s) de ${tipoClase.nombre}`,
                createdBy: adminId,
            });
            console.log(`Cargo de $${chargeAmount} generado para ${user.email} por ${creditsToAddNum} crédito(s).`);
        }
        // --- FIN DE LA CORRECCIÓN ---

        await CreditLog.create({
            user: userId, admin: adminId, amount: creditsToAddNum,
            tipoClase: tipoClaseId, newBalance: newTotal,
            reason: 'ajuste_manual_admin', details: `Ajuste manual desde panel de admin.`
        });

        const title = "Actualización de Créditos";
        const message = creditsToAddNum > 0 
            ? `Se te han acreditado ${creditsToAddNum} créditos para ${tipoClase.nombre}.`
            : `Se han descontado ${Math.abs(creditsToAddNum)} créditos de ${tipoClase.nombre}.`;
        
        await sendSingleNotification(Notification, User, userId, title, message, 'credit_update', false);
    }

    // --- LÓGICA PARA SUSCRIPCIONES (sin cambios en el cargo, ya que es un precio fijo) ---
    const subscriptionIndex = user.monthlySubscriptions.findIndex(sub => sub.tipoClase.toString() === tipoClaseId);
    if (isSubscription) {
        const newSubscriptionData = { tipoClase: tipoClaseId, status: 'automatica', autoRenewAmount: autoRenewAmount || 8, lastRenewalDate: subscriptionIndex > -1 ? user.monthlySubscriptions[subscriptionIndex].lastRenewalDate : null };
        if (subscriptionIndex > -1) {
            user.monthlySubscriptions[subscriptionIndex] = newSubscriptionData;
        } else {
            user.monthlySubscriptions.push(newSubscriptionData);
            
            if (tipoClase.price > 0) {
                const chargeAmount = tipoClase.price;
                // RESTAMOS el cargo para que la deuda sea negativa
                user.balance -= chargeAmount;

                await Transaction.create({
                    user: userId,
                    type: 'charge',
                    amount: chargeAmount,
                    description: `Cargo por suscripción a ${tipoClase.nombre}`,
                    createdBy: adminId,
                });
                console.log(`Cargo de $${chargeAmount} generado para ${user.email} por nueva suscripción.`);
            }

            const title = "Suscripción Activada";
            const message = `Te has suscrito al plan mensual de ${tipoClase.nombre}. Recibirás ${autoRenewAmount} créditos cada mes.`;
            await sendSingleNotification(Notification, User, userId, title, message, 'subscription_activated', false);
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


const subscribeUserToPlan = asyncHandler(async (req, res) => {
    const { Clase, User, TipoClase, Notification } = getModels(req.gymDBConnection);
    const { tipoClaseId, diasDeSemana, fechaInicio, horaInicio, horaFin } = req.body;
    let { fechaFin } = req.body;
    const userId = req.params.id;

    if (!fechaFin) {
        fechaFin = fechaInicio;
    }

    if (!tipoClaseId || !diasDeSemana || !fechaInicio || !horaInicio) {
        res.status(400);
        throw new Error('Faltan datos para la inscripción al plan.');
    }

    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
    
    const tipoClase = await TipoClase.findById(tipoClaseId);
    if (!tipoClase) {
        res.status(404);
        throw new Error('Tipo de turno no encontrado.');
    }

    const classesToEnroll = await Clase.find({
        tipoClase: tipoClaseId,
        diaDeSemana: { $in: diasDeSemana },
        horaInicio: horaInicio,
        fecha: { $gte: new Date(`${fechaInicio}T00:00:00Z`), $lte: new Date(`${fechaFin}T23:59:59Z`) },
        estado: 'activa'
    });

    if (classesToEnroll.length === 0) {
        res.status(404);
        throw new Error('No se encontraron turnos activos que coincidan con los criterios del plan.');
    }

    // --- LÓGICA CORREGIDA: VERIFICACIÓN DE CUPO SIN CRÉDITOS ---

    // 1. Verificar que haya cupo en TODAS las clases del plan ANTES de inscribir.
    for (const classInstance of classesToEnroll) {
        if (classInstance.usuariosInscritos.length >= classInstance.capacidad) {
            const classDate = new Date(classInstance.fecha).toLocaleDateString('es-AR');
            res.status(400);
            throw new Error(`No se puede inscribir al plan. Los turnos del día ${classDate} a las ${classInstance.horaInicio} está lleno.`);
        }
        if (classInstance.usuariosInscritos.includes(userId)) {
            const classDate = new Date(classInstance.fecha).toLocaleDateString('es-AR');
            res.status(400);
            throw new Error(`El usuario ya está inscrito en el turno del ${classDate}.`);
        }
    }

    // 2. Si hay cupo en todas, proceder a la inscripción.
    let enrolledCount = 0;
    for (const classInstance of classesToEnroll) {
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

    // 3. Guardar la definición del plan en el perfil del usuario para referencia.
    const planDefinition = {
        tipoClase: tipoClaseId,
        diasDeSemana,
        horaInicio,
        horaFin,
        fechaInicio: new Date(`${fechaInicio}T00:00:00Z`),
        fechaFin: new Date(`${fechaFin}T23:59:59Z`),
    };
    user.planesFijos.push(planDefinition);
    await user.save();

    // 4. Notificar al usuario sobre su nuevo plan.
    const title = "¡Inscripción a Plan Exitosa!";
    const message = `Has sido inscrito en un nuevo plan para los turnos de ${tipoClase.nombre} los días ${diasDeSemana.join(', ')} a las ${horaInicio}hs. Hasta el ${fechaFin}.`;
    await sendSingleNotification(Notification, User, userId, title, message, 'plan_enrollment', false);

    res.status(200).json({
        message: `Inscripción masiva completada. El usuario fue añadido a ${enrolledCount} turnos.`
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

 

const updateUserPushToken = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const { token } = req.body;

    const user = await User.findById(req.user._id);

    if (user) {
        user.pushToken = token;
        await user.save();
        res.status(200).json({ message: 'Push token actualizado' });
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado');
    }
});
const forgotPassword = asyncHandler(async (req, res, next) => {
    const { User } = getModels(req.gymDBConnection);
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
        // No revelamos si el usuario existe por seguridad.
        return res.status(200).json({ message: 'Si el correo está registrado, recibirás un enlace.' });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const clientId = req.gymId;

    // --- CAMBIO CLAVE ---
    // 1. La variable de entorno ahora debe ser la URL base de tu backend.
    //    Ej: BACKEND_URL=https://api.tu-gym.com
    // 2. Construimos un enlace web (https) que apunta a nuestro propio backend.
    const webResetUrl = `${process.env.BACKEND_URL}/api/public/users/handle-reset-link/${resetToken}?clientId=${clientId}`;

    const message = `
        <h1>Has solicitado un reseteo de contraseña</h1>
        <p>Haz clic en el siguiente enlace para establecer una nueva contraseña (válido por 10 minutos):</p>
        <p>
            <a href="${webResetUrl}" clicktracking="off" style="color: #ffffff; background-color: #007bff; padding: 10px 15px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Resetear Contraseña
            </a>
        </p>
        <p style="font-size: 12px;">Si el botón no funciona, copia y pega la siguiente URL en tu navegador:</p>
        <p style="font-size: 12px; word-break: break-all;">${webResetUrl}</p>
    `;

    try {
        await sendPasswordResetEmail({
            to: user.email,
            subject: 'Instrucciones para Resetear tu Contraseña',
            html: message,
        });

        res.status(200).json({ success: true, data: 'Email enviado' });

    } catch (err) {
        console.error(err);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });

        res.status(503).json({
            success: false,
            message: 'El servicio de correo no está disponible en este momento. Por favor, inténtalo de nuevo más tarde.'
        });
    }
});
const resetPassword = asyncHandler(async (req, res, next) => {
    const { User } = getModels(req.gymDBConnection);

    // 1. Hashea el token que viene de la URL para poder compararlo con el de la BD
    const resetPasswordToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

    // 2. Busca al usuario que tenga ese token y que no haya expirado
    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }, // $gt -> "greater than" (mayor que)
    });

    if (!user) {
        res.status(400);
        throw new Error('El token es inválido o ha expirado.');
    }

    // 3. Establece la nueva contraseña y limpia los campos de reseteo
    user.contraseña = req.body.password; // La contraseña se hashea automáticamente por el hook 'pre-save' del modelo
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Contraseña actualizada con éxito.',
    });
});
const handleResetLink = asyncHandler(async (req, res, next) => {
    const { resettoken } = req.params;
    const { clientId } = req.query;

    // 1. La variable de entorno ahora debe ser el schema y la ruta de tu app.
    //    Ej: MOBILE_APP_SCHEMA=movil-app://reset-password
    if (!process.env.MOBILE_APP_SCHEMA) {
        console.error('La variable de entorno MOBILE_APP_SCHEMA no está definida.');
        // Puedes redirigir a una página de error web si lo deseas.
        return res.status(500).send('Error de configuración del servidor.');
    }
    
    // 2. Construimos el deep link final al que queremos que el usuario llegue.
    const deepLink = `${process.env.MOBILE_APP_SCHEMA}/${resettoken}?clientId=${clientId}`;

    // 3. Enviamos una redirección HTTP 302.
    //    El navegador del usuario recibirá esto e intentará abrir el deep link.
    res.redirect(302, deepLink);
});

const requestPlanUpgrade = asyncHandler(async (req, res) => {
    const result = await upgradeClientPlan(req.gymId, req.apiSecretKey);
    res.json(result);
});

const getSubscriptionInfo = asyncHandler(async (req, res) => {
    const subInfo = await getClientSubscriptionInfo(req.gymId, req.apiSecretKey);
    res.json(subInfo);
});

export {
    getAllUsers,
    getUserById,
    getMe,
    deleteUser,
    deleteMyAccount,
    updateUserProfileByAdmin,
    updateUserPlan, 
    triggerMonthlyPaymentNotifications, 
    clearUserCredits,
    removeUserSubscription,
    subscribeUserToPlan,
    removeFixedPlan,
    getUserProfile,
    updateUserProfile,
    changeUserPassword,
    updateUserPushToken,
    forgotPassword,
    resetPassword,
    handleResetLink,
    requestPlanUpgrade,
    getSubscriptionInfo,
};
