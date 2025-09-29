import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    _id: { type: String, default: 'main_settings' },
    classVisibilityDays: {
        type: Number,
        default: 0 
    },
});

export default (gymDBConnection) => {
    if (gymDBConnection.models.Settings) return gymDBConnection.models.Settings;
    return gymDBConnection.model('Settings', settingsSchema);
};