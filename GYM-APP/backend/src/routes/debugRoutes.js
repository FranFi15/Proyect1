import express from 'express';
import asyncHandler from 'express-async-handler';
import { generateFutureFixedClasses } from '../controllers/classController.js';
import { runCreditResetJob } from '../cron/CreditResetJob.js'; 
import gymTenantMiddleware from '../middlewares/gymTenantMiddleware.js'; 
import { masterCronJob } from '../cron/monthlyReport.js'; 
import { runDebtorNotificationJob} from '../cron/debtorBalanceNotifier.js';

const router = express.Router();


// --- CAMBIO CLAVE: Middleware actualizado ---
// Se actualizó para usar el estándar 'Authorization: Bearer <token>'
const protectDebugRoute = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            if (token === process.env.INTERNAL_ADMIN_API_KEY) {
                return next(); // Autorizado, continúa.
            } else {
                return res.status(401).json({ message: 'No autorizado, token inválido.' });
            }
        } catch (error) {
            return res.status(401).json({ message: 'No autorizado, token inválido.' });
        }
    }
    
    // Si no se encontró el header 'Authorization' o no tenía el formato correcto
    return res.status(401).json({ message: 'No autorizado, no se encontró un token.' });
};

// Todas las rutas de abajo ahora usarán el nuevo método de autenticación
router.get('/run-monthly-cleanup', protectDebugRoute, async (req, res) => {
    try {
        console.log('DEBUG: Disparando cron de limpieza y reporte mensual...');
        masterCronJob();
        res.status(200).json({ message: 'Cron de limpieza y reporte mensual disparado.' });
    } catch (error) {
        console.error('DEBUG: Error al disparar cron de limpieza y reporte mensual:', error);
        res.status(500).json({ message: 'Error al disparar cron.', error: error.message });
    }
});

router.get('/run-credit-reset', protectDebugRoute, async (req, res) => {
    try {
        console.log('DEBUG: Disparando cron de reinicio de créditos mensual...');
        await runCreditResetJob();
        res.status(200).json({ message: 'Cron de reinicio de créditos mensual disparado.' });
    } catch (error) {
        console.error('DEBUG: Error al disparar cron de reinicio de créditos mensual:', error);
        res.status(500).json({ message: 'Error al disparar cron.', error: error.message });
    }
});

router.get('/generate-classes', gymTenantMiddleware, asyncHandler(async (req, res) => {
    // Nota: Esta ruta usa un middleware diferente ('gymTenantMiddleware')
    // y no está protegida por 'protectDebugRoute', por lo que no se ve afectada.
    console.log('[DEBUG ROUTE] Petición para forzar la generación de clases fijas...');
    try {
        if (!req.gymDBConnection) {
            return res.status(500).json({ message: 'Conexión a la base de datos no disponible.' });
        }
        const classesGenerated = await generateFutureFixedClasses(req.gymDBConnection);
        res.status(200).json({ 
            message: `Generación de clases fijas completada. Clases generadas: ${classesGenerated}.`,
            generatedCount: classesGenerated
        });
    } catch (error) {
        console.error('[DEBUG ROUTE] Error al forzar la generación de clases:', error.message);
        res.status(500).json({ message: 'Error al forzar la generación de clases.', error: error.message });
    }
}));

router.get('/run-debtor-notifications', protectDebugRoute, async (req, res) => {
    try {
        console.log('DEBUG: Disparando manualmente el job de notificaciones a deudores...');
        await runDebtorNotificationJob();
        res.status(200).json({ message: 'Proceso de notificación a deudores ejecutado.' });
    } catch (error) {
        console.error('DEBUG: Error al ejecutar el job de notificaciones a deudores:', error);
        res.status(500).json({ message: 'Error al ejecutar el job.', error: error.message });
    }
});


export default router;