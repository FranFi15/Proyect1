// admin-panel-backend/routes/clientRoutes.js
import express from 'express';
import { 
    registerClient, 
    getAllInternalClients, // <-- Importa la nueva función
    getClients, // Ya estaba, pero lo pongo explícitamente si se usa
    getClientById,
    updateClient,
    updateClientStatus,
    deleteClient,
    getClientDbInfo,
    getClientInternalDbInfo,
    getInternalDbInfo,
} from '../controllers/clientController.js'; 
import { protectInternal } from '../middleware/authInternalMiddleware.js'; 

const router = express.Router();

router.route('/')
    // La petición GET a '/api/clients' es manejada por getClients
    .get(getClients) // Cuando soluciones el problema, vuelve a añadir 'protect'
    // La petición POST a '/api/clients' ahora es manejada por registerClient
    .post(registerClient); // Cuando soluciones el problema, vuelve a añadir 'protect'


// Ruta para obtener todos los clientes para uso interno del sistema (ej: cron job de gym-app-backend)
// Esta ruta debe ser accesible por el gym-app-backend usando la INTERNAL_ADMIN_API_KEY
router.get('/internal/all-clients', getAllInternalClients);

// Rutas para clientes específicos por ID de MongoDB
router.route('/:id')
    .get(getClientById) 
    .put(updateClient) 
    .delete(deleteClient); 

router.route('/:id/internal-db-info').get(protectInternal, getInternalDbInfo);

// Ruta para obtener información de DB de un cliente específico (para gym-app-backend)
router.get('/:clientId/db-info', getClientDbInfo); 

// Ruta para actualizar solo el estado de suscripción por clientId
router.put('/:clientId/status', updateClientStatus); 

router.get('/:clientId/internal-db-info', getClientInternalDbInfo);


export default router;
