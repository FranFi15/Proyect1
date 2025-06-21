// src/controllers/notificationController.js
import getNotificationModel from '../models/Notification.js'; 
import getUserModel from '../models/User.js'; 
import getClassModel from '../models/Clase.js'; 
import asyncHandler from 'express-async-handler';

// Obtener notificaciones del usuario autenticado
const getMyNotifications = asyncHandler(async (req, res) => {
    const Notification = getNotificationModel(req.gymDBConnection); 
    const Class = getClassModel(req.gymDBConnection); // Obtener el modelo Clase de la conexión dinámica

    const notifications = await Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 }) 
        // Pasa el modelo de Class de la conexión específica para el populate
        .populate({ path: 'class', model: Class, select: 'nombre horarioFijo diaDeSemana' }); 

    res.json(notifications);
});

// Marcar una notificación como leída
const markNotificationAsRead = asyncHandler(async (req, res) => {
    const Notification = getNotificationModel(req.gymDBConnection); 

    const notificationId = req.params.id;
    const userId = req.user._id;

    const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, user: userId }, 
        { read: true },
        { new: true } 
    );

    if (notification) {
        res.json(notification);
    } else {
        res.status(404);
        throw new Error('Notificación no encontrada o no pertenece al usuario.');
    }
});

// Eliminar una notificación (opcional, si quieres que los usuarios puedan borrarlas)
const deleteNotification = asyncHandler(async (req, res) => {
    const Notification = getNotificationModel(req.gymDBConnection); 

    const notificationId = req.params.id;
    const userId = req.user._id;

    const notification = await Notification.findOneAndDelete({ _id: notificationId, user: userId });

    if (notification) {
        res.json({ message: 'Notificación eliminada correctamente.' });
    } else {
        res.status(404);
        throw new Error('Notificación no encontrada o no pertenece al usuario.');
    }
});

export {
    getMyNotifications,
    markNotificationAsRead,
    deleteNotification
};
