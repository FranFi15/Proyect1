// gym-app-backend/src/config/mongoConnectionManager.js
import mongoose from 'mongoose';
import axios from 'axios';

// --- CORRECCIÓN: Se importa tu utilidad getModels ---
import getModels from '../utils/getModels.js';

const activeConnections = new Map();

const getDbConfig = async (clientId) => {
    try {
        const adminApiUrl = process.env.ADMIN_PANEL_API_URL;
        const internalApiKey = process.env.INTERNAL_ADMIN_API_KEY; // Your GYM-APP needs its own secret key

        if (!adminApiUrl || !internalApiKey) {
            throw new Error('La configuración de la API del Super Admin no está completa en el .env');
        }

        const response = await axios.get(
            `${adminApiUrl}/api/clients/${clientId}/internal-db-info`,
            {
                headers: { 'x-internal-api-key': internalApiKey }
            }
        );
        
        const { connectionStringDB, estadoSuscripcion, _id, apiSecretKey } = response.data;

        if (estadoSuscripcion !== 'activo' && estadoSuscripcion !== 'periodo_prueba') {
            throw new Error(`Suscripción inactiva o vencida (${estadoSuscripcion}). Acceso denegado.`);
        }

        if (!connectionStringDB || !_id || !apiSecretKey) {
            throw new Error('La respuesta del SUPER-ADMIN no contenía la configuración completa.');
        }

        // Return all necessary data
        return { connectionStringDB, superAdminId: _id, apiSecretKey };

    } catch (error) {
        console.error(`Error al obtener la cadena de conexión para ${clientId}:`, error.response ? error.response.data : error.message);
        if (error.message.includes('Suscripción inactiva')) {
            throw error;
        }
        throw new Error('No se pudo obtener la configuración de la base de datos para el cliente.');
    }
};

const connectToGymDB = async (clientId) => {
    if (activeConnections.has(clientId)) {
        console.log(`🔌 Reutilizando conexión para: ${clientId}`);
        return activeConnections.get(clientId);
    }


    const { connectionStringDB, superAdminId, apiSecretKey } = await getDbConfig(clientId);

    try {
        console.log(`✨ Creando nueva conexión para: ${clientId}`);
        const newConnection = await mongoose.createConnection(connectionString).asPromise();
        
        getModels(newConnection);
        
        const connectionData = {
            connection: newConnection,
            superAdminId: superAdminId,
            apiSecretKey: apiSecretKey
        };

        activeConnections.set(clientId, connectionData);

        return connectionData;

    } catch (error) {
        console.error(`Error al crear la conexión de Mongoose para ${clientId}:`, error);
        throw new Error('No se pudo establecer la conexión con la base de datos del cliente.');
    }
};

export default connectToGymDB;
