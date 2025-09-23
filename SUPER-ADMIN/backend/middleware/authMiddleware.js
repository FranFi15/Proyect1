import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js';


const protect = asyncHandler(async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Adjuntamos al request el cliente que está logueado
            req.user = await Client.findOne({ urlIdentifier: decoded.gymId }).select('-password');
            next();
        } catch (error) {
            res.status(401);
            throw new Error('No autorizado, el token falló.');
        }
    }
    if (!token) {
        res.status(401);
        throw new Error('No autorizado, no hay token.');
    }
});

const protectWithMasterKey = asyncHandler(async (req, res, next) => {
    const masterKey = req.headers['x-internal-api-key'];
    if (!masterKey || masterKey !== process.env.INTERNAL_ADMIN_API_KEY) {
        res.status(401);
        throw new Error('No autorizado, clave de API interna maestra inválida.');
    }
    next();
});

export { protect, protectWithMasterKey };