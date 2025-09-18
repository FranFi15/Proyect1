import express from 'express';
import { generateConnectUrl, handleConnectCallback } from '../controllers/mpConnectController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Ruta protegida que el panel de admin del gym llama para obtener el link
// NOTA: Esta ruta en realidad debería ser llamada por el backend de GYM-APP
// para mayor seguridad, pero por ahora la dejamos así para simplificar.
router.get('/url', protect, generateConnectUrl);

// Ruta pública a la que Mercado Pago redirige al usuario
router.get('/callback', handleConnectCallback);

export default router;