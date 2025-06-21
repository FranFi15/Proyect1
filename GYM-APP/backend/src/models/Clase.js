// src/models/Class.js
import mongoose from 'mongoose';

const classSchema = mongoose.Schema({
    nombre: {
        type: String,
        required: true,
    },
    tipoClase: { // Referencia al tipo de clase (ej: Yoga, Spinning)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TipoClase',
        required: true,
    },
    // Campo para horario fijo (ej: "Lunes 18:00")
    horarioFijo: {
        type: String,
        required: false,
    },
    horaInicio: {
        type: String,
        required: false,
    },
    horaFin: {
        type: String,
        required: false,
    },
    diaDeSemana: {
        type: [String], // Array de días: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
        required: false,
        enum: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    },
    // Campo para definir si la clase requiere inscripción a un horario fijo o es libre
    tipoInscripcion: {
        type: String,
        enum: ['libre', 'fijo'], // 'libre' para selección por capacidad, 'fijo' para horarios y planes
        default: 'libre',
    },
    capacidad: {
        type: Number,
        required: true,
        default: 0,
    },
    usuariosInscritos: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    ],
    fecha: { // Mantener fecha para clases únicas o eventos (ahora es opcional)
        type: Date,
        required: false,
    },
    estado: {
        type: String,
        enum: ['activa', 'cancelada', 'llena'],
        default: 'activa',
    },
    profesor: { // Añadido para la referencia al profesor
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // El profesor es un usuario con un rol específico
        required: false, // Podría ser true si siempre se requiere un profesor
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
