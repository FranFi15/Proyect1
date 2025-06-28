// src/middlewares/gymTenantMiddleware.js
import connectToGymDB from '../config/mongoConnectionManager.js'; 

const gymTenantMiddleware = async (req, res, next) => {
    console.log('--- Middleware: Petición recibida para el cliente:', req.headers['x-client-id']);

    const clientId = req.headers['x-client-id'];

    if (!clientId) {
        return res.status(400).json({ message: "Faltan los headers 'x-client-id'." });
    }

    try {
        const gymDBConnection = await connectToGymDB(clientId);

        // Adjunta la conexión de Mongoose al objeto de solicitud (req).
        req.gymDBConnection = gymDBConnection;

        // --- INICIO DE LA SOLUCIÓN ---
        // ¡ESTA ES LA LÍNEA QUE FALTA Y QUE ARREGLA TODO!
        // También debemos adjuntar el ID del cliente (gimnasio) a la petición
        // para que los controladores puedan acceder a él a través de `req.gymId`.
        req.gymId = clientId;
        // --- FIN DE LA SOLUCIÓN ---

        console.log('--- Middleware: Conexión a DB establecida. Pasando al controlador.');
        next(); 
    } catch (error) {
        const statusCode = error.message.includes('Suscripción inactiva') ? 403 : 500;
        res.status(statusCode).json({ message: error.message || 'Error interno del servidor al procesar la solicitud del inquilino.' });
    }
};

export default gymTenantMiddleware;
