import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import getUserModel from '../models/User.js';

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            // 1. Verificamos el token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const User = getUserModel(req.gymDBConnection); 
            req.user = await User.findById(decoded.id).select('-contraseña');

            if (!req.user) {
                res.status(401);
                throw new Error('No autorizado, usuario no encontrado (puede haber sido eliminado).');
            }

            next();
        } catch (error) {
            res.status(401); 
            if (error.name === 'TokenExpiredError') {
                throw new Error('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Token inválido. Acceso denegado.');
            } else {
                console.error('Error inesperado en auth middleware:', error);
                throw new Error('No autorizado, error de validación.');
            }
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('No autorizado, no se proporcionó token.');
    }
});

// Middleware para restringir acceso por roles
const authorizeRoles = (...allowedRoles) => { 
    return (req, res, next) => {
        // Validación de seguridad extra
        if (!req.user || !req.user.roles) {
            res.status(401);
            throw new Error('No autorizado, roles no definidos.');
        }

        const hasPermission = req.user.roles.some(userRole => allowedRoles.includes(userRole));

        if (!hasPermission) {
            res.status(403); 
            throw new Error(`Acceso denegado. No tienes los permisos necesarios.`);
        }
        next();
    };
};

export { protect, authorizeRoles };