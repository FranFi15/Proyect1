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
// import { protectAdmin } from '../middleware/adminAuthMiddleware.js';

const router = express.Router();

// --- RUTAS PARA EL PANEL DE ADMIN (deberían estar protegidas) ---
router.route('/')
    .get(getClients)
    .post(registerClient);

router.route('/:id')
    .get(getClientById) 
    .put(updateClient) 
    .delete(deleteClient); 

// --- RUTAS INTERNAS (Server-to-Server, protegidas por API Key) ---
router.get('/internal/all-clients', protectInternal, getClients);
router.get('/:clientId/subscription-info', protectInternal, getClientSubscriptionInfo); 
router.put('/:clientId/client-count', protectInternal, updateClientCount);

// Rutas antiguas que usan :clientId (considera unificar a :id en el futuro)
router.get('/:clientId/internal-db-info', protectInternal, getClientInternalDbInfo);
router.put('/:clientId/status', protectInternal, updateClientStatus); 
router.get('/:clientId/db-info', protectInternal, getClientDbInfo); 

export default router;