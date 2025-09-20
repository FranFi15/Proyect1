import express from 'express';
import { generateConnectUrl, handlePkceCallback} from '../controllers/mpConnectController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/url', protect, authorizeRoles('admin'), generateConnectUrl);
router.post('/callback-pkce', protect, authorizeRoles('admin'), handlePkceCallback);

export default router;