import express from 'express';
import { registerUser, loginUser } from '../controllers/authController.js';
import gymTenantMiddleware from '../middlewares/gymTenantMiddleware.js';

const router = express.Router();

router.route('/register').post(gymTenantMiddleware, registerUser);
router.route('/login').post(gymTenantMiddleware, loginUser);

export default router;