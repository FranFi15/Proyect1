import express from 'express';
import { getMercadoPagoStatus } from '../controllers/settingsController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Ruta para que el frontend consulte el estado de la conexión
router.get('/mercadopago-status', protect, authorizeRoles('admin'), getMercadoPagoStatus);

export default router;