import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import getUserModel from '../models/User.js';

const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const User = getUserModel(req.gymDBConnection);
            req.user = await User.findById(decoded.id).select('-contraseñaHash');

            if (!req.user) {
                res.status(401);
                throw new Error('Not authorized, user not found.');
            }
            next();
        } catch (error) {
            console.error(error);
            res.status(401);
            throw new Error('Not authorized, token failed.');
        }
    }
    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token.');
    }
});

// Middleware para restringir acceso por roles
// CAMBIO: Ahora verifica si el usuario tiene *al menos uno* de los roles requeridos
const authorizeRoles = (...allowedRoles) => { // Ej: 'admin', 'teacher'
    return (req, res, next) => {
        // req.user.roles es un array (ej: ['user', 'teacher'])
        // allowedRoles es el array de roles permitidos (ej: ['admin', 'teacher'])

        // Verifica si hay algún rol del usuario que esté incluido en los roles permitidos
        const hasPermission = req.user.roles.some(userRole => allowedRoles.includes(userRole));

        if (!hasPermission) {
            res.status(403); // Forbidden
            throw new Error(`Acceso denegado. No tienes los permisos necesarios para esta acción.`);
        }
        next();
    };
};

export { protect, authorizeRoles };