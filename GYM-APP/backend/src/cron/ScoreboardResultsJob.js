import cron from 'node-cron';
import asyncHandler from 'express-async-handler';
import axios from 'axios';
import getModels from '../utils/getModels.js';
import connectToGymDB from '../config/mongoConnectionManager.js';
import { sendSingleNotification } from '../controllers/notificationController.js';

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

        return response.data.filter(
            (client) => client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba'
        );
    } catch (error) {
        console.error(
            'Error crítico al obtener la lista de clientes activos (desafíos):',
            error.response?.data || error.message
        );
        throw error;
    }
};

const placeLabel = (place) => {
    if (place === 1) return '1.er puesto';
    if (place === 2) return '2.do puesto';
    if (place === 3) return '3.er puesto';
    return `${place}.º puesto`;
};

/**
 * Notify each participant of their final place when a timed desafío ends.
 */
export const runScoreboardResultsJob = asyncHandler(async () => {
    console.log('🏆 Ejecutando cron: resultados finales de desafíos...');
    const now = new Date();
    let activeClients = [];

    try {
        activeClients = await getAllActiveClients();
    } catch (error) {
        console.error('❌ No se pudieron obtener clientes para resultados de desafíos:', error.message);
        return;
    }

    for (const client of activeClients) {
        const clientId = client.clientId;
        try {
            const { connection } = await connectToGymDB(clientId);
            if (!connection) continue;

            const { Scoreboard, ScoreboardEntry, User, Notification } = getModels(connection);

            const endedScoreboards = await Scoreboard.find({
                fechaLimite: { $ne: null, $lte: now },
                resultsNotifiedAt: null,
            });

            if (!endedScoreboards.length) continue;

            for (const scoreboard of endedScoreboards) {
                const entries = await ScoreboardEntry.find({ scoreboard: scoreboard._id })
                    .populate('user', 'nombre apellido')
                    .sort({ peso: -1, repeticiones: -1, distancia: -1, tiempo: 1 });

                const total = entries.length;

                if (total === 0) {
                    scoreboard.resultsNotifiedAt = now;
                    await scoreboard.save();
                    console.log(`ℹ️ Desafío "${scoreboard.nombre}" finalizó sin participantes (${clientId}).`);
                    continue;
                }

                for (let i = 0; i < entries.length; i++) {
                    const entry = entries[i];
                    const userId = entry.user?._id || entry.user;
                    if (!userId) continue;

                    const place = i + 1;
                    const title = `Desafío finalizado: ${scoreboard.nombre}`;
                    const message = `¡Terminó el desafío! Quedaste en el ${placeLabel(place)} de ${total} participante${total === 1 ? '' : 's'}.`;

                    try {
                        await sendSingleNotification(
                            Notification,
                            User,
                            userId,
                            title,
                            message,
                            'desafio_resultado',
                            true,
                            null
                        );
                    } catch (notifyError) {
                        console.error(
                            `❌ Error notificando puesto a usuario ${userId} en desafío ${scoreboard._id}:`,
                            notifyError.message
                        );
                    }
                }

                scoreboard.resultsNotifiedAt = now;
                await scoreboard.save();
                console.log(
                    `🔔 Resultados enviados para "${scoreboard.nombre}" (${total} participantes, gym ${clientId}).`
                );
            }
        } catch (error) {
            console.error(`❌ Error procesando desafíos del gimnasio ${clientId}:`, error.message);
        }
    }

    console.log('✅ Cron de resultados de desafíos finalizado.');
});

export const scheduleScoreboardResultsJob = () => {
    // Every hour — catches desafíos whose fechaLimite just passed
    cron.schedule('15 * * * *', runScoreboardResultsJob, {
        timezone: 'UTC',
    });
    console.log('🕒 Cron Job de resultados de desafíos programado (cada hora, minuto :15 UTC).');
};
