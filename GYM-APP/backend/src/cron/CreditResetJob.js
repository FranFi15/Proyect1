// GYM-APP/backend/src/cron/CreditResetJob.js
import cron from 'node-cron';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const SUPER_ADMIN_API_URL = process.env.ADMIN_PANEL_API_URL;
const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

const resetCreditsForCurrentGym = async (gymDBConnection, clientId) => {
    try {
        const { User, TipoClase } = getModels(gymDBConnection);

        // 1. Obtener todos los tipos de clase que SÍ deben reiniciarse mensualmente.
        const classTypesToReset = await TipoClase.find({ resetMensual: true });
        const classTypeIdsToReset = new Set(classTypesToReset.map(ct => ct._id.toString()));

        // 2. Encontrar todos los usuarios que tengan créditos o suscripciones.
        const usersToUpdate = await User.find({
            $or: [
                { 'creditosPorTipo.0': { $exists: true } },
                { 'monthlySubscriptions.0': { $exists: true } }
            ]
        });

        for (const user of usersToUpdate) {
            let userModified = false;

            // 3. Reiniciar créditos solo para los tipos de clase marcados para reinicio.
            if (user.creditosPorTipo && user.creditosPorTipo.size > 0) {
                const newCreditsMap = new Map(user.creditosPorTipo);
                let creditsWereReset = false;

                for (const [tipoClaseId, creditos] of newCreditsMap.entries()) {
                    if (classTypeIdsToReset.has(tipoClaseId)) {
                        newCreditsMap.delete(tipoClaseId); // Elimina el crédito si debe reiniciarse
                        creditsWereReset = true;
                    }
                }

                if (creditsWereReset) {
                    user.creditosPorTipo = newCreditsMap;
                    userModified = true;
                }
            }

            // 4. Procesar suscripciones mensuales para renovación automática (esto añade créditos nuevos).
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
                await user.save();
            }
        }

    } catch (error) {
        console.error(`[CreditResetJob - ${clientId}] Error al reiniciar créditos:`, error);
    }
};








const runCreditResetJob = async () => {
    if (!SUPER_ADMIN_API_URL || !INTERNAL_ADMIN_API_KEY) {
        console.error('[Cron Job: Monthly Credit Reset] Error: Variables de entorno no configuradas. El cron job no se ejecutará.');
        return;
    }
    try {
        const response = await fetch(`${SUPER_ADMIN_API_URL}/api/clients/internal/all-clients`, {
             headers: { 'x-internal-api-key': INTERNAL_ADMIN_API_KEY },
        });
        const clients = await response.json();
        if (!response.ok) {
            throw new Error(clients.message || 'Error al obtener clientes.');
        }
        if (!Array.isArray(clients) || clients.length === 0) {
            return;
        }

        for (const client of clients) {
            if (client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba') {
                let gymDBConnection;
                try {
                    gymDBConnection = await connectToGymDB(client.clientId, client.apiSecretKey); 
                    await resetCreditsForCurrentGym(gymDBConnection, client.clientId);
                    
                } catch (gymError) {
                    console.error(`[Cron Job] Error al procesar DB del gimnasio ${client.nombre} (ID: ${client.clientId}): ${gymError.message}`);
                }
            } 
        }
    } catch (error) {
        console.error('[Cron Job] Error general en la tarea de reinicio de créditos:', error);
    }
};

// --- La función scheduleMonthlyCreditReset ahora llama a la nueva función exportable ---
const scheduleMonthlyCreditReset = () => {
    cron.schedule('0 0 1 * *', runCreditResetJob, { // Ahora llama a la función runCreditResetJob
        timezone: "America/Argentina/Buenos_Aires"
    });
};

export { scheduleMonthlyCreditReset, runCreditResetJob, resetCreditsForCurrentGym };