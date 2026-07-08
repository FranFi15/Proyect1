// gym-app-backend/src/config/mongoConnectionManager.js
import mongoose from 'mongoose';
import axios from 'axios';
import getModels from '../utils/getModels.js';

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
        
        let { connectionStringDB, estadoSuscripcion, _id, apiSecretKey, timezone, pais } = response.data;

        if (process.env.MONGO_URI_BASE && process.env.MONGO_URI_BASE.includes('cluster0')) {
             connectionStringDB = forceStagingConnection(connectionStringDB);
        }

        if (estadoSuscripcion !== 'activo' && estadoSuscripcion !== 'periodo_prueba') {
        }

        if (!connectionStringDB || !_id || !apiSecretKey) {
            throw new Error('La respuesta del SUPER-ADMIN no contenía la configuración completa.');
        }

        return { 
            connectionStringDB, 
            gymId: _id, 
            apiSecretKey,
            timezone: timezone || 'America/Argentina/Buenos_Aires',
            pais: pais || 'Argentina'
        };

    } catch (error) {
        console.error(`Error al obtener la cadena de conexión para ${clientId}:`, error.response ? error.response.data : error.message);
        if (error.message.includes('Suscripción inactiva')) {
            throw error;
        }
        throw new Error('Por favor vuelva a ingresar el Codigo de la institucion.');
    }
};

const activeConnections = new Map();
const tenantMetadataCache = new Map();
const METADATA_TTL_MS = 15 * 1000; // 15 segundos

const connectToGymDB = async (clientId) => {
    let dbConfig;
    const cachedTenant = tenantMetadataCache.get(clientId);
    if (cachedTenant && (Date.now() - cachedTenant.timestamp < METADATA_TTL_MS)) {
        dbConfig = cachedTenant.config;
    } else {
        dbConfig = await getDbConfig(clientId);
        tenantMetadataCache.set(clientId, { config: dbConfig, timestamp: Date.now() });
    }

    const { connectionStringDB, gymId, apiSecretKey, timezone, pais } = dbConfig;

    if (activeConnections.has(connectionStringDB)) {
        const cachedConn = activeConnections.get(connectionStringDB);
        return {
            connection: cachedConn.connection,
            superAdminId: gymId,
            apiSecretKey: apiSecretKey,
            timezone: timezone || 'America/Argentina/Buenos_Aires',
            pais: pais || 'Argentina'
        };
    }

    try {
        console.log(`✨ Creando nueva conexión para ${clientId} (${pais || 'Argentina'} - ${timezone || 'America/Argentina/Buenos_Aires'})`); 
        const newConnection = await mongoose.createConnection(connectionStringDB).asPromise();
        
        getModels(newConnection);
        
        const connectionData = {
            connection: newConnection,
            superAdminId: gymId,
            apiSecretKey: apiSecretKey,
            timezone: timezone || 'America/Argentina/Buenos_Aires',
            pais: pais || 'Argentina'
        };

        activeConnections.set(connectionStringDB, connectionData);

        return connectionData;

    } catch (error) {
        console.error(`Error al crear la conexión de Mongoose para ${clientId}:`, error);
        throw new Error('No se pudo establecer la conexión con la base de datos del cliente.');
    }
};

export default connectToGymDB;