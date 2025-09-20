import express from 'express';
import { generateConnectUrl, handleConnectCallback } from '../controllers/mpConnectController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const connectRouter = express.Router(); // Para rutas protegidas
const callbackRouter = express.Router(); // Para la ruta pública

// El admin del gym pide la URL (esta ruta SÍ está protegida)
connectRouter.post('/url', protect, authorizeRoles('admin'), generateConnectUrl);

// Mercado Pago llama a esta URL (esta ruta es PÚBLICA)
callbackRouter.get('/callback', handleConnectCallback);

export { connectRouter, callbackRouter };