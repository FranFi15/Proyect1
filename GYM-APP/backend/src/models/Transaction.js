import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['charge', 'payment'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    relatedItem: {
        itemType: { type: String, enum: ['class_pack', 'subscription'] },
        itemId: { type: mongoose.Schema.Types.ObjectId },
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    receiptUrl: { type: String },
    method: {
        type: String,
        enum: ['efectivo', 'transfer', 'mercadopago', 'manual', 'deuda'],
        default: 'efectivo',
    },
    source: {
        type: String,
        enum: ['caja', 'pack', 'store', 'account', 'billing', 'subscription'],
        default: 'billing',
    },
    originalAmount: { type: Number, default: null },
    discountAmount: { type: Number, default: 0 },
    discountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Discount',
        default: null,
    },
    paymentRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentRequest',
        default: null,
    },
    storeOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StoreOrder',
        default: null,
    },
    sucursal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sucursal',
        default: null,
    },
    voidedAt: { type: Date, default: null },
    voidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    voidReason: { type: String, default: '' },
}, { timestamps: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.Transaction) {
        return gymDBConnection.models.Transaction;
    }
    return gymDBConnection.model('Transaction', transactionSchema);
};
