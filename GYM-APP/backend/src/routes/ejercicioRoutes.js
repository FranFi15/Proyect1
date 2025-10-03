import express from 'express';
import {
    createEjercicio,
    getEjercicios,
    updateEjercicio,
    deleteEjercicio
} from '../controllers/ejercicioController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Rutas para la colección de ejercicios
router.route('/')
    .get(protect, authorizeRoles('profesor', 'admin', 'cliente'), getEjercicios)
    .post(protect, authorizeRoles('profesor', 'admin'), createEjercicio);

// Rutas para un ejercicio específico
router.route('/:id')
    .put(protect, authorizeRoles('profesor', 'admin'), updateEjercicio)
    .delete(protect, authorizeRoles('profesor', 'admin'), deleteEjercicio);

export default router;