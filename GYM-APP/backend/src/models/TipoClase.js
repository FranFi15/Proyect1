
import mongoose from 'mongoose';

const tipoClaseSchema = mongoose.Schema(
    {
        nombre: {
            type: String,
            required: true,
            unique: true, // Asegura que no haya dos tipos de clase con el mismo nombre
            trim: true,   // Elimina espacios en blanco al principio y final
        },
        descripcion: {
            type: String,
            default: '',
        },
        // Podrías añadir más campos aquí, como un color, un ícono, etc.
    },
    {
        timestamps: true, // Para created/updatedAt
    }
);


export default (gymDBConnection) => {
    if (gymDBConnection.models.TipoClase) {
        return gymDBConnection.models.TipoClase;
    }
    return gymDBConnection.model('TipoClase', tipoClaseSchema);
};