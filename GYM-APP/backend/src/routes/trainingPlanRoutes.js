import express from 'express';
const router = express.Router();
import {
    createPlan,
    getPlansForUser,
    getMyVisiblePlan,
    updatePlan,
    deletePlan,
} from '../controllers/trainingPlanController.js';
import { protect, admin, professor } from '../middleware/authMiddleware.js'; // Asumo que tienes un middleware 'profesor' o lo manejas dentro de 'admin'

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
    .post(protect, adminOrProfessor, createPlan);

router.route('/user/:userId')
    .get(protect, adminOrProfessor, getPlansForUser);

router.route('/:planId')
    .put(protect, adminOrProfessor, updatePlan)
    .delete(protect, adminOrProfessor, deletePlan);

export default router;