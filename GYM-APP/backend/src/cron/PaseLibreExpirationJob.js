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
            const clientTz = client.timezone || 'America/Argentina/Buenos_Aires';
            const currentHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: clientTz, hour: 'numeric', hour12: false }).format(new Date()), 10);
            if (currentHour !== 9) continue;

            const { connection } = await connectToGymDB(clientId);
            if (!connection) continue;
            
            const { User, Notification } = getModels(connection);

            // Buscamos usuarios que tengan un pase libre o membresía activo y que venza mañana
            const expiringUsers = await User.find({
                isActive: true,
                $or: [
                    { paseLibreHasta: { $gte: startOfTargetDay, $lte: endOfTargetDay } },
                    { membresiaHasta: { $gte: startOfTargetDay, $lte: endOfTargetDay } }
                ],
                pushToken: { $exists: true, $ne: null } // Solo usuarios con notificaciones activas
            });

            if (expiringUsers.length === 0) continue;

            for (const user of expiringUsers) {
                const isPaseLibreExpiring = user.paseLibreHasta && user.paseLibreHasta >= startOfTargetDay && user.paseLibreHasta <= endOfTargetDay;
                const expirationDate = isPaseLibreExpiring ? user.paseLibreHasta : user.membresiaHasta;
                const tipoNombre = isPaseLibreExpiring ? "Pase Libre" : "Membresía";

                // Verificar si ya se envió notificación hoy para no duplicar
                const existingNotification = await Notification.findOne({
                    user: user._id,
                    type: 'pase_libre_expiration',
                    createdAt: { $gte: startOfDay(today) } // Creada hoy
                });

                if (!existingNotification) {
                    const expirationDateFormatted = format(expirationDate, "EEEE d 'de' MMMM", { locale: es });
                    const title = `¡Tu ${tipoNombre} vence pronto!`;
                    const message = `Hola ${user.nombre}, te recordamos que tu ${tipoNombre} finaliza mañana ${expirationDateFormatted}.`;

                    await sendSingleNotification(
                        Notification,
                        User,
                        user._id,
                        title,
                        message,
                        'pase_libre_expiration',
                        true, // isImportant
                        null
                    );
                    console.log(`🔔 Aviso de vencimiento de ${tipoNombre} enviado a ${user.email} (Gym: ${clientId})`);
                }
            }
        } catch (error) {
            console.error(`❌ Error procesando el gimnasio ${clientId} en el cron de Pase Libre:`, error.message);
        }
    }
    console.log('✅ Verificación de vencimientos de Pase Libre finalizada.');
});

export const schedulePaseLibreExpirationCheck = () => {
    // Se ejecuta cada hora para comprobar qué gimnasios están a las 09:00 AM en su zona horaria
    cron.schedule('0 * * * *', checkPaseLibreExpiration, {
        timezone: "UTC"
    });
    console.log('🕒 Cron Job de aviso de vencimiento de Pase Libre programado (comprobación 09:00 AM hora local cada hora).');
};

// Exportamos también la función runner para poder probarla manualmente desde debugRoutes
export { checkPaseLibreExpiration };