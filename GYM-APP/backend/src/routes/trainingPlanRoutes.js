// src/routes/trainingPlanRoutes.js
import express from 'express';
const router = express.Router();
import {
    createTemplate,
    getMyTemplates,
    updateTemplate,
    deleteTemplate,
    createPlanForUser,
    getPlansForUser,
    getMyVisiblePlans,
    updatePlan,
    deletePlan,
    deleteAllPlans
} from '../controllers/trainingPlanController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

// --- Rutas de Plantillas (Solo para Admins y Profesores) ---
router.route('/templates')
    .post(protect, authorizeRoles('admin', 'profesor'), createTemplate)
    .get(protect, authorizeRoles('admin', 'profesor'), getMyTemplates);

router.route('/templates/:templateId')
    .put(protect, authorizeRoles('admin', 'profesor'), updateTemplate)
    .delete(protect, authorizeRoles('admin', 'profesor'), deleteTemplate);


// --- Rutas de Planes Asignados ---

// Ruta para que el cliente vea sus planes visibles
router.get('/my-plans', protect, getMyVisiblePlans);
router.delete('/my-plans/all', protect, deleteAllPlans);

// Crear un plan para un usuario
router.route('/')
    .post(protect, authorizeRoles('admin', 'profesor'), createPlanForUser);

// Obtener todos los planes de un usuario específico
router.route('/user/:userId')
    .get(protect, authorizeRoles('admin', 'profesor'), getPlansForUser);

router.delete('/user/:userId/all', protect, authorizeRoles('admin', 'profesor'), deleteAllPlans);    

// Modificar o eliminar un plan específico
router.route('/:planId')
    .put(protect, authorizeRoles('admin', 'profesor'), updatePlan)
    .delete(protect, deletePlan);

export default router;
