// backend/src/routes/publicRoutes.js
import express from 'express';
import { getGymClientIdByIdentifier } from '../controllers/publicController.js'; // Crearás este controlador

const router = express.Router();

// Ruta para resolver un identificador de gym a su clientId
router.get('/gym/:gymIdentifier', getGymClientIdByIdentifier);

export default router;