// src/routes/sucursalRoutes.js
import express from 'express';
import {
    getSucursales,
    createSucursal,
    updateSucursal,
    deleteSucursal
} from '../controllers/sucursalController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, getSucursales)
    .post(protect, admin, createSucursal);

router.route('/:id')
    .put(protect, admin, updateSucursal)
    .delete(protect, admin, deleteSucursal);

export default router;
