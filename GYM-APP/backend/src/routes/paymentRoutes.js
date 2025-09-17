import express from 'express';
import { 
    createPaymentPreference, 
    receiveWebhook 
} from '../controllers/paymentController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// --- Ruta para que el Cliente Cree una Orden de Pago ---
// Se protege con 'protect' para asegurar que solo un usuario logueado pueda crear un pago.
router.post('/create-preference', protect, createPaymentPreference);

// --- Ruta para que Mercado Pago nos Envíe Notificaciones (Webhook) ---
// Esta ruta NO debe estar protegida, ya que es Mercado Pago quien la llama, no un usuario.
router.post('/webhook/:clientId', receiveWebhook);

export default router;