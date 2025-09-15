import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    }, // Ej: "Paquete Invierno Funcional"
    description: { 
        type: String 
    },
    tipoClase: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'TipoClase', 
        required: true 
    },
    price: { 
        type: Number, 
        required: true 
    }, // Precio del paquete
    creditsToReceive: { 
        type: Number, 
        required: true 
    }, // Cuántos créditos recibe el cliente (ej: 12)
    isActive: { 
        type: Boolean, 
        default: true 
    }, // Para activar/desactivar la oferta
}, { timestamps: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.Package) {
        return gymDBConnection.models.Package;
    }
    return gymDBConnection.model('Package', packageSchema);
};