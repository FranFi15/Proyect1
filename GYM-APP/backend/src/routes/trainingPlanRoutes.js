import express from 'express';
const router = express.Router();
import {
    createPlan,
    getPlansForUser,
    getMyVisiblePlan,
    updatePlan,
    deletePlan,
} from '../controllers/trainingPlanController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js'

// Middleware para permitir acceso a Admin O Profesor
const adminOrProfessor = (req, res, next) => {
    if (req.user && (req.user.roles.includes('admin') || req.user.roles.includes('profesor'))) {
        next();
    } else {
        res.status(403);
        throw new Error('No autorizado, se requiere rol de Admin o Profesor.');
    }
};

// Ruta para que el cliente vea su plan
router.get('/my-plan', protect, getMyVisiblePlan);

// Rutas para Admins y Profesores
router.route('/')
    .post(protect, authorizeRoles('admin', 'profesor'), createPlan);

router.route('/user/:userId')
    .get(protect, authorizeRoles('admin', 'profesor'), getPlansForUser);

router.route('/:planId')
    .put(protect, authorizeRoles('admin', 'profesor'), updatePlan)
    .delete(protect, authorizeRoles('admin', 'profesor'), deletePlan);

export default router;