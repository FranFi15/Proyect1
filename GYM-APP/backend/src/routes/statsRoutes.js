import express from 'express';
import { getDashboardStats, getClientStats } from '../controllers/statsController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/dashboard', protect, authorizeRoles('admin'), getDashboardStats);
router.get('/client/:id', protect, authorizeRoles('admin', 'profesor'), getClientStats);

export default router;
