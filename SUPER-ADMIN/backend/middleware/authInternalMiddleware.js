import asyncHandler from 'express-async-handler';

const protectInternal = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            console.log("--- DEBUG DE CLAVE API INTERNA ---");
            console.log("Token Recibido:", `"${token}"`);
            console.log("Token Esperado (desde .env):", `"${process.env.INTERNAL_ADMIN_API_KEY}"`);
            console.log("Largo del Recibido:", token?.length);
            console.log("Largo del Esperado:", process.env.INTERNAL_ADMIN_API_KEY?.length);
            console.log("¿Coinciden?:", token === process.env.INTERNAL_ADMIN_API_KEY);
            console.log("--- FIN DEL DEBUG ---");

            if (token === process.env.INTERNAL_ADMIN_API_KEY) {
                next();
            } else {
                res.status(401);
                throw new Error('No autorizado, token inválido.');
            }
        } catch (error) {
            res.status(401);
            throw new Error('No autorizado, token inválido.');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('No autorizado, no se encontró un token.');
    }
});

export { protectInternal };