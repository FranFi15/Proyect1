import cron from 'node-cron';
import axios from 'axios';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';
import { sendSingleNotification } from '../controllers/notificationController.js';

const getAllActiveClients = async () => {
    try {
        const adminApiUrl = process.env.ADMIN_PANEL_API_URL;
        const internalApiKey = process.env.INTERNAL_ADMIN_API_KEY;

        if (!adminApiUrl || !internalApiKey) {
            throw new Error('Variables de entorno del Admin Panel no configuradas.');
        }

        const response = await axios.get(`${adminApiUrl}/api/clients/internal/all-clients`, {
            headers: { 'x-internal-api-key': internalApiKey },
        });

        if (!response.data || !Array.isArray(response.data)) {
            throw new Error('La respuesta del panel de administración no es un array de clientes válido.');
        }

        return response.data.filter(
            (client) => client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba'
        );
    } catch (error) {
        console.error('CRON CUMPLEAÑOS: No se pudo obtener la lista de clientes activos:', error.response?.data || error.message);
        return [];
    }
};

const formatBirthdayNames = (users) => {
    const names = users.map((u) => `${u.nombre || ''} ${u.apellido || ''}`.trim()).filter(Boolean);
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} y ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
};

const runBirthdayReminderJob = async () => {
    console.log('🎂 CRON: Verificando cumpleaños del día...');
    const clients = await getAllActiveClients();

    for (const client of clients) {
        const clientId = client.clientId;
        try {
            const clientTz = client.timezone || 'America/Argentina/Buenos_Aires';
            const currentHour = parseInt(
                new Intl.DateTimeFormat('en-US', { timeZone: clientTz, hour: 'numeric', hour12: false }).format(new Date()),
                10
            );
            // 08:00 hora local del gimnasio
            if (currentHour !== 8) continue;

            const todayParts = new Intl.DateTimeFormat('en-US', {
                timeZone: clientTz,
                month: 'numeric',
                day: 'numeric',
            }).formatToParts(new Date());
            const month = Number(todayParts.find((p) => p.type === 'month')?.value);
            const day = Number(todayParts.find((p) => p.type === 'day')?.value);
            if (!month || !day) continue;

            const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: clientTz }).format(new Date());
            const startOfClientToday = new Date(`${todayStr}T00:00:00.000Z`);

            const { connection } = await connectToGymDB(clientId);
            if (!connection) continue;

            const { User, Notification } = getModels(connection);

            const birthdayUsers = await User.find({
                isActive: { $ne: false },
                roles: 'cliente',
                fechaNacimiento: { $exists: true, $ne: null },
                $expr: {
                    $and: [
                        { $eq: [{ $month: '$fechaNacimiento' }, month] },
                        { $eq: [{ $dayOfMonth: '$fechaNacimiento' }, day] },
                    ],
                },
            }).select('nombre apellido');

            if (birthdayUsers.length === 0) continue;

            const alreadySent = await Notification.findOne({
                type: 'birthday_reminder',
                createdAt: { $gte: startOfClientToday },
            });
            if (alreadySent) continue;

            const staff = await User.find({
                isActive: { $ne: false },
                roles: { $in: ['admin', 'profesor'] },
            }).select('_id nombre email roles');

            if (staff.length === 0) continue;

            const namesLabel = formatBirthdayNames(birthdayUsers);
            const title = birthdayUsers.length === 1 ? 'Cumpleaños de hoy' : 'Cumpleaños de hoy';
            const message = birthdayUsers.length === 1
                ? `Hoy cumple años ${namesLabel}.`
                : `Hoy cumplen años ${namesLabel}.`;

            for (const member of staff) {
                await sendSingleNotification(
                    Notification,
                    User,
                    member._id,
                    title,
                    message,
                    'birthday_reminder',
                    false,
                    null
                );
            }

            console.log(
                `🎂 [${clientId}] Aviso de cumpleaños enviado a ${staff.length} staff (${birthdayUsers.length} cumpleañero/s).`
            );
        } catch (error) {
            console.error(`❌ CRON CUMPLEAÑOS: Error en gimnasio ${clientId}:`, error.message);
        }
    }

    console.log('✅ CRON: Verificación de cumpleaños finalizada.');
};

const scheduleBirthdayReminders = () => {
    cron.schedule('0 * * * *', runBirthdayReminderJob, {
        timezone: 'UTC',
    });
    console.log('🕒 Cron Job de cumpleaños programado (comprobación 08:00 AM hora local cada hora).');
};

export { scheduleBirthdayReminders, runBirthdayReminderJob };
