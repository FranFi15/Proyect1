import mongoose from 'mongoose';
const { Schema } = mongoose;

const ejercicioEnPlanSchema = new Schema({
    ejercicio: { 
        type: Schema.Types.ObjectId, 
        ref: 'Ejercicio',
        required: true 
    },
    series: { type: String }, 
    repeticiones: { type: String }, 
    pesoSugerido: { type: String },
    duracion: { type: String },
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
    creadoPor: { 
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    asignadoA: { 
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    descripcion: { 
        type: String,
        trim: true
    },
    isVisibleToUser: { 
        type: Boolean,
        default: false
    },
    diasDeEntrenamiento: [diaDeEntrenamientoSchema],
}, { timestamps: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.Plan) {
        return gymDBConnection.models.Plan;
    }
    return gymDBConnection.model('Plan', planSchema);
};