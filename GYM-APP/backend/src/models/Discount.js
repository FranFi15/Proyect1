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
}, {
    timestamps: true,
});

export default (gymDBConnection) => {
    if (gymDBConnection.models.Discount) {
        return gymDBConnection.models.Discount;
    }
    return gymDBConnection.model('Discount', discountSchema);
};
