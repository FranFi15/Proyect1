// src/routes/userRoutes.js
import express from 'express';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js'; 
import asyncHandler from 'express-async-handler';
import {
    getAllUsers,
    getUserById,
    getMe,
    deleteUser,
    deleteMyAccount,
    updateUserProfileByAdmin,
    updateUserPlan,
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
    updateUserStatus,
    updateUserPaseLibre,
    removeUserPaseLibre,
    updateRMs,
} from '../controllers/userController.js'; 

import { resetCreditsForCurrentGym } from '../cron/CreditResetJob.js';

const router = express.Router();

router.post('/test-cron-manual', asyncHandler(async (req, res) => {
    console.log("⚡ Iniciando prueba manual del Cron de Créditos...");
    await resetCreditsForCurrentGym(req.gymDBConnection, req.gymId);
    res.json({ message: 'Lógica del Cron ejecutada manualmente.' });
}));


router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

router.put('/upgrade-plan', protect, authorizeRoles('admin'), requestPlanUpgrade);
router.get('/subscription-info', protect, authorizeRoles('admin'), getSubscriptionInfo);

 

router.route('/')
    .get(protect, authorizeRoles('admin', 'profesor'), getAllUsers); 
router.delete('/me', protect, deleteMyAccount);
router.route('/me')
    .get(protect, getMe);
router.route('/me').get(protect, getUserProfile);
router.route('/profile').put(protect, updateUserProfile);
router.route('/profile/change-password').put(protect, changeUserPassword);
router.route('/profile/rm').put(protect, updateRMs)


router.route('/:id')
    .get(protect, authorizeRoles('admin', 'profesor'), getUserById) 
    .put(protect, authorizeRoles('admin'), updateUserProfileByAdmin) 
    .delete(protect, authorizeRoles('admin'), deleteUser); 

router.route('/:id/plan')
    .put(protect, authorizeRoles('admin'), updateUserPlan);

router.route('/:id/credits/clear')
    .put(protect, authorizeRoles('admin'), clearUserCredits);

router.put('/:id/status', protect, authorizeRoles('admin'), updateUserStatus);    

router.route('/:userId/subscription/:tipoClaseId')
    .delete(protect, authorizeRoles('admin'), removeUserSubscription);

router.route('/:id/subscribe-to-plan')
    .post(protect, authorizeRoles('admin'), subscribeUserToPlan);  

router.put('/:id/pase-libre', protect, authorizeRoles('admin'), updateUserPaseLibre);   
router.delete('/:id/pase-libre', protect, authorizeRoles('admin'), removeUserPaseLibre);

router.route('/:userId/fixed-plan/:planId')
    .delete(protect, authorizeRoles('admin'), removeFixedPlan);

router.route('/profile/push-token').put(protect, updateUserPushToken);



export default router;
