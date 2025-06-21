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
app.use(cors({ origin: 'http://localhost:5173' }))
app.use('/api/public', publicRoutes);

app.use('/api/admin', adminRoutes);
app.use('/api/clients', clientRoutes);


app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT || 6000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});