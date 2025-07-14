import dotenv from 'dotenv';
import express from 'express';
import connectDB from './config/db.js';
import clientRoutes from './routes/clientRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import cors from 'cors';

dotenv.config();
const app = express();

connectDB();

app.use(express.json());

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
app.use('/api/public', publicRoutes);

app.use('/api/admin', adminRoutes);
app.use('/api/clients', clientRoutes);


app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT || 6001;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});