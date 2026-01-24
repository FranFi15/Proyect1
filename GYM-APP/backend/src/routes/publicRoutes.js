import express from 'express';
import { handleResetLink } from '../controllers/userController.js'; 

const router = express.Router();

router.get('/handle-reset-link/:resettoken', handleResetLink);

export default router;