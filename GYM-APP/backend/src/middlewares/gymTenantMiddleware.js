// gym-app-backend/src/middlewares/gymTenantMiddleware.js
import connectToGymDB from '../config/mongoConnectionManager.js'; 

const PUBLIC_PATHS = [
    '/api/users/forgot-password',
    '/api/users/reset-password', 
    '/api/users/handle-reset-link' 
];

const gymTenantMiddleware = async (req, res, next) => {
const isPublicPath = PUBLIC_PATHS.some(path => req.path.startsWith(path));
    if (isPublicPath) {
        return next();
    }

    const clientId = req.headers['x-client-id'];

    if (!clientId) {
        return res.status(400).json({ message: "Falta el header 'x-client-id'." });
    }

    try {
        // Obtenemos la conexión (nueva o reutilizada) de nuestro gestor.
        const gymDBConnection = await connectToGymDB(clientId);

        // Adjuntamos la conexión y el ID al objeto 'req' para que los controladores lo usen.
        req.gymDBConnection = gymDBConnection;
        req.gymId = clientId;

        next(); // La petición continúa al controlador.
    } catch (error) {
        console.error(`Error en el middleware para el cliente ${clientId}:`, error.message);
        const statusCode = error.message.includes('Suscripción inactiva') ? 403 : 500;
        res.status(statusCode).json({ message: error.message || 'Error interno del servidor al procesar la solicitud del inquilino.' });
    }
};

export default gymTenantMiddleware;