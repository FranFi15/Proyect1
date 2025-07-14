// src/models/Configuracion.js 
import mongoose from 'mongoose';
const configSchema = mongoose.Schema({
    mesesAnticipacion: { type: Number, default: 1 }, // Por defecto, 1 mes
    // Otros ajustes futuros...
});

export default (gymDBConnection) => {
    if (gymDBConnection.models.Configuracion) {
        return gymDBConnection.models.Configuracion;
    }
    return gymDBConnection.model('Configuracion', configSchema);
};