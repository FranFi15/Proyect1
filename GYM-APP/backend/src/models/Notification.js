// RUTA: backend/src/models/Notification.js

import mongoose from 'mongoose';

const notificationSchema = mongoose.Schema({
    user: { // El usuario que debe recibir la notificación
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    message: { // El mensaje de la notificación
        type: String,
        required: true,
    },
    read: { // Si la notificación ha sido leída
        type: Boolean,
        default: false,
    },
    // Opcional: Podrías añadir más campos para contextualizar la notificación
    type: { // Ej: 'class_unenroll', 'general_alert', 'new_message'
        type: String,
        enum: ['class_unenroll', 'general_alert', 'class_update', 'class_cancellation_refund', 'class_unenroll_spot_available', 'monthly_payment_reminder'],
        required: false,
    },
    class: { // Si la notificación está relacionada con una clase específica
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: false,
    },
}, {
    timestamps: true,
});


export default (gymDBConnection) => {
    if (gymDBConnection.models.Notification) {
        return gymDBConnection.models.Notification;
    }
    return gymDBConnection.model('Notification', notificationSchema);
};