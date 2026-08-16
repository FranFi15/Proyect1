import express from 'express';
import { getDashboardStats } from '../controllers/statsController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/dashboard', protect, authorizeRoles('admin'), getDashboardStats);

export default router;
