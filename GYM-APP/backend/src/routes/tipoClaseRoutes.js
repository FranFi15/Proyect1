import express from 'express';
import {
    createTipoClase,
    getTiposClase,
    getTipoClaseById,
    updateTipoClase,
    deleteTipoClase,
} from '../controllers/tipoClaseController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Rutas para gestionar los tipos de clase (solo admin)
router.route('/')
    .post(protect, authorizeRoles('admin'), createTipoClase)
    .get(getTiposClase);

// Rutas para tipo de clase específico por ID
router.route('/:id')
    .get(getTipoClaseById)
    .put(protect, authorizeRoles('admin'), updateTipoClase)
    .delete(protect, authorizeRoles('admin'), deleteTipoClase);

export default router;