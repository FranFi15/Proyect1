import express from 'express';
import { linkMercadoPago, getMercadoPagoStatus, unlinkMercadoPago } from '../controllers/mercadopagoController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/auth', protect, authorizeRoles('admin'), linkMercadoPago);
router.get('/status', protect, authorizeRoles('admin'), getMercadoPagoStatus);
router.delete('/unlink', protect, authorizeRoles('admin'), unlinkMercadoPago);

export default router;
