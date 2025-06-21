// src/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const monthlySubscriptionSchema = mongoose.Schema({
    tipoClase: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TipoClase',
        required: true,
    },
    status: { // Estado de la suscripción: 'manual' (recarga manual) o 'automatic' (recarga automática)
        type: String,
        enum: ['manual', 'automatica'],
        default: 'manual',
        required: true,
    },
    autoRenewAmount: { // Cantidad de créditos a recargar automáticamente cada mes
        type: Number,
        default: 0,
    },
    lastRenewalDate: { // Fecha de la última recarga automática (para controlar la periodicidad)
        type: Date,
        required: false, // Será null si es manual, o la fecha de la última recarga si es automático
    },
    // Podrías añadir más campos aquí como `price` o `paymentMethod` si lo necesitas
});

const userSchema = mongoose.Schema({
    nombre: {
        type: String,
        required: true,
    },
    apellido: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    contraseña: {
        type: String,
        required: true,
    },
    dni: {
        type: String,
        required: true,
        unique: true,
    },
    fechaNacimiento: {
        type: Date,
        required: true,
    },
    sexo: {
        type: String,
        enum: ['Masculino', 'Femenino', 'Otro'], 
        default: 'Otro', 
        required: false 
    },
    telefonoEmergencia: {
        type: String,
        required: true,
    },
    direccion: {
        type: String,
        required: false, 
    },
    numeroTelefono: {
        type: String,
        required: false, 
    },
    obraSocial: {
        type: String,
        required: false, 
    },
    planesFijos: {
        type: Map,
        of: [String], // Almacena un array de días de la semana para cada ID de clase fija
        default: {},
    },
    roles: {
        type: [String],
        default: ['cliente'],
        enum: ['cliente', 'admin', 'profesor']
    },
    creditosPorTipo: {
        type: Map,
        of: Number,
        default: {},
    },
    clasesInscritas: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Class',
        },
    ],
    monthlySubscriptions: [monthlySubscriptionSchema],
}, {
    timestamps: true,
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.contraseña);
};

userSchema.pre('save', async function (next) {
    if (!this.isModified('contraseña')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.contraseña = await bcrypt.hash(this.contraseña, salt);
});

userSchema.pre('findOneAndUpdate', async function (next) {
    const update = this.getUpdate();
    if (update.contraseña) {
        const salt = await bcrypt.genSalt(10);
        update.contraseña = await bcrypt.hash(update.contraseña, salt);
    }
    next();
});

export default (gymDBConnection) => {
    if(gymDBConnection.models.User) {
        return gymDBConnection.models.User;
    }
    return gymDBConnection.model('User', userSchema);
};