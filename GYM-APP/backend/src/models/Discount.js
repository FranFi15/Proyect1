import mongoose from 'mongoose';

const discountSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ['percent', 'fixed'],
        required: true,
    },
    value: {
        type: Number,
        required: true,
        min: 0,
    },
    isActive: { type: Boolean, default: true },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    /** Clients eligible for this discount (synced with User.assignedDiscountId). */
    assignedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
}, {
    timestamps: true,
});

export default (gymDBConnection) => {
    if (gymDBConnection.models.Discount) {
        return gymDBConnection.models.Discount;
    }
    return gymDBConnection.model('Discount', discountSchema);
};
