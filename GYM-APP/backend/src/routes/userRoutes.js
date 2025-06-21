// src/routes/userRoutes.js
import express from 'express';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js'; 
import {
    getAllUsers,
    getUserById,
    getMe,
    updateUserCredits,
    deleteUser,
    updateUserProfileByAdmin,
    manageUserSubscription, 
    getUserMetrics,
} from '../controllers/userController.js'; 

const router = express.Router();

router.get('/metrics', protect, authorizeRoles('admin'), getUserMetrics); 

router.route('/')
    .get(protect, authorizeRoles('admin'), getAllUsers); 

router.route('/me')
    .get(protect, getMe);

router.route('/:id')
    .get(protect, authorizeRoles('admin', 'profesor'), getUserById) 
    .put(protect, authorizeRoles('admin'), updateUserProfileByAdmin) 
    .delete(protect, authorizeRoles('admin'), deleteUser); 

// Ruta para asignar créditos a un usuario (solo admin)
router.route('/:id/credits')
    .put(protect, authorizeRoles('admin'), updateUserCredits);

// Ruta para administrar las suscripciones mensuales de un usuario (solo admin)
router.route('/:id/subscription')
    .put(protect, authorizeRoles('admin'), manageUserSubscription); 

export default router;
