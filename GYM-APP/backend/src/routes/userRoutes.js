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
    getUserProfile,
    updateUserProfile,
    changeUserPassword,
    updateUserPushToken,
} from '../controllers/userController.js'; 
import { resetCreditsForCurrentGym } from '../cron/CreditResetJob.js';  

const router = express.Router();

router.get('/metrics', protect, authorizeRoles('admin'), getUserMetrics); 

router.route('/')
    .get(protect, authorizeRoles('admin', 'profesor'), getAllUsers); 

router.route('/me')
    .get(protect, getMe);
router.route('/me').get(protect, getUserProfile);
router.route('/profile').put(protect, updateUserProfile);
router.route('/profile/change-password').put(protect, changeUserPassword);

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

router.route('/profile/push-token').put(protect, updateUserPushToken);

export default router;
