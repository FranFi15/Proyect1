import express from 'express';
import { 
    createPaymentPreference, 
    receiveWebhook 
} from '../controllers/paymentController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();
const publicRouter = express.Router(); // Un router separado para la ruta pública

// Ruta protegida para que el cliente cree la orden
router.post('/create-preference', protect, createPaymentPreference);

// Ruta PÚBLICA para que Mercado Pago nos envíe notificaciones
publicRouter.post('/webhook', receiveWebhook);

// Exportamos ambos routers
export { router as paymentRouter, publicRouter as webhookRouter };