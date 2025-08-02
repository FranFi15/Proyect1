import cron from 'node-cron';
import axios from 'axios';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';
import { sendExpoPushNotification } from '../utils/notificationSender.js';

const getAllActiveClientIds = async () => {
    try {
        const adminApiUrl = process.env.ADMIN_PANEL_API_URL;
        const internalApiKey = process.env.INTERNAL_ADMIN_API_KEY;

        if (!adminApiUrl || !internalApiKey) {
            throw new Error('Variables de entorno del Admin Panel no configuradas.');
        }
        
        const response = await axios.get(`${adminApiUrl}/api/clients/internal/all-clients`, {
            headers: { 'x-internal-api-key': internalApiKey }
        });

        if (!Array.isArray(response.data)) {
            throw new Error('La respuesta del panel de admin no fue un array de IDs.');
        }
        
        return response.data;

    } catch (error) {
        console.error('CRON JOB ERROR: No se pudo obtener la lista de clientes activos:', error.message);
        return [];
    }
};

const runDebtorNotificationJob = async () => {
    console.log('CRON JOB: Iniciando búsqueda de deudores...');
    const clients = await getAllActiveClientIds(); // Recibe objetos de cliente completos

    if (clients.length === 0) {
        console.log('CRON JOB: No se encontraron clientes activos para procesar.');
        return;
    }

    for (const client of clients) {
        try {
            const tenantConnection = await connectToGymDB(client.clientId);
            const { User } = getModels(tenantConnection);
            const fiveDaysAgo = new Date();
            fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

            const debtorsToNotify = await User.find({
                balance: { $lt: 0 },
                pushToken: { $exists: true, $ne: null },
                $or: [
                    { lastBalanceNotificationDate: { $lte: fiveDaysAgo } },
                    { lastBalanceNotificationDate: { $exists: false } }
                ]
            });

            if (debtorsToNotify.length > 0) {
                console.log(`CRON JOB: [${client.clientId}] Encontrados ${debtorsToNotify.length} deudores para notificar.`);
                for (const user of debtorsToNotify) {
                    const title = 'Recordatorio de Saldo Pendiente';
                    const debtAmount = Math.abs(user.balance);
                    const message = `Hola ${user.nombre}, te recordamos que tienes un saldo pendiente de $${debtAmount.toFixed(2)}.`;
                    
                    await sendExpoPushNotification(user.pushToken, title, message);
                    user.lastBalanceNotificationDate = new Date();
                    await user.save();
                    console.log(`CRON JOB: [${client.clientId}] Notificación de deuda enviada a ${user.email}`);
                }
            }
        } catch (error) {
            console.error(`CRON JOB: Error procesando el gimnasio con clientId ${client.clientId}:`, error.message);
        }
    }
    console.log('CRON JOB: Búsqueda de deudores finalizada.');
};

const scheduleDebtorNotifications = () => {
    cron.schedule('0 10 * * *', runDebtorNotificationJob, {
        scheduled: true,
        timezone: "America/Argentina/Buenos_Aires"
    });
};

export { scheduleDebtorNotifications, runDebtorNotificationJob };