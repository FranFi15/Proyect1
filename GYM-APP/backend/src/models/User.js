import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const monthlySubscriptionSchema = mongoose.Schema({
    tipoClase: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TipoClase',
        required: true,
    },
    status: {
        type: String,
        enum: ['manual', 'automatica'],
        default: 'manual',
        required: true,
    },
    autoRenewAmount: {
        type: Number,
        default: 0,
    },
    lastRenewalDate: {
        type: Date,
        required: false,
    },
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
    pushToken: {
        type: String,
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
    planesFijos: [{
        tipoClase: { type: mongoose.Schema.Types.ObjectId, ref: 'TipoClase' },
        horaInicio: String,
        horaFin: String,
        diasDeSemana: [String],
        fechaInicio: Date,
        fechaFin: Date,
    }],
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

// --- CORRECCIÓN CLAVE AQUÍ ---
userSchema.pre('save', async function (next) {
    // Si la contraseña no se ha modificado, salimos de la función.
    if (!this.isModified('contraseña')) {
        return next();
    }

    // Si se modificó, la encriptamos.
    try {
        const salt = await bcrypt.genSalt(10);
        this.contraseña = await bcrypt.hash(this.contraseña, salt);
        next();
    } catch (error) {
        next(error);
    }
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
