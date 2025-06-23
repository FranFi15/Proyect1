// src/middlewares/gymTenantMiddleware.js
import connectToGymDB from '../config/mongoConnectionManager.js'; 

const gymTenantMiddleware = async (req, res, next) => {
  console.log('--- Middleware: Petición recibida para el cliente:', req.headers['x-client-id']);


    // Extrae los headers necesarios de la solicitud
    const clientId = req.headers['x-client-id'];

    // Valida que los headers existan
    if (!clientId) {
       
        return res.status(400).json({ message: "Faltan los headers 'x-client-id'." });
    }

    try {
        const gymDBConnection = await connectToGymDB(clientId);

        // Adjunta la conexión de Mongoose al objeto de solicitud (req),
        // para que los controladores puedan acceder a ella y usarla para interactuar con la DB.
        req.gymDBConnection = gymDBConnection;
        console.log('--- Middleware: Conexión a DB establecida. Pasando al controlador.');
        next(); 
    } catch (error) {
        // Manejo de errores centralizado para el middleware
        
        
        // Determina el código de estado HTTP adecuado basado en el tipo de error
        const statusCode = error.message.includes('Suscripción inactiva') ? 403 : 500;
        
        // Responde al cliente con un mensaje de error
        res.status(statusCode).json({ message: error.message || 'Error interno del servidor al procesar la solicitud del inquilino.' });
    }
};

export default gymTenantMiddleware;
