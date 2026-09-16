import mongoose from 'mongoose';

const benefitSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000,
    },
    imageUrl: {
        type: String,
        default: '',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, { timestamps: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.Benefit) {
        return gymDBConnection.models.Benefit;
    }
    return gymDBConnection.model('Benefit', benefitSchema);
};
