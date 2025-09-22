import express from 'express';
import { generateConnectUrl, handleConnectCallback } from '../controllers/mpConnectController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Ruta protegida que el panel de admin del gym llama (a través del GYM-APP)
router.post('/url', protect, generateConnectUrl);

// Ruta pública a la que Mercado Pago redirige al usuario
router.get('/callback', handleConnectCallback);

export default router;