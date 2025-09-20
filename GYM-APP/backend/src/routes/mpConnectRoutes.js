import express from 'express';
import { generateConnectUrl, handleConnectCallback } from '../controllers/mpConnectController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const connectRouter = express.Router(); // Para la ruta protegida
const callbackRouter = express.Router(); // Para la ruta pública

connectRouter.post('/url', protect, authorizeRoles('admin'), generateConnectUrl);
callbackRouter.get('/callback', handleConnectCallback);

export { connectRouter, callbackRouter };