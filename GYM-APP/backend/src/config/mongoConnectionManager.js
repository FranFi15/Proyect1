// gym-app-backend/src/config/mongoConnectionManager.js
import mongoose from 'mongoose';
import axios from 'axios';
import getModels from '../utils/getModels.js';

const activeConnections = new Map();

const forceStagingConnection = (originalString) => {
    const stagingClusterURI = process.env.MONGO_URI_BASE; 

    if (!stagingClusterURI || !stagingClusterURI.includes('cluster0')) {
        console.warn("⚠️ Advertencia: No se detectó cluster de staging en env, usando original.");
        return originalString;
    }

    try {
        const urlParts = originalString.split('/');
        const dbNameWithParams = urlParts[3]; 
        const dbName = dbNameWithParams.split('?')[0]; 
        const stagingBase = stagingClusterURI.substring(0, stagingClusterURI.lastIndexOf('/'));
        const stagingParams = stagingClusterURI.substring(stagingClusterURI.indexOf('?'));
        
        const newConnectionString = `${stagingBase}/${dbName}${stagingParams}`;

        console.log(`🛡️ SECUESTRO DE CONEXIÓN: Redirigiendo ${dbName} a Cluster de Pruebas.`);
        return newConnectionString;

    } catch (e) {
        console.error("Error al transformar URL a Staging:", e);
        return originalString; // Fallback por si acaso
    }
};


const getDbConfig = async (clientId) => {
    try {
        const adminApiUrl = process.env.ADMIN_PANEL_API_URL;
        const internalApiKey = process.env.INTERNAL_ADMIN_API_KEY; 

        if (!adminApiUrl || !internalApiKey) {
            throw new Error('La configuración de la API del Super Admin no está completa en el .env');
        }

        const response = await axios.get(
            `${adminApiUrl}/api/clients/internal/${clientId}/db-info`,
            {
                headers: { 'x-internal-api-key': internalApiKey }
            }
        );
        
        let { connectionStringDB, estadoSuscripcion, _id, apiSecretKey } = response.data;

        if (process.env.MONGO_URI_BASE && process.env.MONGO_URI_BASE.includes('cluster0')) {
             connectionStringDB = forceStagingConnection(connectionStringDB);
        }

        if (estadoSuscripcion !== 'activo' && estadoSuscripcion !== 'periodo_prueba') {
        }

        if (!connectionStringDB || !_id || !apiSecretKey) {
            throw new Error('La respuesta del SUPER-ADMIN no contenía la configuración completa.');
        }

        return { connectionStringDB, gymId: _id, apiSecretKey };

    } catch (error) {
        console.error(`Error al obtener la cadena de conexión para ${clientId}:`, error.response ? error.response.data : error.message);
        if (error.message.includes('Suscripción inactiva')) {
            throw error;
        }
        throw new Error('Por favor vuelva a ingresar el Codigo de la institucion.');
    }
};

const connectToGymDB = async (clientId) => {
    if (activeConnections.has(clientId)) {
        console.log(`🔌 Reutilizando conexión para: ${clientId}`);
        return activeConnections.get(clientId);
    }

    const { connectionStringDB, superAdminId, apiSecretKey } = await getDbConfig(clientId);

    try {
        console.log(`✨ Creando nueva conexión hacia: ${connectionStringDB.split('@')[1]}`); 
        const newConnection = await mongoose.createConnection(connectionStringDB).asPromise();
        
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