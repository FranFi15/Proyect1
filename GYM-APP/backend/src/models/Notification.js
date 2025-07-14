// GYM-APP/backend/src/models/Notification.js
import mongoose from 'mongoose';

const notificationSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
    type: String,
    required: false,
    default: 'Notificación del gimnasio',
    },
    message: {
        type: String,
        required: true,
    },
    type: { // e.g., 'general', 'class_cancellation', 'credit_update', 'important_news'
        type: String,
        default: 'general',
    },
    class: { // Reference to a class if notification is class-related
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clase', // Assuming 'Clase' is the correct model name here
    },
    read: {
        type: Boolean,
        default: false,
    },
    isImportant: {
        type: Boolean,
        default: false,
    },
  
}, {
    timestamps: true,
});

export default (gymDBConnection) => {
    if(gymDBConnection.models.Notification) {
        return gymDBConnection.models.Notification;
    }
    return gymDBConnection.model('Notification', notificationSchema);
};