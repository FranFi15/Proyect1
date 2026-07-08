// src/models/Sucursal.js
import mongoose from 'mongoose';

const sucursalSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    direccion: {
        type: String,
        default: '',
        trim: true
    },
    activa: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

export default (gymDBConnection) => {
    if (gymDBConnection.models.Sucursal) {
        return gymDBConnection.models.Sucursal;
    }
    return gymDBConnection.model('Sucursal', sucursalSchema);
};
