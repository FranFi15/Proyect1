// admin-panel-backend/routes/clientRoutes.js
import express from 'express';
import { 
    registerClient, 
    getClients,
    getClientById,
    updateClient,
    updateClientStatus,
    deleteClient,
    getClientDbInfo,
    getClientInternalDbInfo,
    getClientSubscriptionInfo,
    updateClientCount,
} from '../controllers/clientController.js'; 
import { protectInternal } from '../middleware/authInternalMiddleware.js'; 

const router = express.Router();

// --- INICIO DE LA CORRECCIÓN ---
// Las rutas más específicas se mueven al principio.
// Se añade el middleware de seguridad 'protectInternal' a todas las rutas internas.
router.get('/:id/subscription-info', protectInternal, getClientSubscriptionInfo); 
router.put('/:id/client-count', protectInternal, updateClientCount);
// Ruta para obtener todos los clientes para uso interno (ej: cron job).
router.get('/internal/all-clients', protectInternal, getClients);

// Ruta para obtener información de DB de un cliente específico (para gym-app-backend).
// Esta es la ruta CRÍTICA que debe ir antes de la ruta genérica '/:id'.
router.get('/:clientId/internal-db-info', protectInternal, getClientInternalDbInfo);

// Ruta para actualizar solo el estado de suscripción por clientId.
router.put('/:clientId/status', protectInternal, updateClientStatus); 

// Ruta para obtener información de DB (versión antigua, considerar unificar).
router.get('/:clientId/db-info', protectInternal, getClientDbInfo); 

// --- FIN DE LA CORRECCIÓN ---


// Ruta genérica para registrar un cliente o obtener todos los clientes (para el panel de admin).
// Estas rutas no usan 'protectInternal' porque se acceden desde el frontend del admin con otra autenticación (JWT).
router.route('/')
    .get(getClients) // Aquí debería ir un 'protect' para admin, no 'protectInternal'
    .post(registerClient); // Aquí también

// Rutas genéricas para un cliente específico por su ID de MongoDB.
// Estas rutas tampoco usan 'protectInternal'.
router.route('/:id')
    .get(getClientById) 
    .put(updateClient) 
    .delete(deleteClient); 

// La ruta antigua y conflictiva ha sido eliminada para evitar ambigüedades.

export default router;
