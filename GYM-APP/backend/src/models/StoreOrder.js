import mongoose from 'mongoose';

const storeOrderItemSchema = new mongoose.Schema({
    storeItem: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreItem', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1, min: 1 },
    selectedOption: { type: String, default: '' },
}, { _id: false });

const storeOrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [storeOrderItemSchema], default: [] },
    orderCode: { type: String, required: true, index: true },
    amountTransferred: { type: Number, required: true },
    receiptUrl: { type: String, default: '' },
    method: {
        type: String,
        enum: ['transfer', 'mercadopago'],
        default: 'transfer',
    },
    mpPreferenceId: { type: String },
    mpPaymentId: { type: String },
    mpStatus: { type: String },
    status: {
        type: String,
        enum: ['pending', 'paid', 'rejected', 'delivered'],
        default: 'pending',
        index: true,
    },
    adminNotes: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    deliveredAt: { type: Date },
}, {
    timestamps: true
});

const getStoreOrderModel = (dbConnection) => {
    if (dbConnection.models.StoreOrder) return dbConnection.models.StoreOrder;
    return dbConnection.model('StoreOrder', storeOrderSchema);
};

export default getStoreOrderModel;
