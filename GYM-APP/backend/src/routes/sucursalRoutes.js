// src/routes/sucursalRoutes.js
import express from 'express';
import {
    getSucursales,
    createSucursal,
    updateSucursal,
    deleteSucursal
} from '../controllers/sucursalController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getSucursales)
    .post(protect, authorizeRoles('admin'), createSucursal);

router.route('/:id')
    .put(protect, authorizeRoles('admin'), updateSucursal)
    .delete(protect, authorizeRoles('admin'), deleteSucursal);

export default router;
