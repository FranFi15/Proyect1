import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, authorizeRoles('admin'), getSettings)
    .put(protect, authorizeRoles('admin'), updateSettings);

export default router;