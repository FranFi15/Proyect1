import express from 'express';
import {
    createStoreItem,
    getStoreItems,
    updateStoreItem,
    deleteStoreItem,
    submitStoreTransferOrder,
    createStoreMercadoPagoPreference,
    getMyStoreOrder,
    listStoreOrders,
    processStoreOrder,
} from '../controllers/storeController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';
import gymTenantMiddleware from '../middlewares/gymTenantMiddleware.js';
import { upload } from '../utils/cloudinary.js';

const router = express.Router();

router.use(protect);
router.use(gymTenantMiddleware);

router.get('/items', getStoreItems);
router.post('/items', authorizeRoles('admin'), upload.single('image'), createStoreItem);
router.put('/items/:id', authorizeRoles('admin'), upload.single('image'), updateStoreItem);
router.delete('/items/:id', authorizeRoles('admin'), deleteStoreItem);

router.post('/orders/ticket', upload.single('receipt'), submitStoreTransferOrder);
router.post('/orders/mercadopago/preference', createStoreMercadoPagoPreference);
router.get('/orders', authorizeRoles('admin'), listStoreOrders);
router.get('/orders/:id', getMyStoreOrder);
router.put('/orders/:id/process', authorizeRoles('admin'), processStoreOrder);

export default router;
