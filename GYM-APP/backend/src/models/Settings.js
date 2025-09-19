import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: 'main_settings'
    },
    mpAccessToken: {
        type: String,
        select: false,
    },
    mpRefreshToken: {
        type: String,
        select: false,
    },
    mpUserId: {
        type: String,
    },
    mpConnected: {
        type: Boolean,
        default: false,
    },
});

export default (gymDBConnection) => {
    if (gymDBConnection.models.Settings) {
        return gymDBConnection.models.Settings;
    }
    return gymDBConnection.model('Settings', settingsSchema);
};