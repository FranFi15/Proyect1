import express from 'express';
import { registerUser, loginUser, refreshToken } from '../controllers/authController.js';
import gymTenantMiddleware from '../middlewares/gymTenantMiddleware.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post(
    '/register', 
    (req, res, next) => {
        console.log('--- Router: La ruta /register ha sido alcanzada. A punto de llamar a registerUser.');
        next();
    },
    registerUser 
);
router.route('/login').post(loginUser);
router.get('/refresh-token', protect, gymTenantMiddleware, refreshToken);

export default router;