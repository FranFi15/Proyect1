import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // Importamos bcrypt para la encriptación

const settingsSchema = new mongoose.Schema({
    // Usamos un ID fijo para asegurar que solo haya un documento de configuración por gimnasio
    _id: {
        type: String,
        default: 'main_settings'
    },
    
    // Almacenará el token del DUEÑO DEL GIMNASIO para procesar pagos
    mpAccessToken: {
        type: String,
        select: false, // No se envía en consultas normales por seguridad
    },
    mpRefreshToken: {
        type: String, // Para renovar el Access Token cuando expire
        select: false,
    },
    mpUserId: {
        type: String, // El ID de vendedor de Mercado Pago del gimnasio
    },
    mpConnected: {
        type: Boolean, // Para saber si la cuenta ya está vinculada
        default: false,
    },

    // La clave de seguridad que crea el admin para proteger sus credenciales
    securityKey: {
        type: String,
        select: false,
    },
});

// Hook para encriptar la clave de seguridad antes de guardarla
settingsSchema.pre('save', async function (next) {
    if (!this.isModified('securityKey')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.securityKey = await bcrypt.hash(this.securityKey, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para comparar la clave de seguridad ingresada por el admin
settingsSchema.methods.matchSecurityKey = async function (enteredKey) {
    if (!this.securityKey) return false;
    return await bcrypt.compare(enteredKey, this.securityKey);
};

export default (gymDBConnection) => {
    if (gymDBConnection.models.Settings) {
        return gymDBConnection.models.Settings;
    }
    return gymDBConnection.model('Settings', settingsSchema);
};