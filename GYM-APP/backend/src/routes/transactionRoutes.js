import express from 'express';
const router = express.Router();
import {
    createTransaction,
    getUserTransactions,
    getMyBalance,
} from '../controllers/transactionController.js';
import { protect, admin } from '../middleware/authMiddleware.js'; // Asegúrate de tener estos middlewares

// Ruta para que el usuario obtenga su propio balance
router.get('/my-balance', protect, getMyBalance);

// Rutas solo para administradores
router.route('/')
    .post(protect, admin, createTransaction);

router.route('/user/:userId')
    .get(protect, admin, getUserTransactions);

export default router;