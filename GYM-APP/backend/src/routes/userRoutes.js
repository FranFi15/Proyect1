// src/routes/userRoutes.js
import express from 'express';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js'; 
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
} from '../controllers/userController.js'; 


const router = express.Router();

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

router.route('/:userId/fixed-plan/:planId')
    .delete(protect, authorizeRoles('admin'), removeFixedPlan);

router.route('/profile/push-token').put(protect, updateUserPushToken);



export default router;
