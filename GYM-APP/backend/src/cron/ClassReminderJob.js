import cron from 'node-cron';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';
import axios from 'axios';
import { addHours, subMinutes, addMinutes, format, parseISO } from 'date-fns';
import { sendSingleNotification } from '../controllers/notificationController.js'; // Asegúrate de importar esto

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const SUPER_ADMIN_API_URL = process.env.ADMIN_PANEL_API_URL;
const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

const checkAndSendReminders = async (gymDBConnection, clientId) => {
    try {
        const { Clase, User, Notification } = getModels(gymDBConnection);
        
        // Obtenemos la hora actual en UTC
        const now = new Date();
        
        // Calculamos el objetivo: 2 horas en el futuro
        // Ejemplo: Si son las 16:00, buscamos clases de las 18:00
        const targetTime = addHours(now, 2);

        // Definimos una ventana de tiempo de 30 minutos (15 antes, 15 despues)
        // para asegurar que atrapamos la clase aunque el cron corra con desfase
        const windowStart = subMinutes(targetTime, 15);
        const windowEnd = addMinutes(targetTime, 15);

        // 1. Buscamos clases activas que coincidan con la FECHA de hoy
        // Nota: Como 'fecha' en tu modelo suele ser a las 00:00 o 12:00, usamos rango del día
        const startOfDay = new Date(targetTime);
        startOfDay.setUTCHours(0,0,0,0);
        const endOfDay = new Date(targetTime);
        endOfDay.setUTCHours(23,59,59,999);

        const potentialClasses = await Clase.find({
            fecha: { $gte: startOfDay, $lte: endOfDay },
            estado: 'activa',
            usuariosInscritos: { $not: { $size: 0 } } // Solo clases con alumnos
        });

        for (const clase of potentialClasses) {
            // 2. Construir la fecha exacta de inicio de la clase
            // Tu 'horaInicio' es string "18:00". Combinamos con la fecha.
            // Asumimos hora Argentina/Local para el string, convertimos para comparar
            
            const classDateString = clase.fecha.toISOString().split('T')[0]; // "2023-10-25"
            const classDateTimeString = `${classDateString}T${clase.horaInicio}:00-03:00`; // Formato ISO con timezone AR
            const classStartTime = new Date(classDateTimeString);

            // 3. Verificar si esta clase empieza dentro de la ventana de 2 horas
            if (classStartTime >= windowStart && classStartTime <= windowEnd) {
                
                console.log(`[Reminder] La clase ${clase.nombre} inicia a las ${clase.horaInicio}. Procesando recordatorios...`);

                for (const userId of clase.usuariosInscritos) {
                    // 4. EVITAR DUPLICADOS: Verificar si ya le enviamos notificación a este usuario para esta clase
                    const existingNotif = await Notification.findOne({
                        user: userId,
                        class: clase._id,
                        type: 'class_reminder_2h' // Un tipo específico para identificarlo
                    });

                    if (!existingNotif) {
                        // Enviamos la notificación
                        const title = "⏰ Tu clase comienza en 2 hs";
                        const message = `Recuerda: Si no puedes asistir a "${clase.nombre || clase.tipoClase}", anula tu inscripción ahora para liberar el cupo y recuperar tu crédito.`;

                        await sendSingleNotification(
                            Notification,
                            User,
                            userId,
                            title,
                            message,
                            'class_reminder_2h', // Tipo nuevo
                            true, // Es Push
                            clase._id
                        );
                        console.log(` -> Enviado a usuario ${userId}`);
                    }
                }
            }
        }

    } catch (error) {
        console.error(`Error enviando recordatorios en gym ${clientId}:`, error);
    }
};

const runClassReminderJob = async () => {
    // console.log('[ClassReminderJob] Buscando clases próximas a iniciar...');
    if (!SUPER_ADMIN_API_URL || !INTERNAL_ADMIN_API_KEY) return;

    try {
        const response = await axios.get(`${SUPER_ADMIN_API_URL}/api/clients/internal/all-clients`, {
            headers: { 'x-internal-api-key': INTERNAL_ADMIN_API_KEY },
        });

        const clients = response.data;
        if (!Array.isArray(clients)) return;

        for (const client of clients) {
            if (client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba') {
                try {
                    const { connection } = await connectToGymDB(client.clientId);
                    await checkAndSendReminders(connection, client.clientId);
                } catch (e) {
                    // Silent fail para no ensuciar logs
                }
            }
        }
    } catch (error) {
        console.error('[ClassReminderJob] Error:', error.message);
    }
};

// Programamos para que corra cada 15 minutos
// Así aseguramos no perder ninguna clase sin importar la hora de inicio
const scheduleClassReminders = () => {
    cron.schedule('*/15 * * * *', runClassReminderJob);
    console.log('⏰ Cron Job de Recordatorios (2hs antes) iniciado.');
};

export { scheduleClassReminders, runClassReminderJob };