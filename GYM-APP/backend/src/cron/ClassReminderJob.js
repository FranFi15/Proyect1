import cron from 'node-cron';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';
import axios from 'axios';
import { addHours, subMinutes, addMinutes, subDays, addDays } from 'date-fns';
import { sendSingleNotification } from '../controllers/notificationController.js'; 

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const SUPER_ADMIN_API_URL = process.env.ADMIN_PANEL_API_URL;
const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

const checkAndSendReminders = async (gymDBConnection, clientId) => {
    try {
        const { Clase, User, Notification } = getModels(gymDBConnection);
        
        const now = new Date();
        const targetTime = addHours(now, 2);

        // Ventana de tolerancia: Buscamos clases que empiecen entre 1h 45m y 2h 15m desde AHORA
        const windowStart = subMinutes(targetTime, 15);
        const windowEnd = addMinutes(targetTime, 15);

        console.log(`[Reminder Debug] Hora Servidor (UTC): ${now.toISOString()}`);
        console.log(`[Reminder Debug] Buscando clases que inicien entre:`);
        console.log(`   Desde: ${windowStart.toISOString()}`);
        console.log(`   Hasta: ${windowEnd.toISOString()}`);

        // 1. QUERY CORREGIDA: Buscamos en un rango amplio (ayer, hoy y mañana)
        // Esto evita errores si la fecha UTC cambia de día justo en la ventana de 2hs
        const broadStart = subDays(now, 1);
        const broadEnd = addDays(now, 2);

        const potentialClasses = await Clase.find({
            fecha: { $gte: broadStart, $lte: broadEnd },
            estado: 'activa',
            usuariosInscritos: { $not: { $size: 0 } } 
        }).populate('tipoClase', 'nombre'); // Populate para ver el nombre en el log

        console.log(`[Reminder Debug] Clases candidatas encontradas en DB: ${potentialClasses.length}`);

        for (const clase of potentialClasses) {
            // 2. Construir fecha exacta
            const classDateString = clase.fecha.toISOString().split('T')[0]; 
            const classDateTimeString = `${classDateString}T${clase.horaInicio}:00-03:00`; 
            const classStartTime = new Date(classDateTimeString);

            // console.log(`   -> Revisando clase "${clase.nombre || 'Sin nombre'}" - Inicio: ${classStartTime.toISOString()}`);

            // 3. Verificar ventana exacta
            if (classStartTime >= windowStart && classStartTime <= windowEnd) {
                
                console.log(`✅ MATCH! La clase ${clase.nombre} inicia a las ${clase.horaInicio} (en ~2hs). Procesando...`);

                for (const userId of clase.usuariosInscritos) {
                    const existingNotif = await Notification.findOne({
                        user: userId,
                        class: clase._id,
                        type: 'class_reminder_2h'
                    });

                    if (!existingNotif) {
                        const title = `⏰ Tu Turno "${clase.nombre}" empieza en 2 hs`;
                        const message = `Si no puedes asistir, anula tu inscripción ahora para liberar el cupo y recuperar tu crédito.`;

                        await sendSingleNotification(
                            Notification,
                            User,
                            userId,
                            title,
                            message,
                            'class_reminder_2h',
                            true,
                            clase._id
                        );
                        console.log(`      -> 📨 Notificación enviada al usuario ${userId}`);
                    } else {
                        console.log(`      -> ⏭️ Usuario ${userId} ya fue notificado.`);
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
                    // Silent fail
                }
            }
        }
    } catch (error) {
        console.error('[ClassReminderJob] Error:', error.message);
    }
};

const scheduleClassReminders = () => {
    cron.schedule('*/15 * * * *', runClassReminderJob);
    console.log('⏰ Cron Job de Recordatorios (2hs antes) iniciado.');
};

export { scheduleClassReminders, runClassReminderJob };