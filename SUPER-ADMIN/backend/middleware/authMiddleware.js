import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js';

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 1. Extraer el token
            token = req.headers.authorization.split(' ')[1];
            // 2. Verificar la firma del token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await Client.findOne({ urlIdentifier: decoded.gymId }).select('-password');
            
            if (!req.user) {
                res.status(401);
                throw new Error('No autorizado, no se encontró un cliente con el gymId del token.');
            }

            next();
        } catch (error) {
            res.status(401);
            throw new Error('No autorizado, el token falló o es inválido.');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('No autorizado, no se encontró un token.');
    }
});

export { protect };