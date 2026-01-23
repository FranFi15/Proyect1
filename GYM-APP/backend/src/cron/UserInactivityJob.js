import cron from 'node-cron';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const SUPER_ADMIN_API_URL = process.env.ADMIN_PANEL_API_URL;
const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

// --------------------------------------------------------------------------
// 1. EL TRABAJADOR (Worker): Lógica para UN solo gimnasio
// --------------------------------------------------------------------------
const deactivateInactiveUsersForGym = async (gymDBConnection, clientId) => {
    try {
        // Obtenemos el modelo User de ESTA conexión específica
        const { User } = getModels(gymDBConnection);

        // Calculamos la fecha límite (Hoy - 40 días)
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 40);

        // Ejecutamos la actualización masiva
        // Buscamos: Activos + Rol Cliente + UpdatedAt viejo
        const result = await User.updateMany(
            { 
                isActive: true,                
                roles: 'cliente',              
                updatedAt: { $lt: limitDate }  
            },
            { 
                $set: { isActive: false }      
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`[UserInactivityJob - ${clientId}] 📉 Se desactivaron ${result.modifiedCount} clientes inactivos.`);
        } else {
            // Opcional: comentar esto para no llenar logs si no hay cambios
            // console.log(`[UserInactivityJob - ${clientId}] No hay usuarios para desactivar hoy.`);
        }

    } catch (error) {
        console.error(`[UserInactivityJob - ${clientId}] Error al procesar inactividad:`, error);
    }
};

// --------------------------------------------------------------------------
// 2. EL ORQUESTADOR (Orchestrator): Busca gimnasios y reparte el trabajo
// --------------------------------------------------------------------------
const runUserInactivityJob = async () => {
    console.log('[UserInactivityJob] 🕵️ Iniciando revisión de usuarios inactivos (40 días)...');
    
    if (!SUPER_ADMIN_API_URL || !INTERNAL_ADMIN_API_KEY) {
        console.error('[UserInactivityJob] Error: Variables de entorno no configuradas.');
        return;
    }

    try {
        // A. Pedimos la lista de gimnasios al Super Admin
        const response = await axios.get(`${SUPER_ADMIN_API_URL}/api/clients/internal/all-clients`, {
            headers: { 'x-internal-api-key': INTERNAL_ADMIN_API_KEY },
        });

        const clients = response.data;

        if (!Array.isArray(clients) || clients.length === 0) {
            console.log('[UserInactivityJob] No hay clientes activos para procesar.');
            return;
        }

        // B. Iteramos sobre cada gimnasio
        for (const client of clients) {
            // Procesamos solo los que pagan o están en prueba
            if (client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba') {
                try {
                    // C. Conexión Dinámica
                    const { connection } = await connectToGymDB(client.clientId);
                    
                    // D. Llamamos al trabajador
                    if (connection) {
                        await deactivateInactiveUsersForGym(connection, client.clientId);
                    }

                } catch (gymError) {
                    console.error(`[UserInactivityJob] Error al conectar con gym ${client.nombre} (ID: ${client.clientId}): ${gymError.message}`);
                }
            }
        }

    } catch (error) {
        console.error('[UserInactivityJob] Error general en la tarea:', error.message);
    }
    console.log('[UserInactivityJob] Tarea finalizada.');
};

// --------------------------------------------------------------------------
// 3. EL SCHEDULER: Programación del CRON
// --------------------------------------------------------------------------
const scheduleUserInactivityCheck = () => {
    cron.schedule('0 4 * * *', runUserInactivityJob, {
        timezone: "America/Argentina/Buenos_Aires"
    });
    console.log('💤 Cron Job de inactividad de usuarios programado (04:00 AM).');
};

export { scheduleUserInactivityCheck, runUserInactivityJob };