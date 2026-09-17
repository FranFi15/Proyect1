import mongoose from 'mongoose';

const planFeedbackSchema = new mongoose.Schema({
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TrainingPlan',
        required: true,
        index: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    professor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
    },
    comment: {
        type: String,
        default: '',
        trim: true,
        maxlength: 2000,
    },
}, { timestamps: true });

planFeedbackSchema.index({ plan: 1, user: 1 }, { unique: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.PlanFeedback) {
        return gymDBConnection.models.PlanFeedback;
    }
    return gymDBConnection.model('PlanFeedback', planFeedbackSchema);
};
