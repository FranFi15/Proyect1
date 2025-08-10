import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js'; // Necesitamos el modelo para buscar en la BD

const protectInternal = asyncHandler(async (req, res, next) => {
    // La clave que envía el GYM-APP (puede ser la maestra o la de un cliente)
    const apiKey = req.headers['x-internal-api-key'];
    
    // El ID del cliente (UUID) que viene en la URL
    const clientId = req.params.clientId; 

    if (!apiKey) {
        res.status(401);
        throw new Error('No autorizado, clave de API interna no proporcionada.');
    }

    // --- LÓGICA MEJORADA ---

    // CASO 1: Si la petición es para un cliente específico (la ruta incluye un clientId)
    if (clientId) {
        const client = await Client.findOne({ clientId: clientId });

        if (!client) {
            res.status(404);
            throw new Error('Cliente para validación de API no encontrado.');
        }

        // Comparamos la clave recibida con la clave guardada para ESE cliente
        if (apiKey === client.apiSecretKey) {
            next(); // ¡Éxito! La clave coincide
        } else {
            res.status(401);
            throw new Error('No autorizado, clave de API de cliente inválida.');
        }

    } else {
        // CASO 2: Si es una ruta general (como /internal/all-clients), usamos la clave maestra
        if (apiKey === process.env.INTERNAL_ADMIN_API_KEY) {
            next(); // ¡Éxito! La clave maestra coincide
        } else {
            res.status(401);
            throw new Error('No autorizado, clave de API interna maestra inválida.');
        }
    }
});

export { protectInternal };