import mongoose from 'mongoose';

const ejercicioSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        required: [true, 'El nombre del ejercicio es obligatorio.'],
        trim: true 
    },
    // Aquí guardaremos la URL segura del video subido a Cloudinary
    videoUrl: { 
        type: String 
    },
    descripcion: { 
        type: String,
        trim: true
    },
}, { timestamps: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.Ejercicio) {
        return gymDBConnection.models.Ejercicio;
    }
    return gymDBConnection.model('Ejercicio', ejercicioSchema);
};