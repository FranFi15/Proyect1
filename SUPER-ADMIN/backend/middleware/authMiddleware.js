import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js';

const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Busca al cliente usando el gymId (urlIdentifier) que viene en el token
            req.user = await Client.findOne({ urlIdentifier: decoded.gymId }).select('-password');
            
            if (!req.user) throw new Error('Cliente no encontrado en SUPER-ADMIN.');

            next();
        } catch (error) {
            res.status(401);
            throw new Error('No autorizado, el token falló o es inválido.');
        }
    }
    if (!token) {
        res.status(401);
        throw new Error('No autorizado, no hay token.');
    }
});

export { protect };