import cron from 'node-cron';
import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import connectToGymDB from '../config/mongoConnectionManager.js'; 
import { format } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { addHours, format as formatTz } from 'date-fns-tz';
import { sendSingleNotification } from '../controllers/notificationController.js';
import axios from 'axios';

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

const checkUpcomingClasses = asyncHandler(async () => {
    console.log('⏰ Ejecutando tarea horaria: Verificación de recordatorios de turnos...');
    
    const activeClients = await getAllActiveClients();
    const timeZone = 'America/Argentina/Buenos_Aires';

    for (const client of activeClients) {
        const clientId = client.clientId;
        let gymDBConnection; 
        
        try {
            const { connection } = await connectToGymDB(clientId);
            if (!connection) continue;
            gymDBConnection = connection;
            
            const { Clase, Notification, User } = getModels(gymDBConnection);

            
            // 1. Obtenemos la hora actual en Argentina (ej: 10:30 AM)
            const nowInArgentina = utcToZonedTime(new Date(), timeZone);
            
            // 2. Calculamos la hora de la ventana de búsqueda (ej: 12:30 PM)
            const twoHoursFromNowInArgentina = addHours(nowInArgentina, 2);
            
            // 3. Formateamos la hora de inicio de la ventana (ej: "12:00")
            const startOfWindowStr = formatTz(twoHoursFromNowInArgentina, 'HH:00', { timeZone });
            // 4. Formateamos la hora de fin de la ventana (ej: "12:59")
            const endOfWindowStr = formatTz(twoHoursFromNowInArgentina, 'HH:59', { timeZone });
            
            // 5. Obtenemos la fecha de hoy en formato UTC para comparar con la BD
            // Usamos la fecha de la ventana por si el cron corre justo a medianoche
            const targetDate = formatTz(twoHoursFromNowInArgentina, 'yyyy-MM-dd', { timeZone });
            const startOfDayUTC = zonedTimeToUtc(`${targetDate}T00:00:00`, timeZone);
            const endOfDayUTC = zonedTimeToUtc(`${targetDate}T23:59:59`, timeZone);

            // 6. Buscamos clases activas
            const classesInWindow = await Clase.find({
                fecha: { 
                    $gte: startOfDayUTC,
                    $lte: endOfDayUTC
                },
                horaInicio: {
                    $gte: startOfWindowStr, 
                    $lte: endOfWindowStr   
                },
                estado: 'activa'
            }).populate('tipoClase', 'nombre');

            if (classesInWindow.length === 0) continue;

            for (const clase of classesInWindow) {
                const title = "¡Tu turno es pronto!";
                const message = `Recordatorio: Tu turno de "${clase.nombre || clase.tipoClase.nombre}" comienza a las ${clase.horaInicio}hs.`;

                for (const userId of clase.usuariosInscritos) {
                    const existingNotification = await Notification.findOne({
                        user: userId,
                        class: clase._id,
                        type: 'class_reminder_2hr'
                    });

                    if (!existingNotification) {
                        await sendSingleNotification(
                            Notification,
                            User,
                            userId,
                            title,
                            message,
                            'class_reminder_2hr',
                            true, 
                            clase._id
                        );
                    }
                }
            }
            console.log(`✅ Recordatorios de 2 horas enviados para el gimnasio ${clientId}.`);
        } catch (error) {
            console.error(`❌ Error procesando el gimnasio ${clientId} en el cron de Recordatorios:`, error.message);
        }
    }
});

export const scheduleClassReminders = () => {
    cron.schedule('0 * * * *', checkUpcomingClasses, {
        timezone: "America/Argentina/Buenos_Aires"
    });
};