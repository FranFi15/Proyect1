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
} from '../controllers/userController.js'; 
import { resetCreditsForCurrentGym } from '../cron/CreditResetJob.js'; 

const router = express.Router();

router.get('/metrics', protect, authorizeRoles('admin'), getUserMetrics); 

router.route('/')
    .get(protect, authorizeRoles('admin'), getAllUsers); 

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

router.post('/test-reset', protect, authorizeRoles('admin'), async (req, res) => {
    console.log('--- EJECUTANDO RESET DE CRÉDITOS MANUALMENTE PARA PRUEBAS ---');
    // Usamos el gymId que ya viene en el request gracias al middleware
    const gymId = req.gymId; 
    if (!gymId) {
        return res.status(400).send('No se pudo identificar el Gym ID para la prueba.');
    }
    await resetCreditsForCurrentGym(gymId);
    res.status(200).send(`Reseteo de créditos ejecutado para el gimnasio ${gymId}. Revisa la consola y la base de datos.`);
});
export default router;
