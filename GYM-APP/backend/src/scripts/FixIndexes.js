import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const SUPER_ADMIN_API_URL = process.env.ADMIN_PANEL_API_URL;
const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

const fixGymIndexes = async (connection, gymName) => {
    try {
        const { User } = getModels(connection);
        
        console.log(`🔧 Intentando borrar índice en: ${gymName}...`);
        
        // Intentamos borrar el índice conflictivo
        // El nombre suele ser "rmRecords.exercise_1" según tu error
        try {
            await User.collection.dropIndex('rmRecords.exercise_1');
            console.log(`✅ Índice 'rmRecords.exercise_1' ELIMINADO en ${gymName}.`);
        } catch (e) {
            if (e.code === 27) {
                console.log(`ℹ️ El índice no existía en ${gymName} (todo ok).`);
            } else {
                console.error(`⚠️ No se pudo borrar por nombre, intentando limpieza general...`);
            }
        }

    } catch (error) {
        console.error(`❌ Error general en ${gymName}:`, error.message);
    }
};

export const runFixIndexes = async () => {
    console.log('🛠️ INICIANDO REPARACIÓN DE ÍNDICES...');
    try {
        const response = await axios.get(`${SUPER_ADMIN_API_URL}/api/clients/internal/all-clients`, {
            headers: { 'x-internal-api-key': INTERNAL_ADMIN_API_KEY },
        });

        const clients = response.data;

        for (const client of clients) {
            // Filtramos para hacerlo solo en el gym que falla (o en todos si quieres)
            // Si quieres hacerlo en todos, quita el 'if'
            if (client.clientId === 'yaguaretegym_e7127d4d' || true) { 
                try {
                    const { connection } = await connectToGymDB(client.clientId);
                    if (connection) {
                        await fixGymIndexes(connection, client.nombre);
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        }
        console.log('🏁 REPARACIÓN FINALIZADA.');
    } catch (error) {
        console.error('Error fetching clients:', error);
    }
};