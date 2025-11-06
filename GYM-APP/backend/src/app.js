import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

import gymTenantMiddleware from './middlewares/gymTenantMiddleware.js';
import initializeFirebaseAdmin from './config/firebaseAdmin.js';

// Importación de rutas
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import classRoutes from './routes/classRoutes.js';
import tipoClaseRoutes from './routes/tipoClaseRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import creditLogRoutes from './routes/creditLogRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import trainingPlanRoutes from './routes/trainingPlanRoutes.js';
import publicUserRoutes from './routes/publicRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import checkInRoutes from './routes/checkInRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import ejercicioRoutes from './routes/ejercicioRoutes.js';
import planRoutes from './routes/planRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';


// Importación de Middlewares
import { notFound, errorHandler } from './middlewares/errorMiddleware.js';

// Importación de CRON Jobs
import { scheduleMonthlyCreditReset } from './cron/CreditResetJob.js';
import { scheduleMonthlyClassGeneration } from './cron/ClassGenerationJob.js';
import { scheduleDebtorNotifications } from './cron/debtorBalanceNotifier.js'; 
import { scheduleMonthlyCleanup } from './cron/monthlyReport.js';
import { scheduleClassReminders } from './cron/ClassReminderJob.js';


dotenv.config();
const app = express();

initializeFirebaseAdmin();

const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
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
app.use('/api/transactions', gymTenantMiddleware, transactionRoutes);
app.use('/api/plans', gymTenantMiddleware, trainingPlanRoutes);
app.use('/api/auth', gymTenantMiddleware, authRoutes);
app.use('/api/check-in', gymTenantMiddleware, checkInRoutes);
app.use('/api/settings', gymTenantMiddleware, settingsRoutes);
app.use('/api/ejercicios', gymTenantMiddleware, ejercicioRoutes);
app.use('/api/planes', gymTenantMiddleware, planRoutes);
app.use('/api/upload', gymTenantMiddleware, uploadRoutes);

app.use('/api/public/users', publicUserRoutes);//Ruta publica


app.use('/api/debug', debugRoutes); 

app.get('/', (req, res) => {
    res.send('API del Gym App está funcionando!');
});


scheduleMonthlyClassGeneration();
scheduleMonthlyCreditReset();
scheduleDebtorNotifications(); 
scheduleMonthlyCleanup();
scheduleClassReminders();

// Middlewares de manejo de errores
app.use(notFound);
app.use(errorHandler);



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));