import express from 'express';
import { getLogsForUser } from '../controllers/creditLogController.js';
import { protect, authorizeRoles  } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/:userId').get(protect, authorizeRoles('admin'), getLogsForUser);

export default router;