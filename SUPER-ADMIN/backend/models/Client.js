import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const ClientSchema = new mongoose.Schema({
    nombre: { type: String, required: true, trim: true },
    urlIdentifier: { type: String, required: true, unique: true, trim: true, lowercase: true },
    emailContacto: { type: String, required: true, unique: true, trim: true, lowercase: true, match: [/.+@.+\..+/, 'Por favor, usa un email válido'] },
    clientId: { type: String, unique: true, default: uuidv4 },
    apiSecretKey: { type: String, required: true, unique: true, default: () => uuidv4().replace(/-/g, '') + Date.now().toString(36) },
    estadoSuscripcion: { type: String, enum: ['activo', 'inactivo', 'periodo_prueba'], default: 'periodo_prueba' },
    logoUrl: { type: String, default: '' },
    primaryColor: { type: String, default: '#150224' },
    connectionStringDB: { type: String, required: true, unique: true },

    // --- NUEVOS CAMPOS PARA PRECIOS Y LÍMITES INDIVIDUALES ---
    clientLimit: {
        type: Number,
        required: true,
        default: 100, // Límite de clientes por defecto para un nuevo gimnasio
    },
    clientCount: {
        type: Number,
        required: true,
        default: 0, // Contador de clientes actuales, se actualizará desde GYM-APP
    },
    basePrice: {
        type: Number,
        required: true,
        default: 40000, // Precio base por defecto en ARS
    },
    pricePerBlock: {
        type: Number,
        required: true,
        default: 15000, // Precio por cada bloque de clientes adicional
    },
    type: {
        type: String,
        enum: ['turno', 'restaurante'], 
        default: 'turno' 
    },

}, { timestamps: true });

const Client = mongoose.model('Client', ClientSchema);

export default Client;