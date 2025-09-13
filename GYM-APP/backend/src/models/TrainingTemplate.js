import mongoose from 'mongoose';

const trainingTemplateSchema = new mongoose.Schema({
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true
    },
    name: { 
        type: String, 
        required: true, 
        default: 'Nueva Plantilla'
    },
    description: {
        type: String,
    },
    content: { 
        type: String, 
        required: true,
    },
}, { timestamps: true });

export default (gymDBConnection) => {
    // Reutiliza el modelo si ya ha sido compilado en esta conexión
    if (gymDBConnection.models.TrainingTemplate) {
        return gymDBConnection.models.TrainingTemplate;
    }
    // Si no, lo compila y lo devuelve
    return gymDBConnection.model('TrainingTemplate', trainingTemplateSchema);
};
