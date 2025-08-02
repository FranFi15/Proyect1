import asyncHandler from 'express-async-handler';

// Middleware para proteger rutas de comunicación interna entre servidores.
const protectInternal = asyncHandler(async (req, res, next) => {
     const internalKey = req.headers['x-internal-api-key'];

    // Verifica que la cabecera con la clave secreta exista.
    if (!internalKey) {
        res.status(401);
        throw new Error('No autorizado, clave de API interna no proporcionada.');
    }

    // Compara la clave de la cabecera con la que está en las variables de entorno.
    if (internalKey === process.env.INTERNAL_ADMIN_API_KEY) {
        // Si coinciden, permite que la petición continúe.
        next();
    } else {
        res.status(401);
        throw new Error('No autorizado, clave de API interna inválida.');
    }
});

export { protectInternal };