import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const ClientSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    // Este campo es clave para que el frontend pueda encontrar el gym por la URL
    urlIdentifier: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    emailContacto: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Por favor, usa un email válido'] 
    },
    clientId: { 
        type: String,
        unique: true,
        default: uuidv4 
    },
    apiSecretKey: { 
        type: String,
        required: true,
        unique: true,
        default: () => uuidv4().replace(/-/g, '') + Date.now().toString(36)
    },
    estadoSuscripcion: {
        type: String,
        enum: ['activo', 'inactivo', 'periodo_prueba', 'vencido'], 
        default: 'periodo_prueba' 
    },
    logoUrl: { 
        type: String,
        default: '' 
    },
    primaryColor: {
        type: String,
        default: '#150224' 
    },
    fechaInicioSuscripcion: { type: Date, default: Date.now },
    fechaVencimientoSuscripcion: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    connectionStringDB: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const Client = mongoose.model('Client', ClientSchema);

export default Client;