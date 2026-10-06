import express from 'express';
import {
    getCajaDashboard,
    createCajaSale,
    listDiscounts,
    createDiscount,
    updateDiscount,
    deleteDiscount,
    createGasto,
    updateGasto,
    deleteGasto,
    refundCajaPayment,
    getDiscountUsage,
    previewCajaCierre,
    createCajaCierre,
    listCajaCierres,
} from '../controllers/cajaController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect, authorizeRoles('admin'));

router.get('/dashboard', getCajaDashboard);
router.post('/sale', createCajaSale);
router.post('/refunds', refundCajaPayment);

router.post('/gastos', createGasto);
router.put('/gastos/:id', updateGasto);
router.delete('/gastos/:id', deleteGasto);

router.get('/discounts', listDiscounts);
router.post('/discounts', createDiscount);
router.put('/discounts/:id', updateDiscount);
router.delete('/discounts/:id', deleteDiscount);
router.get('/discounts/:id/usage', getDiscountUsage);

router.get('/cierres/preview', previewCajaCierre);
router.get('/cierres', listCajaCierres);
router.post('/cierres', createCajaCierre);

export default router;
