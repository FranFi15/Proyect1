import mongoose from 'mongoose';

const mpSubscriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    package: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentPackage',
        required: true,
    },
    /** membresia | pase | creditos */
    kind: {
        type: String,
        enum: ['membresia', 'pase', 'creditos'],
        required: true,
    },
    preapprovalId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'authorized', 'paused', 'cancelled'],
        default: 'pending',
        index: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        default: 'ARS',
    },
    frequency: {
        type: Number,
        default: 1,
    },
    frequencyType: {
        type: String,
        enum: ['days', 'months'],
        default: 'months',
    },
    reason: {
        type: String,
        default: '',
    },
    initPoint: {
        type: String,
        default: null,
    },
    nextPaymentDate: {
        type: Date,
        default: null,
    },
    lastChargedAt: {
        type: Date,
        default: null,
    },
    lastPaymentId: {
        type: String,
        default: null,
    },
    /** Idempotency for webhook charges */
    processedPaymentIds: {
        type: [String],
        default: [],
    },
    discountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Discount',
        default: null,
    },
    discountAmount: {
        type: Number,
        default: 0,
    },
    originalAmount: {
        type: Number,
        default: null,
    },
    cancelledAt: {
        type: Date,
        default: null,
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
}, {
    timestamps: true,
});

mpSubscriptionSchema.index({ user: 1, status: 1 });

export default (gymDBConnection) => {
    if (gymDBConnection.models.MpSubscription) {
        return gymDBConnection.models.MpSubscription;
    }
    return gymDBConnection.model('MpSubscription', mpSubscriptionSchema);
};
