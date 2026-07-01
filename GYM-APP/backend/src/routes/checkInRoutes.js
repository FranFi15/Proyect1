import express from 'express';
import { processGeneralCheckIn, processClientReceptionScan } from '../controllers/checkInController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Protegemos la ruta para que solo los admins puedan usarla
router.post('/scan', protect, authorizeRoles('admin'), processGeneralCheckIn);

// Ruta para que el cliente escanee el QR de recepción y registre su asistencia
router.post('/client-scan', protect, processClientReceptionScan);

export default router;