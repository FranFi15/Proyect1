import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import admin from 'firebase-admin';

const sendSingleNotification = async (NotificationModel, UserModel, userId, title, message, type, isImportant, classId = null) => {
    // 1. Crear la notificación en la base de datos (lógica existente)
    const notificacionInApp = await NotificationModel.create({
        user: userId,
        title,
        message,
        type: type || 'general',
        class: classId,
        read: false,
        isImportant: isImportant || false,
    });

    // 2. Intentar enviar la notificación Push
    try {
        const user = await UserModel.findById(userId).select('pushToken');
        
        if (user && user.pushToken) {
            const payload = {
                notification: {
                    title: title,
                    body: message,
                },
                token: user.pushToken,
                android: {
                    notification: {
                        sound: 'default'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default'
                        }
                    }
                }
            };

            // Enviar el mensaje usando el SDK de Firebase Admin
            await admin.messaging().send(payload);
            console.log(`Notificación push enviada exitosamente al usuario ${userId}`);
        }
    } catch (error) {
        console.error(`Falló el envío de notificación push para el usuario ${userId}:`, error);
        // Si el token es inválido, podríamos limpiarlo de la base de datos
        if (error.code === 'messaging/registration-token-not-registered') {
            const userToUpdate = await UserModel.findById(userId);
            if (userToUpdate) {
                userToUpdate.pushToken = undefined;
                await userToUpdate.save();
            }
        }
    }

    return notificacionInApp;
};


const createNotification = asyncHandler(async (req, res) => {
    const { Notification, User, Clase } = getModels(req.gymDBConnection);
    const { title, message, type, isImportant, targetType, targetId, targetRole } = req.body;

    if (!title || !message || !targetType) {
        res.status(400);
        throw new Error('El título, el mensaje y el tipo de destinatario (targetType) son obligatorios.');
    }

    let usuariosDestino = [];
    switch (targetType) {
        case 'all':
            usuariosDestino = await User.find({}, '_id pushToken');
            break;
        case 'user':
            if (!targetId) { res.status(400); throw new Error('Se requiere un "targetId" para el tipo de destinatario "user".'); }
            usuariosDestino = await User.find({ _id: targetId }, '_id pushToken');
            break;
        case 'role':
            if (!targetRole) { res.status(400); throw new Error('Se requiere un "targetRole" para el tipo de destinatario "role".'); }
            usuariosDestino = await User.find({ roles: targetRole }, '_id pushToken');
            break;
        case 'class':
            if (!targetId) { res.status(400); throw new Error('Se requiere un "targetId" para el tipo de destinatario "class".'); }
            const claseEspecifica = await Clase.findById(targetId);
            if (!claseEspecifica) { res.status(404); throw new Error('Clase no encontrada.'); }
            usuariosDestino = await User.find({ _id: { $in: claseEspecifica.usuariosInscritos } }, '_id pushToken');
            break;
        default:
            res.status(400);
            throw new Error('Tipo de destinatario inválido.');
    }

    let notificacionesCreadas = [];
    if (usuariosDestino.length > 0) {
        const promesasDeNotificacion = usuariosDestino.map(user =>
            sendSingleNotification(Notification, User, user._id, title, message, type, isImportant, targetType === 'class' ? targetId : null)
        );
        notificacionesCreadas = await Promise.all(promesasDeNotificacion);
    }

    res.status(201).json({
        message: `Notificaciones enviadas con éxito a ${notificacionesCreadas.length} usuarios.`,
        notifications: notificacionesCreadas
    });
});

const getUserNotifications = asyncHandler(async (req, res) => {
    const { Notification } = getModels(req.gymDBConnection);
    const userId = req.user._id;
    const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 });
    res.json(notifications);
});

const markNotificationAsRead = asyncHandler(async (req, res) => {
    const { Notification } = getModels(req.gymDBConnection);
    const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
    if (!notification) {
        res.status(404);
        throw new Error('Notificación no encontrada.');
    }
    notification.read = true;
    await notification.save();
    res.json({ message: 'Notificación marcada como leída.', notification });
});

const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
    const { Notification } = getModels(req.gymDBConnection);
    const result = await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
    res.json({ message: `Se marcaron ${result.modifiedCount} notificaciones como leídas.` });
});


const deleteUserNotification = asyncHandler(async (req, res) => {
    const { Notification } = getModels(req.gymDBConnection);
    const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });

    if (!notification) {
        res.status(404);
        throw new Error('Notificación no encontrada o no autorizado.');
    }

    await notification.deleteOne();
    res.json({ message: 'Notificación eliminada.' });
});


const deleteAllUserNotifications = asyncHandler(async (req, res) => {
    const { Notification } = getModels(req.gymDBConnection);
    const result = await Notification.deleteMany({ user: req.user._id });
    res.json({ message: `Se eliminaron ${result.deletedCount} notificaciones.` });
});


const deleteNotification = asyncHandler(async (req, res) => {
    const { Notification } = getModels(req.gymDBConnection);
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
        res.status(404);
        throw new Error('Notificación no encontrada.');
    }
    await notification.deleteOne();
    res.json({ message: 'Notificación eliminada.' });
});

const deleteOldNotifications = asyncHandler(async (req, res) => {
    const { Notification } = getModels(req.gymDBConnection);
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    const result = await Notification.deleteMany({ createdAt: { $lte: tresMesesAtras } });
    res.json({ message: `Se eliminaron ${result.deletedCount} notificaciones antiguas.` });
});

export {
    sendSingleNotification,
    createNotification,
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    deleteOldNotifications,
    deleteUserNotification,
    deleteAllUserNotifications,
};