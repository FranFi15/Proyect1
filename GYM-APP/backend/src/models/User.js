import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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
    balance: {
        type: Number,
        default: 0,
        comment: 'Deuda del usuario. Positivo significa que debe dinero.'
    },
    lastBalanceNotificationDate: {
        type: Date,
        comment: 'Fecha del último envío de notificación de saldo deudor.'
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
}, {
    timestamps: true,
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.contraseña);
};

userSchema.pre('save', async function (next) {
    if (!this.isModified('contraseña')) {
        return next();
    }
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

userSchema.methods.getResetPasswordToken = function() {
    const resetToken = crypto.randomBytes(20).toString('hex');

    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    return resetToken;
};

export default (gymDBConnection) => {
    if (gymDBConnection.models.User) {
        return gymDBConnection.models.User;
    }
    return gymDBConnection.model('User', userSchema);
};