import mongoose from 'mongoose';

const tipoClaseSchema = mongoose.Schema(
    {
        nombre: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        descripcion: {
            type: String,
            default: '',
        },
        // --- CAMPOS PARA GESTIÓN DE INVENTARIO DE CRÉDITOS ---
        creditosTotales: {
            type: Number,
            default: 0,
            comment: 'Suma de la capacidad de todas las clases de este tipo. Aumenta al crear clases.',
        },
        creditosDisponibles: {
            type: Number,
            default: 0,
            comment: 'Créditos que aún no han sido asignados a ningún usuario. Disminuye al dar créditos.',
        }
    },
    {
        timestamps: true,
    }
);

export default (gymDBConnection) => {
    if (gymDBConnection.models.TipoClase) {
        return gymDBConnection.models.TipoClase;
    }
    return gymDBConnection.model('TipoClase', tipoClaseSchema);
};