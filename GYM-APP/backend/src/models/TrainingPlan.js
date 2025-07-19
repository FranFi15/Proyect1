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
        required: true // El profe/admin que lo creó
    }, 
    title: { 
        type: String, 
        required: true, 
        default: 'Plan de Entrenamiento' 
    },
    content: { 
        type: String, 
        required: true // El contenido del plan (ejercicios, series, etc.)
    }, 
    isVisibleToUser: { 
        type: Boolean, 
        default: false, // Por defecto, el plan no es visible para el cliente
        required: true 
    }, 
}, { timestamps: true });


export default (gymDBConnection) => {
    if (gymDBConnection.models.TrainingPlan) {
        return gymDBConnection.models.TrainingPlan;
    }
    return gymDBConnection.model('TrainingPlan', trainingPlanSchema);
};