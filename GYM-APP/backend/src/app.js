// gym-app-backend/server.js
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron'; // Importar node-cron

import gymTenantMiddleware from './middlewares/gymTenantMiddleware.js';
import connectToGymDB from './config/mongoConnectionManager.js'; // Necesario para el cron job

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import classRoutes from './routes/classRoutes.js';
import tipoClaseRoutes from './routes/tipoClaseRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { notFound, errorHandler } from './middlewares/errorMiddleware.js';
import { generateFutureFixedClasses } from './controllers/classController.js'; 

dotenv.config();
console.log('Valor de la API Key al arrancar:', process.env.INTERNAL_API_KEY_FOR_SUPERADMIN);
const app = express();

// Middlewares globales
app.use(cors({
    origin: 'http://localhost:5174',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Id', 'X-Api-Secret', 'X-Internal-Api-Key'],
    credentials: true
}));
app.use(express.json()); 


// Definir las rutas de la API
app.use('/api/auth', gymTenantMiddleware, authRoutes);
app.use('/api/users', gymTenantMiddleware, userRoutes); 
app.use('/api/classes', gymTenantMiddleware, classRoutes);
app.use('/api/tipos-clase', gymTenantMiddleware, tipoClaseRoutes);
app.use('/api/notifications', gymTenantMiddleware, notificationRoutes);


// Ruta de prueba
app.get('/', (req, res) => {
    res.send('API del Gym App está funcionando!');
});

// --- Configuración del Cron Job ---
const ADMIN_PANEL_API_URL = process.env.ADMIN_PANEL_API_URL;
const INTERNAL_ADMIN_API_KEY = process.env.INTERNAL_ADMIN_API_KEY;

// RUTA TEMPORAL PARA FORZAR LA GENERACIÓN DE CLASES FIJAS (SOLO PARA DESARROLLO/DEPURACIÓN)
// Puedes visitar http://localhost:5000/api/debug/generate-classes para forzar la ejecución.
app.get('/api/debug/generate-classes', gymTenantMiddleware, async (req, res) => {
    try {
        console.log('[DEBUG ROUTE] Petición para forzar la generación de clases fijas. Iniciando...');
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
});


console.log('[Cron Job Setup] Programando tarea mensual...');
// Programar tarea para que se ejecute todos los días a las 2 AM
// Para probar más frecuentemente durante el desarrollo, cambia a '* * * * *' (cada minuto)
cron.schedule('0 2 1 * *', async () => { 
    console.log('[Cron Job] Ejecutando tarea mensual programada para generar clases futuras...');
    console.log(`[Cron Job] ADMIN_PANEL_API_URL: ${ADMIN_PANEL_API_URL ? 'Configurada' : 'NO Configurada'}`);
    console.log(`[Cron Job] INTERNAL_ADMIN_API_KEY: ${INTERNAL_ADMIN_API_KEY ? 'Configurada' : 'NO Configurada'}`);

    if (!ADMIN_PANEL_API_URL || !INTERNAL_ADMIN_API_KEY) {
        console.error('[Cron Job] Error: ADMIN_PANEL_API_URL o INTERNAL_ADMIN_API_KEY no están configuradas en .env. El cron job no se ejecutará completamente.');
        return;
    }
    try {
        console.log('[Cron Job] Fetching clients from Admin Panel...');
        const response = await fetch(`${ADMIN_PANEL_API_URL}/api/clients/internal/all-clients`, {
            headers: {
                'x-internal-api-key': INTERNAL_ADMIN_API_KEY,
            },
        });
        const clients = await response.json();

        if (!response.ok) {
            throw new Error(clients.message || 'Error al obtener clientes del panel de administración.');
        }

        if (!Array.isArray(clients) || clients.length === 0) {
            console.log('[Cron Job] No hay clientes activos para procesar.');
            return;
        }

        for (const client of clients) {
            if (client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba') {
                console.log(`[Cron Job] Procesando gimnasio: ${client.nombre} (ID: ${client.clientId})`);
                try {
                    const gymDBConnection = await connectToGymDB(client.clientId, client.apiSecretKey); 
                    console.log(`[Cron Job] Conexión a DB de ${client.nombre} establecida. Generando clases fijas...`);
                    await generateFutureFixedClasses(gymDBConnection);
                    console.log(`[Cron Job] Instancias de clases fijas generadas para ${client.nombre}.`);
                } catch (gymError) {
                    console.error(`[Cron Job] Error al procesar DB del gimnasio ${client.nombre} (ID: ${client.clientId}): ${gymError.message}`);
                }
            } else {
                console.log(`[Cron Job] Saltando gimnasio ${client.nombre} debido a estado de suscripción: ${client.estadoSuscripcion}`);
            }
        }
        console.log('[Cron Job] Tarea programada completada exitosamente.');
    } catch (error) {
        console.error('[Cron Job] Error general en la tarea programada:', error.message);
    }
}, {
    timezone: "America/Argentina/Buenos_Aires" 
});
console.log('[Cron Job Setup] Tarea cron mensual programada.');


// Middlewares de manejo de errores
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
