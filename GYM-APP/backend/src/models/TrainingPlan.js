// src/models/TrainingPlan.js
import mongoose from 'mongoose';

const trainingPlanSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true
    },
    template: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TrainingTemplate'
    },
    name: { 
        type: String, 
        required: true, 
        default: 'Nuevo Plan' 
    },
    description: {
        type: String,
    },
    content: { 
        type: String, 
        required: true,
    },
    isVisibleToUser: { 
        type: Boolean, 
        default: false,
        required: true 
    }, 
}, { timestamps: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.TrainingPlan) {
        return gymDBConnection.models.TrainingPlan;
    }
    return gymDBConnection.model('TrainingPlan', trainingPlanSchema);
};
