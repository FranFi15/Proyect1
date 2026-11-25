import mongoose from 'mongoose';

const trialPendingSchema = new mongoose.Schema(
    {
        nombre: { type: String, required: true, trim: true },
        apellido: { type: String, required: true, trim: true },
        dni: { type: String, required: true, trim: true, index: true },
        email: { type: String, required: true, trim: true, lowercase: true, index: true },
        numeroTelefono: { type: String, required: true, trim: true },
        /** enroll = first trial signup; change = switch class after already enrolled */
        purpose: {
            type: String,
            enum: ['enroll', 'change'],
            default: 'enroll',
            index: true,
        },
        /** Set when purpose is change — existing trial-only user */
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        codeHash: { type: String, required: true },
        codeExpiresAt: { type: Date, required: true },
        verifiedAt: { type: Date, default: null },
        sessionTokenHash: { type: String, default: null, index: true },
        sessionExpiresAt: { type: Date, default: null },
        consumedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

trialPendingSchema.index({ email: 1, createdAt: -1 });

const getTrialPendingModel = (dbConnection) => {
    if (dbConnection.models.TrialPending) return dbConnection.models.TrialPending;
    return dbConnection.model('TrialPending', trialPendingSchema);
};

export default getTrialPendingModel;
