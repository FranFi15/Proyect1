import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const settingsSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: 'main_settings'
    },
    mercadoPagoAccessToken: {
        type: String,
        select: false, 
    },
    securityKey: {
        type: String,
        select: false, 
    },
});

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