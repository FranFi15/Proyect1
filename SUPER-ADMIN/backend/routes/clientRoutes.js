import express from 'express';
import { 
    registerClient, 
    getAllInternalClients,
    getClients,
    getClientById,
    updateClient,
    updateClientStatus, 
    deleteClient,
    getClientDbInfo,
    getClientByUrlIdentifier, 
} from '../controllers/clientController.js'; 
import { protectInternal } from '../middleware/authInternalMiddleware.js'; 


const router = express.Router();

// ====================================================================
// RUTA PÚBLICA (para la app móvil)
// ====================================================================
// GET /api/clients/identifier/:urlIdentifier
// Esta es la nueva ruta que soluciona el bug de la app. Busca un gimnasio por su código único.
// No necesita protección porque solo devuelve información pública (nombre, logo, color).
router.get('/identifier/:urlIdentifier', getClientByUrlIdentifier);


// ====================================================================
// RUTAS PARA EL PANEL DE SUPER-ADMIN (Protegidas por un admin login)
// ====================================================================
// GET /api/clients/
// POST /api/clients/
router.route('/')
    .get(getClients)      
    .post(registerClient);

// GET /api/clients/:id
// PUT /api/clients/:id
// DELETE /api/clients/:id
router.route('/:id')
    .get(getClientById)     
    .put(updateClient)        
    .delete(deleteClient);    


// GET /api/clients/internal/all
// Usada por el cron job para obtener la lista de todos los clientes.
router.get('/internal/all', protectInternal, getAllInternalClients);

// GET /api/clients/:id/db-info
// Usada por gym-app para obtener la connection string. Estandarizamos a usar :id.
router.get('/:id/db-info', protectInternal, getClientDbInfo); 

// PUT /api/clients/:id/status
// Usada para actualizar el estado de suscripción. Estandarizamos a usar :id.
router.put('/:id/status', protectInternal, updateClientStatus); 


export default router;