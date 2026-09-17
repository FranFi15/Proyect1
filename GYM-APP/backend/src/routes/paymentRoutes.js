// src/routes/paymentRoutes.js
import express from 'express';
import { 
    createPackage, 
    updatePackage, 
    deletePackage, 
    getPackages, 
    submitTransferReceipt, 
    getPendingRequests, 
    processTransferTicket,
    createMercadoPagoPreference,
    getMyTicket
} from '../controllers/paymentController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';
import gymTenantMiddleware from '../middlewares/gymTenantMiddleware.js';
import { upload } from '../utils/cloudinary.js';

const router = express.Router();

router.use(protect);
router.use(gymTenantMiddleware);

router.post('/packages', authorizeRoles('admin'), createPackage);
router.put('/packages/:id', authorizeRoles('admin'), updatePackage);
router.delete('/packages/:id', authorizeRoles('admin'), deletePackage);
router.get('/packages', getPackages);

router.post('/ticket', upload.single('receipt'), submitTransferReceipt);
router.get('/tickets/pending', authorizeRoles('admin'), getPendingRequests);
router.put('/ticket/:id/process', authorizeRoles('admin'), processTransferTicket);
router.get('/ticket/:id', getMyTicket);

router.post('/mercadopago/preference', createMercadoPagoPreference);

export default router;