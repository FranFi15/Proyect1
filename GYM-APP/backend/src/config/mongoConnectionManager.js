import mongoose from 'mongoose';
import fetch from 'node-fetch';

const gymConnections = {};

const connectToGymDB = async (clientId) => {
    if (gymConnections[clientId] && gymConnections[clientId].readyState === 1) {
        return gymConnections[clientId];
    }

    const adminPanelApiUrl = process.env.ADMIN_PANEL_API_URL;
    const internalApiKey = process.env.INTERNAL_API_KEY_FOR_SUPERADMIN;

    if (!internalApiKey) {
        throw new Error('Error de configuración: INTERNAL_API_KEY_FOR_SUPERADMIN no está definida.');
    }

    const response = await fetch(`${adminPanelApiUrl}/api/clients/${clientId}/internal-db-info`, {
        headers: { 'X-Internal-Api-Key': internalApiKey }
    });
    
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || `Error al obtener info de DB para ${clientId}`);
    }

    if (data.estadoSuscripcion !== 'activo' && data.estadoSuscripcion !== 'periodo_prueba') {
        throw new Error(`Suscripción inactiva para el gimnasio ${clientId}. Estado: ${data.estadoSuscripcion}`);
    }

    const connectionString = data.connectionStringDB;

    // --- CORRECCIÓN CLAVE AQUÍ ---
    // Usamos opciones explícitas para crear la conexión y evitar errores de parsing
    const gymDBConnection = await mongoose.createConnection(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    console.log(`Conectado exitosamente a la base de datos del gimnasio: ${gymDBConnection.name}`);
    gymConnections[clientId] = gymDBConnection;
    return gymDBConnection;
};

export default connectToGymDB;