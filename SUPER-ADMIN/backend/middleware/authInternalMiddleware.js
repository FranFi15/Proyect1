import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js';

// Middleware 1: Valida usando la CLAVE MAESTRA global del .env
const protectWithMasterKey = asyncHandler(async (req, res, next) => {
    const masterKey = req.headers['x-internal-api-key'];

    if (!masterKey) {
        res.status(401);
        throw new Error('No autorizado, clave de API interna no proporcionada.');
    }

    if (masterKey === process.env.INTERNAL_ADMIN_API_KEY) {
        next(); // La clave maestra es correcta, permite continuar.
    } else {
        res.status(401);
        throw new Error('No autorizado, clave de API interna maestra inválida.');
    }
});

// Middleware 2: Valida usando la apiSecretKey ÚNICA de cada cliente
const protectWithClientKey = asyncHandler(async (req, res, next) => {
    const clientApiKey = req.headers['x-internal-api-key'];
    const clientId = req.params.clientId; 

    if (!clientApiKey) {
        res.status(401);
        throw new Error('No autorizado, clave de API de cliente no proporcionada.');
    }
    
    if (!clientId) {
        res.status(400);
        throw new Error('No se proporcionó un clientId en la ruta para la validación.');
    }

    const client = await Client.findOne({ clientId: clientId });

    if (!client) {
        res.status(404);
        throw new Error('Cliente para validación de API no encontrado.');
    }

    // Compara la clave recibida con la que está guardada para ESE cliente
    if (clientApiKey === client.apiSecretKey) {
        next(); // La clave del cliente es correcta, permite continuar.
    } else {
        res.status(401);
        throw new Error('No autorizado, clave de API de cliente inválida.');
    }
});

export { protectWithMasterKey, protectWithClientKey };