import cron from 'node-cron';
import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import connectToGymDB from '../config/mongoConnectionManager.js'; 
import { sendSingleNotification } from '../controllers/notificationController.js';
import { addDays, startOfDay, endOfDay, format } from 'date-fns';
import { es } from 'date-fns/locale';
import axios from 'axios';

// Reutilizamos la función para obtener clientes activos
const getAllActiveClients = async () => {
    try {
        const adminApiUrl = process.env.ADMIN_PANEL_API_URL;
        const internalApiKey = process.env.INTERNAL_ADMIN_API_KEY;

        if (!adminApiUrl || !internalApiKey) {
            throw new Error('Variables de entorno del Admin Panel no configuradas.');
        }

        const response = await axios.get(`${adminApiUrl}/api/clients/internal/all-clients`, {
            headers: { 'x-internal-api-key': internalApiKey }
        });

        if (!response.data || !Array.isArray(response.data)) {
            throw new Error('La respuesta del panel de administración no es un array de clientes válido.');
        }

        return response.data.filter(client => client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba');
    } catch (error) {
        console.error("Error crítico al obtener la lista de clientes activos:", error.response?.data || error.message);
        throw error;
    }
};

const checkPaseLibreExpiration = asyncHandler(async () => {
    console.log('⏰ Ejecutando tarea diaria: Verificación de vencimiento de Pase Libre...');
    
    const activeClients = await getAllActiveClients();

    // Configuración: Avisar 1 día antes del vencimiento
    // Si hoy es 10, buscamos pases que vencen el 11 (mañana)
    const daysBeforeExpiration = 1; 
    
    const today = new Date();
    const targetDate = addDays(today, daysBeforeExpiration);
    
    // Definimos el rango de búsqueda para "mañana" (todo el día)
    // Usamos UTC porque así se guardan las fechas en Mongo (T12:00:00Z o similar)
    const startOfTargetDay = startOfDay(targetDate);
    const endOfTargetDay = endOfDay(targetDate);

    for (const client of activeClients) {
        const clientId = client.clientId; 
        
        try {
            const { connection } = await connectToGymDB(clientId);
            if (!connection) continue;
            
            const { User, Notification } = getModels(connection);

            // Buscamos usuarios que tengan un pase libre activo y que venza mañana
            const expiringUsers = await User.find({
                isActive: true,
                paseLibreHasta: {
                    $gte: startOfTargetDay,
                    $lte: endOfTargetDay
                },
                pushToken: { $exists: true, $ne: null } // Solo usuarios con notificaciones activas
            });

            if (expiringUsers.length === 0) continue;

            for (const user of expiringUsers) {
                // Verificar si ya se envió notificación hoy para no duplicar (opcional pero recomendado)
                const existingNotification = await Notification.findOne({
                    user: user._id,
                    type: 'pase_libre_expiration',
                    createdAt: { $gte: startOfDay(today) } // Creada hoy
                });

                if (!existingNotification) {
                    const expirationDateFormatted = format(user.paseLibreHasta, "EEEE d 'de' MMMM", { locale: es });
                    const title = "¡Tu Pase Libre vence pronto!";
                    const message = `Hola ${user.nombre}, te recordamos que tu Pase Libre finaliza mañana ${expirationDateFormatted}.`;

                    await sendSingleNotification(
                        Notification,
                        User,
                        user._id,
                        title,
                        message,
                        'pase_libre_expiration',
                        true, // isImportant (para que salga el modal si quieres, o false si es solo push)
                        null
                    );
                    console.log(`🔔 Aviso de vencimiento de Pase Libre enviado a ${user.email} (Gym: ${clientId})`);
                }
            }
        } catch (error) {
            console.error(`❌ Error procesando el gimnasio ${clientId} en el cron de Pase Libre:`, error.message);
        }
    }
    console.log('✅ Verificación de vencimientos de Pase Libre finalizada.');
});

export const schedulePaseLibreExpirationCheck = () => {
    // Se ejecuta todos los días a las 09:00 AM hora Argentina
    cron.schedule('0 9 * * *', checkPaseLibreExpiration, {
        timezone: "America/Argentina/Buenos_Aires"
    });
    console.log('🕒 Cron Job de aviso de vencimiento de Pase Libre programado (09:00 AM).');
};

// Exportamos también la función runner para poder probarla manualmente desde debugRoutes
export { checkPaseLibreExpiration };