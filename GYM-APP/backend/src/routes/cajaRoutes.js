import express from 'express';
import {
    getCajaDashboard,
    createCajaSale,
    listDiscounts,
    createDiscount,
    updateDiscount,
    deleteDiscount,
    createGasto,
    deleteGasto,
} from '../controllers/cajaController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect, authorizeRoles('admin'));

router.get('/dashboard', getCajaDashboard);
router.post('/sale', createCajaSale);

router.post('/gastos', createGasto);
router.delete('/gastos/:id', deleteGasto);

router.get('/discounts', listDiscounts);
router.post('/discounts', createDiscount);
router.put('/discounts/:id', updateDiscount);
router.delete('/discounts/:id', deleteDiscount);

export default router;
