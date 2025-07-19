import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const sendExpoPushNotification = async (pushToken, title, body, data = {}) => {
    // Expo requiere que el token sea un token de Expo válido.
    const isExpoToken = typeof pushToken === 'string' && pushToken.startsWith('ExponentPushToken');

    if (!isExpoToken) {
        console.error(`El token proporcionado no es un token de Expo válido: ${pushToken}`);
        return;
    }

    const message = {
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data, // Puedes enviar datos adicionales aquí
    };

    try {
        // Hacemos la petición a los servidores de Expo
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });
        
        // Opcional: puedes revisar la respuesta de Expo para manejar errores
        const responseData = await response.json();
        if (responseData.data.status === 'error') {
            console.error(`Error de Expo al enviar la notificación: ${responseData.data.message}`);
            console.error('Detalles:', responseData.data.details);
        } else {
            console.log(`Notificación push enviada exitosamente al token ${pushToken}`);
        }

    } catch (error) {
        console.error(`Falló el envío de notificación push para el token ${pushToken}:`, error);
    }
};


const sendSingleNotification = async (NotificationModel, UserModel, userId, title, message, type, isImportant, classId = null) => {
    // 1. Crear la notificación en la base de datos (lógica sin cambios)
    const notificacionInApp = await NotificationModel.create({
        user: userId,
        title,
        message,
        type: type || 'general',
        class: classId,
        read: false,
        isImportant: isImportant || false,
    });

    const user = await UserModel.findById(userId).select('pushToken email nombre');

    if (!user) {
        console.error(`Usuario con ID ${userId} no encontrado.`);
        return notificacionInApp;
    }

    // 2. Intentar enviar la notificación por Email con Resend (lógica sin cambios)
    if (user.email) {
        try {
            await resend.emails.send({
                from: 'Gain <noreply@gain-wellness.com>', 
                to: user.email,
                subject: title,
                html: `<h1>${title}</h1><p>Hola, ${user.nombre || 'usuario'}!</p><p>${message}</p><br>`,
            });
            console.log(`Email enviado exitosamente al usuario ${userId} (${user.email})`);
        } catch (error) {
            console.error(`Falló el envío de email para el usuario ${userId}:`, error);
        }
    }

    // 3. Intentar enviar la notificación Push (LÓGICA ACTUALIZADA)
    if (user.pushToken) {
        // En lugar de usar 'admin.messaging()', llamamos a nuestra nueva función.
        await sendExpoPushNotification(user.pushToken, title, message, { notificationId: notificacionInApp._id });
    }

    return notificacionInApp;
};


const createNotification = asyncHandler(async (req, res) => {
    const { Notification, User, Clase } = getModels(req.gymDBConnection);
    // <-- 5. NUEVO PARÁMETRO: 'sendEmail' para controlar el envío de correo (opcional pero recomendado)
    const { title, message, type, isImportant, targetType, targetId, targetRole, sendEmail } = req.body;

    if (!title || !message || !targetType) {
        res.status(400);
        throw new Error('El título, el mensaje y el tipo de destinatario (targetType) son obligatorios.');
    }

    let usuariosDestino = [];
    switch (targetType) {
        case 'all':
            // <-- 6. MODIFICACIÓN: Traemos el email y nombre de todos los usuarios
            usuariosDestino = await User.find({}, '_id email name pushToken');
            break;
        case 'user':
            if (!targetId) { res.status(400); throw new Error('Se requiere un "targetId" para el tipo de destinatario "user".'); }
            usuariosDestino = await User.find({ _id: targetId }, '_id email name pushToken');
            break;
        case 'role':
            if (!targetRole) { res.status(400); throw new Error('Se requiere un "targetRole" para el tipo de destinatario "role".'); }
            usuariosDestino = await User.find({ roles: targetRole }, '_id email name pushToken');
            break;
        case 'class':
            if (!targetId) { res.status(400); throw new Error('Se requiere un "targetId" para el tipo de destinatario "class".'); }
            const claseEspecifica = await Clase.findById(targetId);
            if (!claseEspecifica) { res.status(404); throw new Error('Clase no encontrada.'); }
            usuariosDestino = await User.find({ _id: { $in: claseEspecifica.usuariosInscritos } }, '_id email name pushToken');
            break;
        default:
            res.status(400);
            throw new Error('Tipo de destinatario inválido.');
    }

    let notificacionesCreadas = [];
    if (usuariosDestino.length > 0) {
        // En la llamada a sendSingleNotification no hay que cambiar nada, ya se encarga de todo.
        const promesasDeNotificacion = usuariosDestino.map(user =>
            sendSingleNotification(Notification, User, user._id, title, message, type, isImportant, targetType === 'class' ? targetId : null)
        );
        notificacionesCreadas = await Promise.all(promesasDeNotificacion);
    }

    res.status(201).json({
        message: `Notificaciones procesadas para ${notificacionesCreadas.length} usuarios.`,
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