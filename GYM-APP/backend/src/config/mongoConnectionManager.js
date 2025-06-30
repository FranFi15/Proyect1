import mongoose from 'mongoose';
import axios from 'axios';

// Un objeto para cachear las conexiones y no tener que pedirlas cada vez.
const connectionCache = new Map();

// Función para obtener la cadena de conexión desde el SUPER-ADMIN.
const getDbConnectionString = async (clientId) => {
    // Si ya tenemos la conexión en caché, la devolvemos para ser más eficientes.
    if (connectionCache.has(clientId)) {
        return connectionCache.get(clientId);
    }

    try {
        const adminApiUrl = process.env.SUPER_ADMIN_API_URL;
        if (!adminApiUrl) {
            throw new Error('La URL del SUPER_ADMIN_API_URL no está configurada en el .env');
        }

        const internalApiKey = process.env.INTERNAL_ADMIN_API_KEY;
        if (!internalApiKey) {
            throw new Error('La clave INTERNAL_ADMIN_API_KEY no está configurada en el .env');
        }

        // --- CORRECCIÓN CLAVE AQUÍ ---
        // Hacemos la llamada al SUPER-ADMIN, pero ahora incluimos la clave secreta en las cabeceras.
        const response = await axios.get(
            `${adminApiUrl}/api/clients/${clientId}/internal-db-info`,
            {
                headers: {
                    'internal-admin-api-key': internalApiKey
                }
            }
        );
        
        const { dbConnectionString } = response.data;

        if (!dbConnectionString) {
            throw new Error('La respuesta del SUPER-ADMIN no contenía una cadena de conexión.');
        }

        // Guardamos la conexión en caché para futuras peticiones.
        connectionCache.set(clientId, dbConnectionString);
        return dbConnectionString;

    } catch (error) {
        console.error('Error al obtener la cadena de conexión del SUPER-ADMIN:', error.message);
        throw new Error('No se pudo obtener la configuración de la base de datos para el cliente.');
    }
};


// Función principal para obtener la conexión a la base de datos del cliente.
const getDbConnection = async (clientId) => {
    const connectionString = await getDbConnectionString(clientId);
    const db = await mongoose.createConnection(connectionString).asPromise();
    console.log(`Conexión establecida a la base de datos del cliente: ${clientId}`);
    return db;
};

export default getDbConnection;