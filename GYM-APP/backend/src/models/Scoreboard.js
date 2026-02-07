
import mongoose from 'mongoose';

const scoreboardSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    descripcion: { 
        type: String,
        default: ''
    },
    // --- CAMBIO CLAVE ---
    fechaLimite: { 
        type: Date,
        default: null, 
        required: false
    },
    metrics: { 
        type: [String],
        enum: ['tiempo', 'peso', 'distancia', 'repeticiones',],
        default: ['tiempo']
    },
    metricUnit: { 
        type: String, 
        default: ''
    },
    visible: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });



// 2. Esquema del Resultado (Lo que carga el Cliente)
const scoreboardEntrySchema = new mongoose.Schema({
    scoreboard: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Scoreboard',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Guardamos los valores. No todos son obligatorios, depende del 'metrics' del scoreboard
    peso: { type: Number, default: 0 },  
    tiempo: { type: String, default: '' },   
    distancia: { type: Number, default: 0 }, 
    repeticiones: { type: Number, default: 0 },
    
    nota: { type: String, default: '' },
    rx: { type: Boolean, default: true } 
}, { timestamps: true });

// Exportamos una función que devuelve ambos modelos en un objeto
export default (gymDBConnection) => {
    const models = {};
    
    if (gymDBConnection.models.Scoreboard) {
        models.Scoreboard = gymDBConnection.models.Scoreboard;
    } else {
        models.Scoreboard = gymDBConnection.model('Scoreboard', scoreboardSchema);
    }

    if (gymDBConnection.models.ScoreboardEntry) {
        models.ScoreboardEntry = gymDBConnection.models.ScoreboardEntry;
    } else {
        models.ScoreboardEntry = gymDBConnection.model('ScoreboardEntry', scoreboardEntrySchema);
    }

    return models;
};