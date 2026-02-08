// GYM-APP/backend/src/cron/CreditResetJob.js
import cron from 'node-cron';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';
import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const SUPER_ADMIN_API_URL = process.env.ADMIN_PANEL_API_URL;
const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

const resetCreditsForCurrentGym = async (gymDBConnection, clientId) => {
    try {
        // 1. Agregamos TipoClase a los modelos
        const { User, TipoClase } = getModels(gymDBConnection);
        const hoy = new Date();

        // 2. BUSCAMOS QUÉ TIPOS DE CLASE TIENEN EL RESET ACTIVADO
        // Solo nos interesan los IDs de los que tienen resetMensual: true
        const tiposConReset = await TipoClase.find({ resetMensual: true }).select('_id');
        
        // Creamos un Set para búsqueda rápida (O(1))
        const idsPermitidosParaBorrar = new Set(tiposConReset.map(t => t._id.toString()));

        // Si no hay ningún tipo de clase con reset activado, no tiene sentido buscar usuarios
        if (idsPermitidosParaBorrar.size === 0) {
            return; 
        }

        const usersToUpdate = await User.find({
            "vencimientosDetallados.fechaVencimiento": { $lte: hoy }
        });

        for (const user of usersToUpdate) {
            let modificado = false;

            // 3. MODIFICADO: El filtro ahora tiene DOBLE CONDICIÓN
            const vencidos = user.vencimientosDetallados.filter(v => {
                const estaVencido = v.fechaVencimiento <= hoy;
                const permiteReset = idsPermitidosParaBorrar.has(v.tipoClaseId.toString());
                
                // Solo devuelve true si venció Y el tipo de clase permite el borrado
                return estaVencido && permiteReset;
            });
            
            if (vencidos.length > 0) {
                vencidos.forEach(v => {
                    const idTipo = v.tipoClaseId.toString();
                    
                    const totalActual = user.creditosPorTipo.get(idTipo) || 0;
                    const nuevoTotal = Math.max(0, totalActual - v.cantidad);
                    user.creditosPorTipo.set(idTipo, nuevoTotal);
                });

                // 4. Limpiar el array: Mantenemos los que NO vencieron O los que NO tienen reset activado
                user.vencimientosDetallados = user.vencimientosDetallados.filter(v => {
                    const estaVencido = v.fechaVencimiento <= hoy;
                    const permiteReset = idsPermitidosParaBorrar.has(v.tipoClaseId.toString());
                    
                    // Si está vencido Y permite reset, LO SACAMOS (return false)
                    // En cualquier otro caso, LO DEJAMOS (return true)
                    return !(estaVencido && permiteReset);
                });

                modificado = true;
            }

            if (modificado) {
                user.markModified('creditosPorTipo');
                await user.save();
            }
        }
    } catch (error) {
        console.error("Error en reset:", error);
    }
};

const runCreditResetJob = async () => {
    console.log('[CreditResetJob] Iniciando job de reinicio de créditos...');
    if (!SUPER_ADMIN_API_URL || !INTERNAL_ADMIN_API_KEY) {
        console.error('[CreditResetJob] Error: Variables de entorno no configuradas.');
        return;
    }
    try {
        const response = await axios.get(`${SUPER_ADMIN_API_URL}/api/clients/internal/all-clients`, {
            headers: { 'x-internal-api-key': INTERNAL_ADMIN_API_KEY },
        });

        const clients = response.data;
        if (!Array.isArray(clients) || clients.length === 0) {
            console.log('[CreditResetJob] No hay clientes activos para procesar.');
            return;
        }

        for (const client of clients) {
            if (client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba') {
                try {
                    const { connection } = await connectToGymDB(client.clientId); 
                    await resetCreditsForCurrentGym(connection, client.clientId);
                } catch (gymError) {
                    console.error(`[CreditResetJob] Error al procesar gimnasio ${client.nombre} (ID: ${client.clientId}): ${gymError.message}`);
                }
            } 
        }
    } catch (error) {
        console.error('[CreditResetJob] Error general en la tarea:', error.message);
    }
    console.log('[CreditResetJob] Job de reinicio de créditos finalizado.');
};

const scheduleMonthlyCreditReset = () => {
    // Se ejecuta todos los días a las 00:00 hora Argentina
    cron.schedule('0 0 * * *', runCreditResetJob, { 
        timezone: "America/Argentina/Buenos_Aires"
    });
    console.log('🕒 Cron Job de reinicio de créditos mensual (logica diaria) programado.');
};

export { scheduleMonthlyCreditReset, runCreditResetJob, resetCreditsForCurrentGym };