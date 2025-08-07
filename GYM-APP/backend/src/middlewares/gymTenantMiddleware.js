// gym-app-backend/src/middlewares/gymTenantMiddleware.js
import connectToGymDB from '../config/mongoConnectionManager.js'; 

const gymTenantMiddleware = async (req, res, next) => {
    const clientId = req.headers['x-client-id'];

    if (!clientId) {
        return res.status(400).json({ message: "Falta el header 'x-client-id'." });
    }

    try {
        // Obtenemos la conexión (nueva o reutilizada) de nuestro gestor.
        const {connection, superAdminId, apiSecretKey}= await connectToGymDB(clientId);

        req.gymDBConnection = connection;
        req.gymId = clientId; 
        req.superAdminId = superAdminId; 
        req.apiSecretKey = apiSecretKey;

        next();
    } catch (error) {
        console.error(`Error en el middleware para el cliente ${clientId}:`, error.message);
        const statusCode = error.message.includes('Suscripción inactiva') ? 403 : 500;
        res.status(statusCode).json({ message: error.message || 'Error interno del servidor al procesar la solicitud del inquilino.' });
    }
};

export default gymTenantMiddleware;