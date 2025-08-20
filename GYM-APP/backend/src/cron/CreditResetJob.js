// GYM-APP/backend/src/cron/CreditResetJob.js
import cron from 'node-cron';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';
import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const SUPER_ADMIN_API_URL = process.env.ADMIN_PANEL_API_URL;
const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

const resetCreditsForCurrentGym = async (gymDBConnection, clientId) => {
    try {
        const { User, TipoClase } = getModels(gymDBConnection);

        const classTypesToReset = await TipoClase.find({ resetMensual: true });
        const classTypeIdsToReset = new Set(classTypesToReset.map(ct => ct._id.toString()));

        if (classTypeIdsToReset.size === 0) {
            console.log(`[CreditResetJob - ${clientId}] No hay tipos de clase para reiniciar.`);
            return;
        }

        const usersToUpdate = await User.find({
            $or: [
                { 'creditosPorTipo': { $exists: true, $ne: {} } }, 
                { 'monthlySubscriptions.0': { $exists: true } }
            ]
        });

        if (usersToUpdate.length === 0) {
            console.log(`[CreditResetJob - ${clientId}] No se encontraron usuarios con créditos para procesar.`);
            return;
        }

        for (const user of usersToUpdate) {
            let userModified = false;

            if (user.creditosPorTipo && user.creditosPorTipo.size > 0) {
                for (const tipoClaseId of user.creditosPorTipo.keys()) {
                    if (classTypeIdsToReset.has(tipoClaseId)) {
                        user.creditosPorTipo.delete(tipoClaseId);
                        userModified = true;
                    }
                }
            }

            for (const sub of user.monthlySubscriptions) {
                if (sub.status === 'automatica' && sub.autoRenewAmount > 0) {
                    const tipoClaseId = sub.tipoClase.toString();
                    const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
                    user.creditosPorTipo.set(tipoClaseId, currentCredits + sub.autoRenewAmount);
                    sub.lastRenewalDate = new Date();
                    userModified = true;
                }
            }
            
            if (userModified) {
                user.markModified('creditosPorTipo');
                await user.save();
            }
        }
        console.log(`[CreditResetJob - ${clientId}] Créditos procesados para ${usersToUpdate.length} usuarios.`);

    } catch (error) {
        console.error(`[CreditResetJob - ${clientId}] Error al reiniciar créditos:`, error);
    }
};



const runCreditResetJob = async () => {
    console.log('[CreditResetJob] Iniciando job de reinicio de créditos...');
    if (!SUPER_ADMIN_API_URL || !INTERNAL_ADMIN_API_KEY) {
        console.error('[CreditResetJob] Error: Variables de entorno no configuradas.');
        return;
    }
    try {
        const response = await axios.get(`${SUPER_ADMIN_API_URL}/api/clients/internal/all-clients`, {
            headers: { 'x-internal-api-key': INTERNAL_ADMIN_API_KEY },
        });

        const clients = response.data;
        if (!Array.isArray(clients) || clients.length === 0) {
            console.log('[CreditResetJob] No hay clientes activos para procesar.');
            return;
        }

        for (const client of clients) {
            if (client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba') {
                try {
                    // --- ¡CORRECCIÓN AQUÍ! ---
                    // Destructuramos el objeto para obtener solo la 'connection'.
                    const { connection } = await connectToGymDB(client.clientId); 
                    
                    // Pasamos la conexión correcta a la función worker.
                    await resetCreditsForCurrentGym(connection, client.clientId);
                    
                } catch (gymError) {
                    console.error(`[CreditResetJob] Error al procesar gimnasio ${client.nombre} (ID: ${client.clientId}): ${gymError.message}`);
                }
            } 
        }
    } catch (error) {
        console.error('[CreditResetJob] Error general en la tarea:', error.message);
    }
    console.log('[CreditResetJob] Job de reinicio de créditos finalizado.');
};

// --- La función scheduleMonthlyCreditReset ahora llama a la nueva función exportable ---
const scheduleMonthlyCreditReset = () => {
    cron.schedule('0 0 1 * *', runCreditResetJob, { // Ahora llama a la función runCreditResetJob
        timezone: "America/Argentina/Buenos_Aires"
    });
    console.log('🕒 Cron Job de reinicio de créditos mensual programado.');
};

export { scheduleMonthlyCreditReset, runCreditResetJob, resetCreditsForCurrentGym };