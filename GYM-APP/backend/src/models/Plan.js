import mongoose from 'mongoose';
const { Schema } = mongoose;

const ejercicioEnPlanSchema = new Schema({
    ejercicio: { 
        type: Schema.Types.ObjectId, 
        ref: 'Ejercicio',
        required: true 
    },
    series: { type: String }, // String para permitir rangos como "3-4"
    repeticiones: { type: String }, // String para permitir rangos como "8-12"
});

const diaDeEntrenamientoSchema = new Schema({
    tituloDia: { 
        type: String, 
        required: [true, 'El título del día es obligatorio.'],
        default: 'Día de Entrenamiento'
    },
    ejercicios: [ejercicioEnPlanSchema],
});

const planSchema = new mongoose.Schema({
    titulo: { 
        type: String, 
        required: [true, 'El título del plan es obligatorio.'],
    },
    creadoPor: { // El profesional que lo creó
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    asignadoA: { // El cliente al que se le asigna
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    diasDeEntrenamiento: [diaDeEntrenamientoSchema],
}, { timestamps: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.Plan) {
        return gymDBConnection.models.Plan;
    }
    return gymDBConnection.model('Plan', planSchema);
};