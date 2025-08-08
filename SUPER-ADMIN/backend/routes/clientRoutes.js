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

// --- RUTAS PARA EL PANEL DE ADMIN ---
router.route('/')
    .get(getClients)
    .post(registerClient);

router.route('/:id')
    .get(getClientById) 
    .put(updateClient) 
    .delete(deleteClient); 

// --- RUTAS INTERNAS (Server-to-Server) ---

// Ruta para el cron job
router.get('/internal/all-clients', protectInternal, getClients);

// --- ¡CORRECCIÓN APLICADA AQUÍ! ---
// Se ha añadido el prefijo '/internal/' a todas las rutas que lo necesitaban
// para que coincidan con lo que el GYM-APP espera.

// Usada por GYM-APP para obtener la configuración inicial.
router.get('/internal/:clientId/db-info', protectInternal, getClientInternalDbInfo);

// Usada por GYM-APP para consultar el límite de clientes.
router.get('/internal/:clientId/subscription-info', protectInternal, getClientSubscriptionInfo);

// Usada por GYM-APP para actualizar el contador de clientes.
router.put('/internal/:clientId/client-count', protectInternal, updateClientCount);

// Usada para actualizar el estado (considera unificar con la de arriba).
router.put('/internal/:clientId/status', protectInternal, updateClientStatus); 

// Ruta antigua, considera eliminarla ya que getClientInternalDbInfo la reemplaza.
router.get('/:clientId/db-info', protectInternal, getClientDbInfo); 

export default router;