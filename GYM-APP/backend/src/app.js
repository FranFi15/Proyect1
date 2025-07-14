// gym-app-backend/server.js
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';


import gymTenantMiddleware from './middlewares/gymTenantMiddleware.js';

import initializeFirebaseAdmin from './config/firebaseAdmin.js';


import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import classRoutes from './routes/classRoutes.js';
import tipoClaseRoutes from './routes/tipoClaseRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import creditLogRoutes from './routes/creditLogRoutes.js';
import { notFound, errorHandler } from './middlewares/errorMiddleware.js';
import { generateFutureFixedClasses } from './controllers/classController.js'; 
import debugRoutes from './routes/debugRoutes.js';

import { scheduleMonthlyCreditReset } from './cron/CreditResetJob.js';
import { scheduleMonthlyClassGeneration } from './cron/ClassGenerationJob.js';

dotenv.config();
console.log('Valor de la API Key al arrancar:', process.env.INTERNAL_API_KEY_FOR_SUPERADMIN);
const app = express();

initializeFirebaseAdmin();

// 1. Leer los orígenes permitidos desde una variable de entorno
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];

// 2. Aplicar la configuración de CORS
app.use(cors({
    origin: (origin, callback) => {
        // Permitir peticiones sin 'origin' (como apps móviles, Postman, o server-to-server)
        // o si el 'origin' está en nuestra lista blanca.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    // Mantenemos el resto de tu configuración que ya está perfecta
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Id', 'x-gym-domain', 'X-Api-Secret', 'X-Internal-Api-Key'],
    credentials: true
}));
app.use(express.json()); 


// Definir las rutas de la API
app.use('/api/users', gymTenantMiddleware, userRoutes); 
app.use('/api/classes', gymTenantMiddleware, classRoutes);
app.use('/api/tipos-clase', gymTenantMiddleware, tipoClaseRoutes);
app.use('/api/notifications', gymTenantMiddleware, notificationRoutes);
app.use('/api/credit-logs', gymTenantMiddleware, creditLogRoutes);

app.use('/api/auth', gymTenantMiddleware, authRoutes);

app.use('/api/debug', debugRoutes); 


// Ruta de prueba
app.get('/', (req, res) => {
    res.send('API del Gym App está funcionando!');
});




scheduleMonthlyClassGeneration();
scheduleMonthlyCreditReset();


// Middlewares de manejo de errores
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
