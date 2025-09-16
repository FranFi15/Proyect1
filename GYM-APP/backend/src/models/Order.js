import mongoose from 'mongoose';

const orderItemSchema = mongoose.Schema({
    itemType: { type: String, required: true, enum: ['package', 'tipoClase'] },
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true }, 
});

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    items: [orderItemSchema],
    totalAmount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    paymentId: { 
        type: String,
    },
}, { timestamps: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.Order) {
        return gymDBConnection.models.Order;
    }
    return gymDBConnection.model('Order', orderSchema);
};