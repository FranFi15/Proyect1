import cron from 'node-cron';
import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import connectToGymDB from '../config/mongoConnectionManager.js';
import { format } from 'date-fns';
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
        throw error; // Relanzamos el error para que el runner principal lo maneje
    }
};

const checkUpcomingClasses = asyncHandler(async () => {
    console.log('⏰ Ejecutando tarea horaria: Verificación de recordatorios de turnos...');
    
    // Usamos tu función para obtener los clientes
    const activeClients = await getAllActiveClients();

    // Iteramos sobre los OBJETOS de cliente
    for (const client of activeClients) {
        const clientId = client._id; // Usamos el _id del cliente para la conexión
        try {
            const gymDBConnection = await connectToGymDB(clientId);
            if (!gymDBConnection) continue;
            
            const { Clase, Notification, User } = getModels(gymDBConnection);

            // Lógica de tiempo (2 horas en el futuro)
            const now = new Date();
            const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
            
            const startOfWindow = new Date(twoHoursFromNow);
            startOfWindow.setMinutes(0, 0, 0);
            
            const endOfWindow = new Date(startOfWindow);
            endOfWindow.setMinutes(59, 59, 999);

            // Buscar clases activas que comiencen dentro de esa ventana
            const classesInWindow = await Clase.find({
                fecha: { 
                    $gte: startOfWindow.toISOString().split('T')[0],
                    $lte: endOfWindow.toISOString().split('T')[0]
                },
                horaInicio: {
                    $gte: format(startOfWindow, 'HH:mm'),
                    $lte: format(endOfWindow, 'HH:mm')
                },
                estado: 'activa'
            }).populate('tipoClase', 'nombre');

            if (classesInWindow.length === 0) continue;

            // Iterar y crear notificaciones
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
                        await Notification.create({
                            user: userId,
                            class: clase._id,
                            title: title,
                            message: message,
                            type: 'class_reminder_2hr',
                            isImportant: true // Activa el modal
                        });
                    }
                }
            }
            console.log(`✅ Recordatorios de 2 horas enviados para el gimnasio ${clientId}.`);
        } catch (error) {
            console.error(`❌ Error procesando el gimnasio ${clientId} en el cron de Recordatorios:`, error);
        }
    }
});

// --- 3. LA PROGRAMACIÓN DEL CRON (Sin cambios) ---
export const scheduleClassReminders = () => {
    // Se ejecuta "en el minuto 0 de cada hora"
    cron.schedule('0 * * * *', checkUpcomingClasses, {
        timezone: "America/Argentina/Buenos_Aires"
    });
};