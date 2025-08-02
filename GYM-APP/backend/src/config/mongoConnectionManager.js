// gym-app-backend/src/config/mongoConnectionManager.js
import mongoose from 'mongoose';
import axios from 'axios';

// --- CORRECCIÓN: Se importa tu utilidad getModels ---
import getModels from '../utils/getModels.js';

const activeConnections = new Map();

const getDbConnectionString = async (clientId) => {
    try {
        const adminApiUrl = process.env.ADMIN_PANEL_API_URL;
        if (!adminApiUrl) {
            throw new Error('La URL del ADMIN_PANEL_API_URL no está configurada en el .env');
        }

        const internalApiKey = process.env.INTERNAL_ADMIN_API_KEY;
        if (!internalApiKey) {
            throw new Error('La clave INTERNAL_ADMIN_API_KEY no está configurada en el .env');
        }

        const response = await axios.get(
            `${adminApiUrl}/api/clients/${clientId}/internal-db-info`,
            {
                headers: {
                    'x-internal-api-key': internalApiKey
                }
            }
        );
        
        const { connectionStringDB, estadoSuscripcion } = response.data;

        if (estadoSuscripcion !== 'activo' && estadoSuscripcion !== 'periodo_prueba') {
            throw new Error(`Suscripción inactiva o vencida (${estadoSuscripcion}). Acceso denegado.`);
        }

        if (!connectionStringDB) {
            throw new Error('La respuesta del SUPER-ADMIN no contenía una cadena de conexión.');
        }

        return connectionStringDB;

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
        console.log(`🔌 Reutilizando conexión existente para el cliente: ${clientId}`);
        return activeConnections.get(clientId);
    }

    const connectionString = await getDbConnectionString(clientId);

    try {
        console.log(`✨ Creando nueva conexión para el cliente: ${clientId}`);
        const newConnection = await mongoose.createConnection(connectionString).asPromise();

        // --- CORRECCIÓN FINAL: Se delega el registro de todos los modelos a tu utilidad ---
        getModels(newConnection);
        
        activeConnections.set(clientId, newConnection);

        return newConnection;

    } catch (error) {
        console.error(`Error al crear la conexión de Mongoose para ${clientId}:`, error);
        throw new Error('No se pudo establecer la conexión con la base de datos del cliente.');
    }
};

export default connectToGymDB;
