// GYM-APP/backend/src/models/SentNotification.js
import mongoose from 'mongoose';

const sentNotificationSchema = mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    targetType: {
        type: String, // 'all', 'user', 'role', 'class'
        required: true,
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'targetModel',
    },
    targetModel: {
        type: String,
        enum: ['User', 'Clase', null],
        default: null,
    },
    targetRole: {
        type: String,
    },
    recipientCount: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

export default (gymDBConnection) => {
    if(gymDBConnection.models.SentNotification) {
        return gymDBConnection.models.SentNotification;
    }
    return gymDBConnection.model('SentNotification', sentNotificationSchema);
};
