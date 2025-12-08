// src/models/Class.js
import mongoose from 'mongoose';

const classSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: false,
        default: 'Turno'
    },
    tipoClase: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TipoClase',
        required: true,
    },
    horaInicio: {
        type: String,
        required: true, // Requerido para todas las clases
    },
    horaFin: {
        type: String,
        required: true, // Requerido para todas las clases
    },
    capacidad: {
        type: Number,
        required: true,
        default: 0,
    },
    profesor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
    profesores: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    tipoInscripcion: {
        type: String,
        enum: ['libre', 'fijo'],
        default: 'libre',
    },
    usuariosInscritos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
     waitlist: [{ // Array of user IDs who are on the waiting list for this class
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    fecha: { // Para clases 'libre'
        type: Date,
        required: false,
    },
    diaDeSemana: { // Para todas las clases, pero especialmente para 'fijo'
        type: [{ type: String }], // DEBE SER UN ARRAY DE STRINGS
    },
    rrule: { // Solo para clases 'fijo'
        type: String 
    },
    // --- FIN DE CAMPOS CORREGIDOS ---
    estado: {
        type: String,
        enum: ['activa', 'cancelada', 'llena'],
        default: 'activa',
    },
}, {
    timestamps: true,
});
// Exporta una función que devuelve el modelo para una conexión de DB específica
export default (gymDBConnection) => {
    // Si el modelo ya ha sido compilado en esta conexión, reutilizarlo
    if (gymDBConnection.models.Class) {
        return gymDBConnection.models.Class;
    }
    return gymDBConnection.model('Class', classSchema);
};
