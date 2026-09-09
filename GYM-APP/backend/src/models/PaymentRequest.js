// models/PaymentRequest.js
import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentPackage', required: true },
    quantity: { type: Number, default: 1, min: 1 }
}, { _id: false });

const paymentRequestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Compatibilidad: un solo paquete (tickets viejos / un ítem)
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentPackage' },

    // Carrito: uno o más paquetes
    items: { type: [cartItemSchema], default: [] },

    amountTransferred: { type: Number, required: true },
    receiptUrl: { type: String, default: '' },
    method: {
        type: String,
        enum: ['transfer', 'mercadopago'],
        default: 'transfer'
    },
    mpPreferenceId: { type: String },
    mpPaymentId: { type: String },
    mpStatus: { type: String },

    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },

    adminNotes: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date }
}, {
    timestamps: true
});

const getPaymentRequestModel = (dbConnection) => {
    return dbConnection.model('PaymentRequest', paymentRequestSchema);
};

export default getPaymentRequestModel;
