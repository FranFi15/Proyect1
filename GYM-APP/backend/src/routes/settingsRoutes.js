import express from 'express';
import { 
    checkSecurityKeyExists, 
    updateSecurityKey, 
    updateMercadoPagoSettings 
} from '../controllers/settingsController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();


router.route('/security-key')
    .get(protect, authorizeRoles('admin'), checkSecurityKeyExists)
    .put(protect, authorizeRoles('admin'), updateSecurityKey);

router.route('/mercadopago')
    .put(protect, authorizeRoles('admin'), updateMercadoPagoSettings);

export default router;