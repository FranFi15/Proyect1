import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
// import { protectAdmin } from '../middleware/adminAuthMiddleware.js';

const router = express.Router();

// Asumimos que estas rutas estarán protegidas por un middleware de admin
router.route('/').get(getSettings).put(updateSettings);

export default router;