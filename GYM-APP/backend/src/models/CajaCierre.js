import mongoose from 'mongoose';

const cajaCierreSchema = new mongoose.Schema({
    /** Gym-local calendar day YYYY-MM-DD */
    dayStr: { type: String, required: true, trim: true },
    sucursal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sucursal',
        default: null,
    },
    expectedEfectivo: { type: Number, default: 0 },
    countedEfectivo: { type: Number, required: true },
    difference: { type: Number, default: 0 },
    ingresosByMethod: {
        efectivo: { type: Number, default: 0 },
        transfer: { type: Number, default: 0 },
        mercadopago: { type: Number, default: 0 },
    },
    ingresosTotal: { type: Number, default: 0 },
    gastosByMethod: {
        efectivo: { type: Number, default: 0 },
        transfer: { type: Number, default: 0 },
        mercadopago: { type: Number, default: 0 },
    },
    gastosEfectivo: { type: Number, default: 0 },
    gastosTotal: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    closedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    closedAt: { type: Date, default: Date.now },
}, { timestamps: true });

cajaCierreSchema.index({ dayStr: 1, sucursal: 1 }, { unique: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.CajaCierre) {
        return gymDBConnection.models.CajaCierre;
    }
    return gymDBConnection.model('CajaCierre', cajaCierreSchema);
};
