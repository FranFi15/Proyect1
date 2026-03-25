// models/PaymentRequest.js
import mongoose from 'mongoose';

const paymentRequestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Quién pagó
    
    // Puede ser null si el cliente solo transfirió para saldar una deuda vieja sin comprar un paquete nuevo
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentPackage' }, 
    
    amountTransferred: { type: Number, required: true }, // Cuánta plata dice que transfirió
    receiptUrl: { type: String, required: true }, // La URL de la foto del comprobante
    
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'], 
        default: 'pending' 
    },
    
    adminNotes: { type: String }, // Por si el admin lo rechaza y quiere dejarle un mensaje (Ej: "La foto se ve borrosa")
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Qué admin lo aprobó/rechazó
    reviewedAt: { type: Date }
}, {
    timestamps: true
});

const getPaymentRequestModel = (dbConnection) => {
    return dbConnection.model('PaymentRequest', paymentRequestSchema);
};

export default getPaymentRequestModel;