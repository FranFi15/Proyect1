// src/routes/notificationRoutes.js
import express from 'express';
import { protect } from '../middlewares/authMiddleware.js'; // Las notificaciones son privadas
import { getMyNotifications, markNotificationAsRead, deleteNotification } from '../controllers/notificationController.js';

const router = express.Router();

router.route('/me')
    .get(protect, getMyNotifications); // Obtener mis notificaciones

router.route('/:id/read')
    .put(protect, markNotificationAsRead); // Marcar como leída

router.route('/:id')
    .delete(protect, deleteNotification); // Eliminar notificación

export default router;