import express from 'express';
const router = express.Router();
import {
    createTransaction,
    getUserTransactions,
    getMyBalance,
    getMyTransactions,
} from '../controllers/transactionController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js'

// Ruta para que el usuario obtenga su propio balance
router.get('/my-balance', protect, getMyBalance);

router.get('/my-transactions', protect, getMyTransactions);

// Rutas solo para administradores
router.route('/')
    .post( protect, authorizeRoles('admin'), createTransaction);

router.route('/user/:userId')
    .get( protect, authorizeRoles('admin'), getUserTransactions);

export default router;