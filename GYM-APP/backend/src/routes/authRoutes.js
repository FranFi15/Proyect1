import express from 'express';
import { registerUser, loginUser } from '../controllers/authController.js';
import gymTenantMiddleware from '../middlewares/gymTenantMiddleware.js';

const router = express.Router();

router.post(
    '/register', 
    (req, res, next) => {
        console.log('--- Router: La ruta /register ha sido alcanzada. A punto de llamar a registerUser.');
        next();
    },
    registerUser // El controlador original se llama después
);
router.route('/login').post(loginUser);

export default router;