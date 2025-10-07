import express from 'express';
import { getUploadSignature } from '../controllers/uploadController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Usamos POST por convención para solicitar una acción
router.post('/signature', protect, authorizeRoles('profesor', 'admin'), getUploadSignature);

export default router;