// src/routes/userRoutes.js
import express from 'express';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js'; 
import {
    getAllUsers,
    getUserById,
    getMe,
    deleteUser,
    updateUserProfileByAdmin,
    updateUserPlan,
    getUserMetrics,
    clearUserCredits,
    removeUserSubscription,
    subscribeUserToPlan,
    removeFixedPlan,
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

router.route('/:id/plan')
    .put(protect, authorizeRoles('admin'), updateUserPlan);

router.route('/:id/credits/clear')
    .put(protect, authorizeRoles('admin'), clearUserCredits);

router.route('/:userId/subscription/:tipoClaseId')
    .delete(protect, authorizeRoles('admin'), removeUserSubscription);

router.route('/:id/subscribe-to-plan')
    .post(protect, authorizeRoles('admin'), subscribeUserToPlan);  

router.route('/:userId/fixed-plan/:planId')
    .delete(protect, authorizeRoles('admin'), removeFixedPlan);

export default router;
