import express from 'express';
import { 
    createPackage, 
    getPackages, 
    updatePackage, 
    deletePackage 
} from '../controllers/packageController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Ruta para obtener los paquetes (pública para clientes, pero admins ven todo)
router.route('/')
    .get(protect, getPackages) 
    .post(protect, authorizeRoles('admin'), createPackage);

// Rutas para que el admin modifique o elimine un paquete específico
router.route('/:id')
    .put(protect, authorizeRoles('admin'), updatePackage)
    .delete(protect, authorizeRoles('admin'), deletePackage);

export default router;