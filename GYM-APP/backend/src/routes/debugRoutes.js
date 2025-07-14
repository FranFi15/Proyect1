// GYM-APP/backend/src/routes/debugRoutes.js
import express from 'express';
import asyncHandler from 'express-async-handler';
import { generateFutureFixedClasses } from '../controllers/classController.js';
import { resetCreditsForCurrentGym } from '../cron/CreditResetJob.js'; // Import the specific function
import gymTenantMiddleware from '../middlewares/gymTenantMiddleware.js'; // Needed for req.gymDBConnection, req.gymId

const router = express.Router();

// Debug route to force generation of fixed classes for the current gym
router.get('/generate-classes', gymTenantMiddleware, asyncHandler(async (req, res) => {
    console.log('[DEBUG ROUTE] Petición para forzar la generación de clases fijas. Iniciando...');
    try {
        if (!req.gymDBConnection) {
            return res.status(500).json({ message: 'Conexión a la base de datos del gimnasio no disponible.' });
        }
        const classesGenerated = await generateFutureFixedClasses(req.gymDBConnection);
        console.log(`[DEBUG ROUTE] Generación de clases fijas forzada completada. Clases generadas: ${classesGenerated}.`);
        res.status(200).json({ 
            message: `Generación de clases fijas forzada. Clases generadas: ${classesGenerated}. Revisa la consola del servidor para más detalles.`,
            generatedCount: classesGenerated
        });
    } catch (error) {
        console.error('[DEBUG ROUTE] Error al forzar la generación de clases:', error.message);
        res.status(500).json({ message: 'Error al forzar la generación de clases.', error: error.message });
    }
}));

// Debug route to force credit reset for all active gyms (like the cron job)
// This needs to fetch clients from Superadmin, so it might not be strictly tenant-specific in its execution,
// but it uses the tenant connection for each gym.
router.get('/reset-all-gym-credits', asyncHandler(async (req, res) => {
    console.log('[DEBUG ROUTE] Petición para forzar el reinicio de créditos para TODOS los gimnasios. Iniciando...');
    const ADMIN_PANEL_API_URL = process.env.ADMIN_PANEL_API_URL;
    const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

    if (!ADMIN_PANEL_API_URL || !INTERNAL_ADMIN_API_KEY) {
        const msg = 'Error: ADMIN_PANEL_API_URL o INTERNAL_ADMIN_API_KEY no están configuradas en .env. No se puede forzar el reinicio de créditos.';
        console.error(`[DEBUG ROUTE] ${msg}`);
        return res.status(500).json({ message: msg });
    }

    try {
        const response = await fetch(`${ADMIN_PANEL_API_URL}/clients/internal/all-clients`, { // Adjust path if needed
            headers: {
                'x-internal-api-key': INTERNAL_ADMIN_API_KEY,
            },
        });
        const clients = await response.json();

        if (!response.ok) {
            throw new Error(clients.message || 'Error al obtener clientes del panel de administración para forzar el reinicio de créditos.');
        }

        if (!Array.isArray(clients) || clients.length === 0) {
            console.log('[DEBUG ROUTE] No hay clientes activos para procesar el reinicio de créditos.');
            return res.status(200).json({ message: 'No hay clientes activos para procesar el reinicio de créditos.' });
        }

        let processedGyms = 0;
        for (const client of clients) {
            if (client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba') {
                console.log(`[DEBUG ROUTE] Forzando reinicio para gimnasio: ${client.nombre} (ID: ${client.clientId})`);
                let gymDBConnection;
                try {
                    gymDBConnection = await connectToGymDB(client.clientId, client.apiSecretKey); 
                    await resetCreditsForCurrentGym(gymDBConnection, client.clientId); // Call the exported function
                    processedGyms++;
                } catch (gymError) {
                    console.error(`[DEBUG ROUTE] Error al procesar DB del gimnasio ${client.nombre} (ID: ${client.clientId}): ${gymError.message}`);
                }
            }
        }
        res.status(200).json({ 
            message: `Reinicio de créditos forzado completado para ${processedGyms} gimnasios. Revisa la consola del servidor para más detalles.`,
            processedGymsCount: processedGyms
        });
    } catch (error) {
        console.error('[DEBUG ROUTE] Error general al forzar el reinicio de créditos:', error);
        res.status(500).json({ message: 'Error al forzar el reinicio de créditos.', error: error.message });
    }
}));


export default router;