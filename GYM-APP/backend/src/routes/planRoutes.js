import express from 'express';
import {
    createPlan,
    getPlanesForUser,
    deletePlan
} from '../controllers/planController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Ruta para crear un nuevo plan
router.post('/', protect, authorizeRoles('profesor', 'admin'), createPlan);

// Ruta para obtener todos los planes de un usuario
router.get('/usuario/:userId', protect, authorizeRoles('profesor', 'admin'), getPlanesForUser);

// Ruta para eliminar un plan por su ID
router.delete('/:id', protect, authorizeRoles('profesor', 'admin'), deletePlan);

export default router;