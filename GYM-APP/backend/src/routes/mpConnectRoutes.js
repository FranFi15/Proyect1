import express from 'express';
import { getConnectUrl, getConnectStatus } from '../controllers/mpConnectController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/url', protect, authorizeRoles('admin'), getConnectUrl);
router.get('/status', protect, authorizeRoles('admin'), getConnectStatus);

export default router;