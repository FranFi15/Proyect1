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
    

    // Cron schedule: '0 2 1 * *' means at 02:00 (2 AM) on day 1 of every month.
    cron.schedule('0 2 1 * *', async () => { 
       

        if (!ADMIN_PANEL_API_URL || !INTERNAL_ADMIN_API_KEY) {
            console.error('[Cron Job: Class Generation] Error: ADMIN_PANEL_API_URL o INTERNAL_ADMIN_API_KEY no están configuradas en .env. El cron job no se ejecutará completamente.');
            return;
        }

        try {
            
            const response = await fetch(`${ADMIN_PANEL_API_URL}/clients/internal/all-clients`, { // Adjust path if needed
                headers: {
                    'Authorization': `Bearer ${INTERNAL_ADMIN_API_KEY}`,
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
                    
                    let gymDBConnection;
                    try {
                        gymDBConnection = await connectToGymDB(client.clientId, client.apiSecretKey); 
                       
                        await generateFutureFixedClasses(gymDBConnection);
                        
                    } catch (gymError) {
                        console.error(`[Cron Job: Class Generation] Error al procesar DB del gimnasio ${client.nombre} (ID: ${client.clientId}): ${gymError.message}`);
                    }
                } 
            }
        } catch (error) {
            console.error('[Cron Job: Class Generation] Error general en la tarea programada:', error);
        }
    }, {
        timezone: "America/Argentina/Buenos_Aires" 
    });
};