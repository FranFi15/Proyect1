import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const SUPER_ADMIN_API_URL = process.env.ADMIN_PANEL_API_URL;
const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

// 1. EL OBRERO: Reactiva a todos en UNA base de datos
const reactivateAllUsersForGym = async (gymDBConnection, clientId) => {
    try {
        const { User } = getModels(gymDBConnection);

        // Actualizamos TODOS los usuarios que estén en false, a true.
        // Sin importar la fecha, ni el rol. RESET TOTAL.
        const result = await User.updateMany(
            { isActive: false }, 
            { $set: { isActive: true } }
        );

        if (result.modifiedCount > 0) {
            console.log(`[EMERGENCIA - ${clientId}] 🚑 Se reactivaron ${result.modifiedCount} usuarios.`);
        } else {
            console.log(`[EMERGENCIA - ${clientId}] Todos los usuarios ya estaban activos.`);
        }

    } catch (error) {
        console.error(`[EMERGENCIA - ${clientId}] Error:`, error.message);
    }
};

// 2. EL ORQUESTADOR: Recorre todos los gimnasios
export const runEmergencyReactivation = async () => {
    console.log('🚨 INICIANDO REACTIVACIÓN DE EMERGENCIA MASIVA 🚨');

    try {
        // Pedimos la lista de gimnasios
        const response = await axios.get(`${SUPER_ADMIN_API_URL}/api/clients/internal/all-clients`, {
            headers: { 'x-internal-api-key': INTERNAL_ADMIN_API_KEY },
        });

        const clients = response.data;

        if (!Array.isArray(clients)) {
            console.error('Error al obtener clientes del Super Admin.');
            return;
        }

        // Iteramos todos los gimnasios
        for (const client of clients) {
            // Incluso si el gimnasio está inactivo, intentamos arreglar sus usuarios por seguridad
            try {
                const { connection } = await connectToGymDB(client.clientId);
                if (connection) {
                    await reactivateAllUsersForGym(connection, client.clientId);
                }
            } catch (gymError) {
                console.error(`Error conectando con gym ${client.nombre}:`, gymError.message);
            }
        }
        console.log('✅ REACTIVACIÓN FINALIZADA. Todos los usuarios deberían tener acceso.');

    } catch (error) {
        console.error('❌ Error CRÍTICO en el script de emergencia:', error);
    }
};
