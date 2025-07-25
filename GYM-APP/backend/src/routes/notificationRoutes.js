import express from 'express';
import {
    createNotification,
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    deleteOldNotifications,
    deleteUserNotification,
    deleteAllUserNotifications
} from '../controllers/notificationController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();


router.route('/me')
    .get(protect, getUserNotifications);

router.route('/me/all')
    .delete(protect, deleteAllUserNotifications); // <-- NUEVA RUTA

router.route('/me/:id')
    .delete(protect, deleteUserNotification); // <-- NUEVA RUTA

router.route('/:id/read')
    .put(protect, markNotificationAsRead);

router.route('/mark-all-read')
    .put(protect, markAllNotificationsAsRead);



router.route('/')
    .post(protect, authorizeRoles('admin' , 'profesor'), createNotification);

router.route('/:id')
    .delete(protect, authorizeRoles('admin'), deleteNotification);

router.route('/delete-old')
    .delete(protect, authorizeRoles('admin'), deleteOldNotifications);

export default router;