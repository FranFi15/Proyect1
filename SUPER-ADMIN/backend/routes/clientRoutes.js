import express from 'express';
import { 
    registerClient,
    getClients,
    getClientById,
    updateClient,
    deleteClient,
    getClientInternalDbInfo,
    getClientSubscriptionInfo,
    updateClientCount,
    updateClientStatus,
    upgradeClientPlan,
  } from '../controllers/clientController.js'; 
import { protectWithMasterKey, protectWithClientKey } from '../middleware/authInternalMiddleware.js'; 

const router = express.Router();

// --- RUTAS PARA EL PANEL DE ADMIN (no cambian) ---
router.route('/').get(getClients).post(registerClient);


router.route('/:id').get(getClientById).put(updateClient).delete(deleteClient); 

// --- RUTAS INTERNAS CON LA PROTECCIÓN CORRECTA ---

// Ruta para el cron job (usa la clave maestra)
router.get('/internal/all-clients', protectWithMasterKey, getClients);

// Usada por GYM-APP para la configuración inicial (usa la clave maestra)
router.get('/internal/:clientId/db-info', protectWithMasterKey, getClientInternalDbInfo);

// Las siguientes llamadas ya usan la clave única del cliente
router.get('/internal/:clientId/subscription-info', protectWithClientKey, getClientSubscriptionInfo);
router.put('/internal/:clientId/client-count', protectWithClientKey, updateClientCount);
router.put('/internal/:clientId/upgrade-plan', protectWithClientKey, upgradeClientPlan);
router.put('/internal/:clientId/status', protectWithClientKey, updateClientStatus); 

export default router;