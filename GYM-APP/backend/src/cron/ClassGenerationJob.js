// GYM-APP/backend/src/cron/ClassGenerationJob.js
import cron from 'node-cron';
import connectToGymDB from '../config/mongoConnectionManager.js'; // Necesario para el cron job
import { generateFutureFixedClasses } from '../controllers/classController.js'; 

// Import environmental variables for SUPER_ADMIN_API_URL and INTERNAL_ADMIN_API_KEY
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Adjust path if .env is not in the root of the backend folder

const ADMIN_PANEL_API_URL = process.env.ADMIN_PANEL_API_URL;
const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

export const scheduleMonthlyClassGeneration = () => {
    

    // Cron schedule: Se ejecuta cada hora para comprobar qué clientes están a las 02:00 AM del día 1 en su huso horario
    cron.schedule('0 * * * *', async () => { 
        if (!ADMIN_PANEL_API_URL || !INTERNAL_ADMIN_API_KEY) {
            console.error('[Cron Job: Class Generation] Error: ADMIN_PANEL_API_URL o INTERNAL_ADMIN_API_KEY no están configuradas en .env. El cron job no se ejecutará completamente.');
            return;
        }

        try {
            const response = await fetch(`${ADMIN_PANEL_API_URL}/clients/internal/all-clients`, { // Adjust path if needed
                headers: {
                    'x-internal-api-key': INTERNAL_ADMIN_API_KEY,
                },
            });
            const clients = await response.json();

            if (!response.ok) {
                throw new Error(clients.message || 'Error al obtener clientes del panel de administración para generación de clases.');
            }

            if (!Array.isArray(clients) || clients.length === 0) {
                return;
            }

            for (const client of clients) {
                if (client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba') {
                    try {
                        const clientTz = client.timezone || 'America/Argentina/Buenos_Aires';
                        const parts = new Intl.DateTimeFormat('en-US', { timeZone: clientTz, day: 'numeric', hour: 'numeric', hour12: false }).formatToParts(new Date());
                        const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
                        const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);

                        if (day === 1 && hour === 2) {
                            let gymDBConnection = await connectToGymDB(client.clientId); 
                            await generateFutureFixedClasses(gymDBConnection.connection || gymDBConnection);
                        }
                    } catch (gymError) {
                        console.error(`[Cron Job: Class Generation] Error al procesar DB del gimnasio ${client.nombre} (ID: ${client.clientId}): ${gymError.message}`);
                    }
                } 
            }
        } catch (error) {
            console.error('[Cron Job: Class Generation] Error general en la tarea programada:', error);
        }
    }, {
        timezone: "UTC" 
    });
};