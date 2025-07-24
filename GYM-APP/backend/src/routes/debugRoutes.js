import express from 'express';
import asyncHandler from 'express-async-handler';
import { generateFutureFixedClasses } from '../controllers/classController.js';
import { runCreditResetJob } from '../cron/CreditResetJob.js'; 
import gymTenantMiddleware from '../middlewares/gymTenantMiddleware.js'; 
import { masterCronJob } from '../cron/monthlyReport.js'; 

const router = express.Router();


// Middleware para proteger las rutas de depuración
const protectDebugRoute = (req, res, next) => {
    const internalApiKey = req.headers['x-internal-api-key'];
    if (internalApiKey && internalApiKey === process.env.INTERNAL_ADMIN_API_KEY) {
        next();
    } else {
        res.status(403).json({ message: 'Acceso no autorizado a rutas de depuración. Se requiere una clave interna válida.' });
    }
};

// Ruta para disparar el cron de limpieza y reporte mensual
router.get('/run-monthly-cleanup', protectDebugRoute, async (req, res) => {
    try {
        console.log('DEBUG: Disparando cron de limpieza y reporte mensual...');
        // No esperamos a que termine, solo lo iniciamos.
        masterCronJob();
        res.status(200).json({ message: 'Cron de limpieza y reporte mensual disparado. Revisa los logs del servidor para el progreso y los resultados.' });
    } catch (error) {
        console.error('DEBUG: Error al disparar cron de limpieza y reporte mensual:', error);
        res.status(500).json({ message: 'Error al disparar cron de limpieza y reporte mensual.', error: error.message });
    }
});

// Ruta para disparar el cron de reinicio de créditos mensual
router.get('/run-credit-reset', protectDebugRoute, async (req, res) => {
    try {
        console.log('DEBUG: Disparando cron de reinicio de créditos mensual...');
        await runCreditResetJob();
        res.status(200).json({ message: 'Cron de reinicio de créditos mensual disparado. Revisa los logs de Render para el progreso y los resultados.' });
    } catch (error) {
        console.error('DEBUG: Error al disparar cron de reinicio de créditos mensual:', error);
        res.status(500).json({ message: 'Error al disparar cron de reinicio de créditos mensual.', error: error.message });
    }
});

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

export default router;
