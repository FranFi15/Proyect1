// gym-app-backend/src/middlewares/gymTenantMiddleware.js
import connectToGymDB from '../config/mongoConnectionManager.js'; 

const PUBLIC_PATHS = [
    '/api/users/forgot-password',
    '/api/users/reset-password', 
    '/api/users/handle-reset-link' 
];

const gymTenantMiddleware = async (req, res, next) => {
      console.log('====================================');
    console.log('Ruta recibida por el middleware:', req.path);
    console.log('Método HTTP:', req.method);
const isPublicPath = PUBLIC_PATHS.some(path => req.path.startsWith(path));
console.log('¿La ruta es considerada pública?:', isPublicPath);
    console.log('====================================');
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