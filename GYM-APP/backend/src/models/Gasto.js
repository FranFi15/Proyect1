import mongoose from 'mongoose';

const gastoSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: {
        type: String,
        enum: ['alquiler', 'servicios', 'sueldos', 'insumos', 'mantenimiento', 'impuestos', 'otros'],
        default: 'otros',
    },
    method: {
        type: String,
        enum: ['efectivo', 'transfer', 'mercadopago', 'manual'],
        default: 'efectivo',
    },
    notes: { type: String, default: '' },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    spentAt: { type: Date, default: Date.now },
    sucursal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sucursal',
        default: null,
    },
}, { timestamps: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.Gasto) {
        return gymDBConnection.models.Gasto;
    }
    return gymDBConnection.model('Gasto', gastoSchema);
};
