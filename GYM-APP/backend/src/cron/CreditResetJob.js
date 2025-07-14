// GYM-APP/backend/src/cron/CreditResetJob.js
import cron from 'node-cron';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Adjust path if .env is not in the root of the backend folder

const SUPER_ADMIN_API_URL = process.env.ADMIN_PANEL_API_URL;
const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

export const resetCreditsForCurrentGym = async (gymDBConnection, clientId) => {
    try {
        const { User, Configuracion } = getModels(gymDBConnection);

        // Get the configuration for monthsAnticipacion. Default to 1 if not found.
        const config = await Configuracion.findOne();
        const monthsAnticipacion = config ? config.mesesAnticipacion : 1;
        // Update all users in this gym
        // Resetting all credit types to 0.
        // For monthly subscriptions with 'automatica' status, handle auto-renewal.
        const usersToUpdate = await User.find({
            $or: [
                { 'creditosPorTipo.0': { $exists: true } }, // Users with any credits
                { 'monthlySubscriptions.0': { $exists: true } } // Users with any subscriptions
            ]
        });

        let updatedUsersCount = 0;

        for (const user of usersToUpdate) {
            let userModified = false;

            // Reset all existing credits to 0
            if (user.creditosPorTipo && user.creditosPorTipo.size > 0) {
                user.creditosPorTipo = new Map(); // Clear all credits
                userModified = true;
                
            }

            // Process monthly subscriptions for auto-renewal
            const updatedSubscriptions = [];
            for (const sub of user.monthlySubscriptions) {
                if (sub.status === 'automatica' && sub.autoRenewAmount > 0) {
                    const tipoClaseId = sub.tipoClase.toString();
                    user.creditosPorTipo.set(tipoClaseId, (user.creditosPorTipo.get(tipoClaseId) || 0) + sub.autoRenewAmount);
                    sub.lastRenewalDate = new Date(); // Update last renewal date
                    userModified = true;
                }
                updatedSubscriptions.push(sub);
            }
            user.monthlySubscriptions = updatedSubscriptions; // Reassign to ensure Mongoose detects changes if direct modification doesn't work reliably

            if (userModified) {
                await user.save();
                updatedUsersCount++;
            }
        }

        
    } catch (error) {
        console.error(`[CreditResetJob - ${clientId}] Error al reiniciar créditos:`, error);
        // Depending on error, you might want to send a notification to a superadmin or log to a file
    } finally {
        // Close the connection if it's not managed globally (though connectToGymDB usually handles pooling)
        // If your mongoConnectionManager.js keeps connections open in a pool, this might not be needed.
        // For standalone cron jobs, explicit close might be good practice.
    }
};


export const scheduleMonthlyCreditReset = () => {
    // Cron schedule: '0 0 1 * *' means at 00:00 (midnight) on day 1 of every month.
    // This effectively resets credits for the *previous* month.
    cron.schedule('0 0 1 * *', async () => {

        if (!SUPER_ADMIN_API_URL || !INTERNAL_ADMIN_API_KEY) {
            console.error('[Cron Job: Monthly Credit Reset] Error: ADMIN_PANEL_API_URL o INTERNAL_ADMIN_API_KEY no están configuradas en .env. El cron job no se ejecutará completamente.');
            return;
        }

        try {
            const response = await fetch(`${SUPER_ADMIN_API_URL}/clients/internal/all-clients`, { // Corrected path based on typical structure
                headers: {
                    'x-internal-api-key': INTERNAL_ADMIN_API_KEY,
                },
            });
            const clients = await response.json();

            if (!response.ok) {
                throw new Error(clients.message || 'Error al obtener clientes del panel de administración para reinicio de créditos.');
            }

            if (!Array.isArray(clients) || clients.length === 0) {
                return;
            }

            for (const client of clients) {
                if (client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba') {
                    let gymDBConnection;
                    try {
                        gymDBConnection = await connectToGymDB(client.clientId, client.apiSecretKey); 
                        await resetMonthlyCreditsForGym(gymDBConnection, client.clientId);
                    } catch (gymError) {
                        console.error(`[Cron Job: Monthly Credit Reset] Error al procesar DB del gimnasio ${client.nombre} (ID: ${client.clientId}): ${gymError.message}`);
                    }
                } else {
                    console.log(`[Cron Job: Monthly Credit Reset] Saltando gimnasio ${client.nombre} debido a estado de suscripción: ${client.estadoSuscripcion}`);
                }
            }
        } catch (error) {
            console.error('[Cron Job: Monthly Credit Reset] Error general en la tarea de reinicio de créditos:', error);
        }
    }, {
        timezone: "America/Argentina/Buenos_Aires" // Ensure this is the correct timezone for your server
    });
};