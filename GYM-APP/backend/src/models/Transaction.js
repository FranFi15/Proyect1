import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['charge', 'payment'], // 'charge' = se le cobra, 'payment' = paga
        required: true 
    }, 
    amount: { 
        type: Number, 
        required: true // Siempre un número positivo.
    }, 
    description: { 
        type: String, 
        required: true // Ej: "Abono mensual Yoga", "Pago en efectivo"
    },
    // Opcional: para vincular el movimiento a un item específico
    relatedItem: { 
        itemType: { type: String, enum: ['class_pack', 'subscription'] },
        itemId: { type: mongoose.Schema.Types.ObjectId }
    },
    // El admin/profesor que registró el movimiento
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }, 
}, { timestamps: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.Transaction) {
        return gymDBConnection.models.Transaction;
    }
    return gymDBConnection.model('Transaction', transactionSchema);
};