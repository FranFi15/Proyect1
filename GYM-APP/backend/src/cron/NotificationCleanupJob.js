// GYM-APP/backend/src/cron/NotificationCleanupJob.js
import cron from 'node-cron';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const SUPER_ADMIN_API_URL = process.env.ADMIN_PANEL_API_URL;
const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

/**
 * Lógica específica para limpiar notificaciones en una conexión dada
 */
const cleanupNotificationsForGym = async (gymDBConnection, clientId) => {
    try {
        const { Notification } = getModels(gymDBConnection);

        // 1. Calcular la fecha de corte (hace 1 mes exacto)
        const fechaLimite = new Date();
        fechaLimite.setMonth(fechaLimite.getMonth() - 1);

        // 2. Ejecutar la eliminación
        // Usamos createdAt porque tu Schema tiene timestamps: true
        const result = await Notification.deleteMany({ 
            createdAt: { $lte: fechaLimite } 
        });

        if (result.deletedCount > 0) {
            console.log(`[NotificationCleanup - ${clientId}] Se eliminaron ${result.deletedCount} notificaciones antiguas.`);
        } else {
            // Opcional: comentar esto para no llenar el log si no hubo cambios
            // console.log(`[NotificationCleanup - ${clientId}] No hubo notificaciones antiguas para borrar.`);
        }

    } catch (error) {
        console.error(`[NotificationCleanup - ${clientId}] Error al limpiar notificaciones:`, error);
    }
};

/**
 * Función principal que itera sobre los gimnasios
 */
const runNotificationCleanupJob = async () => {
    console.log('[NotificationCleanup] Iniciando limpieza de notificaciones...');
    
    if (!SUPER_ADMIN_API_URL || !INTERNAL_ADMIN_API_KEY) {
        console.error('[NotificationCleanup] Error: Variables de entorno no configuradas.');
        return;
    }

    try {
        // 1. Obtener lista de clientes (Gimnasios)
        const response = await axios.get(`${SUPER_ADMIN_API_URL}/api/clients/internal/all-clients`, {
            headers: { 'x-internal-api-key': INTERNAL_ADMIN_API_KEY },
        });

        const clients = response.data;
        if (!Array.isArray(clients) || clients.length === 0) {
            console.log('[NotificationCleanup] No hay clientes activos para procesar.');
            return;
        }

        // 2. Iterar sobre cada gimnasio
        for (const client of clients) {
            // Procesamos solo si está activo o en periodo de prueba
            if (client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba') {
                try {
                    const clientTz = client.timezone || 'America/Argentina/Buenos_Aires';
                    const currentHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: clientTz, hour: 'numeric', hour12: false }).format(new Date()), 10);
                    if (currentHour === 4) {
                        // Conexión dinámica
                        const { connection } = await connectToGymDB(client.clientId); 
                        
                        // Ejecutar la limpieza
                        await cleanupNotificationsForGym(connection, client.clientId);
                    }
                } catch (gymError) {
                    console.error(`[NotificationCleanup] Error en gimnasio ${client.nombre} (ID: ${client.clientId}): ${gymError.message}`);
                }
            } 
        }
    } catch (error) {
        console.error('[NotificationCleanup] Error general en el Job:', error.message);
    }
    console.log('[NotificationCleanup] Job de limpieza finalizado.');
};


const scheduleNotificationCleanup = () => {
    // Se ejecuta cada hora para comprobar qué gimnasios están a las 04:00 AM en su huso horario
    cron.schedule('0 * * * *', runNotificationCleanupJob, {
        timezone: "UTC"
    });
    console.log('🧹 Cron Job de limpieza de notificaciones programado (comprobación por huso horario local cada hora).');
};

export { scheduleNotificationCleanup, runNotificationCleanupJob };