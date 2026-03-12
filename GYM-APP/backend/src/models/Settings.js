import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    _id: { type: String, default: 'main_settings' },
    classVisibilityDays: {
        type: Number,
        default: 0 
    },
    courtesyCredit: {
        isActive: { 
            type: Boolean, 
            default: false 
        },
        tipoClase: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'TipoClase' 
        },
        amount: { 
            type: Number, 
            default: 1 
        }
    },
    mercadoPago: {
        isLinked: {
            type: Boolean,
            default: false
        },
        accessToken: {
            type: String,
            default: null
        },
        refreshToken: {
            type: String,
            default: null
        },
        publicKey: {
            type: String,
            default: null
        },
        userId: {
            type: String,
            default: null
        },
        linkedAt: {
            type: Date,
            default: null
        }
    }
});

export default (gymDBConnection) => {
    if (gymDBConnection.models.Settings) return gymDBConnection.models.Settings;
    return gymDBConnection.model('Settings', settingsSchema);
};