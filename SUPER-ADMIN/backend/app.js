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

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8081'
];

app.use(cors({
    origin: function (origin, callback) {
        // Permite peticiones si el origen está en nuestra lista blanca
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    }
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