import express from 'express';
import { getConnectUrl } from '../controllers/mpConnectController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/url', protect, authorizeRoles('admin'), getConnectUrl);

export default router;