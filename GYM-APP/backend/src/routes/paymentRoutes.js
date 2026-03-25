// src/routes/paymentRoutes.js
import express from 'express';
import { 
    createPackage, 
    getPackages, 
    submitTransferReceipt, 
    getPendingRequests, 
    processTransferTicket 
} from '../controllers/paymentController.js';
import { protect } from '../middlewares/authMiddleware.js';
import gymTenantMiddleware from '../middlewares/gymTenantMiddleware.js';
import { upload } from '../utils/cloudinary.js';

const router = express.Router();

// Aplica los middlewares a todas las rutas (Asumo que tienes estos por cómo armaste los otros)
router.use(protect);
router.use(gymTenantMiddleware);

// Rutas de Paquetes
router.post('/packages', createPackage); // Solo admin (luego lo puedes proteger con un middleware de admin)
router.get('/packages', getPackages); // Clientes y Admin

// Rutas de Tickets (Comprobantes)
router.post('/ticket', upload.single('receipt'), submitTransferReceipt); // El cliente envía comprobante
router.get('/tickets/pending', getPendingRequests); // El admin ve los pendientes
router.put('/ticket/:id/process', processTransferTicket); // El admin aprueba/rechaza

export default router;