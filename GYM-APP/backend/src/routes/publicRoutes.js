import express from 'express';
import { handleResetLink } from '../controllers/userController.js'; // Importa solo el controlador que necesitas

const router = express.Router();

router.get('/handle-reset-link/:resettoken', handleResetLink);

export default router;