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
    getClientDbInfo // Asegúrate de importar también getClientDbInfo
} from '../controllers/clientController.js'; 
// Asume que tienes middleware de autenticación/autorización para tu panel de administración si las rutas son privadas
// import { protect, authorizeRoles } from '../middleware/authMiddleware.js'; 

const router = express.Router();

// Ruta para registrar un nuevo gimnasio (probablemente privada para un superadmin)
router.post('/register-gym', registerClient); // Aquí podrías añadir protect y authorizeRoles('superadmin')

// Ruta para obtener todos los clientes (para el dashboard del panel de admin)
router.get('/', getClients); // Añade protect y authorizeRoles('admin') si es necesario

// Ruta para obtener todos los clientes para uso interno del sistema (ej: cron job de gym-app-backend)
// Esta ruta debe ser accesible por el gym-app-backend usando la INTERNAL_ADMIN_API_KEY
router.get('/internal/all-clients', getAllInternalClients); // <-- NUEVA RUTA INTERNA

// Rutas para clientes específicos por ID de MongoDB
router.route('/:id')
    .get(getClientById) // Añade protect y authorizeRoles si es necesario
    .put(updateClient) // Añade protect y authorizeRoles si es necesario
    .delete(deleteClient); // Añade protect y authorizeRoles si es necesario

// Ruta para obtener información de DB de un cliente específico (para gym-app-backend)
router.get('/:clientId/db-info', getClientDbInfo); // Esencialmente protegida por x-api-secret

// Ruta para actualizar solo el estado de suscripción por clientId
router.put('/:clientId/status', updateClientStatus); // Añade protect y authorizeRoles si es necesario

export default router;
