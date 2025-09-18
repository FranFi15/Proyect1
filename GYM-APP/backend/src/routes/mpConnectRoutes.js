import express from 'express';
import { generateConnectUrl, handleConnectCallback } from '../controllers/mpConnectController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// El admin del gym pide la URL para conectar
router.post('/url', protect, authorizeRoles('admin'), generateConnectUrl);

// Mercado Pago llama a esta URL
router.get('/callback', handleConnectCallback);

export default router;