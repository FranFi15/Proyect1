import mongoose from 'mongoose';
const { Schema } = mongoose;

const feedbackSchema = new mongoose.Schema({
    usuario: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    plan: { 
        type: Schema.Types.ObjectId, 
        ref: 'Plan', 
        required: true 
    },
    ejercicio: { 
        type: Schema.Types.ObjectId, 
        ref: 'Ejercicio', 
        required: true 
    },
    fecha: { 
        type: Date, 
        default: Date.now 
    },
    pesoUtilizado: { type: String },
    dificultad: { // Número del 1 al 10
        type: Number,
        min: 1,
        max: 10
    },
    comentarios: { type: String }
}, { timestamps: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.FeedbackEjercicio) {
        return gymDBConnection.models.FeedbackEjercicio;
    }
    return gymDBConnection.model('FeedbackEjercicio', feedbackSchema);
};