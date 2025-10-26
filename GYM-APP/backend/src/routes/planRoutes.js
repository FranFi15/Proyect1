import express from 'express';
import {
    createPlan,
    getPlanesForUser,
    deletePlan,
    updatePlan
} from '../controllers/planController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Ruta para crear un nuevo plan
router.post('/', protect, authorizeRoles('profesor', 'admin'), createPlan);


router.get('/usuario/:userId', protect, authorizeRoles('profesor', 'admin'), getPlanesForUser);

router.get('/:id', protect, authorizeRoles('cliente', 'profesor', 'admin'), getPlanById);

router.delete('/:id', protect, authorizeRoles('profesor', 'admin'), deletePlan);

router.put('/:id', protect, authorizeRoles('profesor', 'admin'), updatePlan);

export default router;