// admin-panel-backend/routes/adminRoutes.js
import express from 'express';
import { authAdmin, createAdmin, resetOrCreateAdmin } from '../controllers/adminController.js'; // Importa tu controlador

const router = express.Router();

// @desc    Ruta de autenticación para el superadministrador
// @route   POST /api/admin/login
// @access  Public
router.post('/create-temp-admin', createAdmin); 
router.post('/login', authAdmin);
router.post('/setup', resetOrCreateAdmin);

export default router;