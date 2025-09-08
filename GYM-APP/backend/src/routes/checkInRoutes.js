import express from 'express';
import { processGeneralCheckIn } from '../controllers/checkInController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Protegemos la ruta para que solo los admins puedan usarla
router.post('/scan', protect, authorizeRoles('admin'), processGeneralCheckIn);

export default router;