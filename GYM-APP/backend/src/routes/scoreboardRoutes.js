import express from 'express';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';
import {
    createScoreboard,
    updateScoreboard,
    deleteScoreboard,
    getActiveScoreboards,
    submitScore,
    getLeaderboard
} from '../controllers/scoreboardController.js';

const router = express.Router();

// Obtener la lista de desafíos vigentes (Eternos o con fecha futura)
router.get('/active', protect, getActiveScoreboards);

// Cargar o editar el resultado propio
router.post('/submit', protect, submitScore);

// Ver el ranking de un desafío específico (Con lógica de bloqueo si no participó)
router.get('/:scoreboardId/leaderboard', protect, getLeaderboard);


// Crear un nuevo desafío
router.post('/', protect, authorizeRoles('admin', 'profesor'), createScoreboard);

// Editar un desafío existente (Nombre, métricas, visibilidad, fecha límite)
router.put('/:id', protect, authorizeRoles('admin', 'profesor'), updateScoreboard);

// Eliminar un desafío (y todos sus resultados asociados)
router.delete('/:id', protect, authorizeRoles('admin', 'profesor'), deleteScoreboard);

export default router;