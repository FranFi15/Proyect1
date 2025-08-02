import cron from 'node-cron';
import axios from 'axios';
import connectToGymDB from '../config/mongoConnectionManager.js'; // <-- USAMOS TU GESTOR DE CONEXIONES
import getModels from '../utils/getModels.js';
import { sendExpoPushNotification } from '../utils/notificationSender.js';

// Función para obtener todos los IDs de los clientes/gimnasios activos desde tu panel de admin.
const getAllActiveClientIds = async () => {
    try {
        const adminApiUrl = process.env.ADMIN_PANEL_API_URL;
        if (!adminApiUrl) throw new Error('ADMIN_PANEL_API_URL no está configurada.');

        const internalApiKey = process.env.INTERNAL_ADMIN_API_KEY;
        if (!internalApiKey) throw new Error('INTERNAL_ADMIN_API_KEY no está configurada.');
        
        // ASUMO que tienes un endpoint como este en tu panel de admin para obtener todos los IDs.
        // Si la ruta es diferente, ajústala aquí.
        const response = await axios.get(`${adminApiUrl}/api/clients/all-active-ids`, {
            headers: { 'x-internal-api-key': internalApiKey }
        });

        // ASUMO que la respuesta es un array de strings, ej: ['gym1', 'gym2', ...]
        if (!Array.isArray(response.data)) {
            throw new Error('La respuesta del panel de admin no fue un array de IDs.');
        }
        
        return response.data;

    } catch (error) {
        console.error('CRON JOB ERROR: No se pudo obtener la lista de clientes activos:', error.message);
        return []; // Devolvemos un array vacío para que el CRON no falle.
    }
};


const scheduleDebtorNotifications = () => {
    // Se ejecuta todos los días a las 10:00 AM.
    cron.schedule('0 10 * * *', async () => {
        
        const clientIds = await getAllActiveClientIds();

        if (clientIds.length === 0) {
            return;
        }

        // Iteramos sobre cada ID de gimnasio.
        for (const clientId of clientIds) {
           
            try {
                // Usamos tu gestor de conexiones para obtener la DB correcta.
                const tenantConnection = await connectToGymDB(clientId);
                const { User } = getModels(tenantConnection);
                const fiveDaysAgo = new Date();
                fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

                const debtorsToNotify = await User.find({
                    balance: { $gt: 0 },
                    pushToken: { $exists: true, $ne: null },
                    $or: [
                        { lastBalanceNotificationDate: { $lte: fiveDaysAgo } },
                        { lastBalanceNotificationDate: { $exists: false } }
                    ]
                });

                if (debtorsToNotify.length > 0) {
                    
                    for (const user of debtorsToNotify) {
                        const title = 'Recordatorio de Saldo Pendiente';
                        const message = `Hola ${user.nombre}, te recordamos que tienes un saldo pendiente de $${user.balance.toFixed(2)}.`;
                        await sendExpoPushNotification(user.pushToken, title, message);
                        user.lastBalanceNotificationDate = new Date();
                        await user.save();
                        console.log(`CRON JOB: [${clientId}] Notificación enviada a ${user.email}`);
                    }
                }
            } catch (error) {
                console.error(`CRON JOB: Error procesando el gimnasio con clientId ${clientId}:`, error.message);
            }
            // No cerramos la conexión aquí, dejamos que tu connectionManager la reutilice.
        }
    }, {
        scheduled: true,
        timezone: "America/Argentina/Buenos_Aires"
    });
};

export { scheduleDebtorNotifications };