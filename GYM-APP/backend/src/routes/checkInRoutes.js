import express from 'express';
import { processGeneralCheckIn, getClientCheckInOptions, confirmClientCheckIn } from '../controllers/checkInController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Protegemos la ruta para que solo los admins puedan usarla
router.post('/scan', protect, authorizeRoles('admin'), processGeneralCheckIn);

// Rutas para que el cliente escanee el QR de recepción en 2 pasos
router.post('/client-scan-options', protect, getClientCheckInOptions);
router.post('/client-scan-confirm', protect, confirmClientCheckIn);

export default router;