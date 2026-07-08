// models/PaymentPackage.js
import mongoose from 'mongoose';

const paymentPackageSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Ej: "Plan Mensual 8 Clases"
    description: { type: String }, // Ej: "Incluye 8 clases de Funcional"
    price: { type: Number, required: true }, // Ej: 15000
    
    // Si el paquete otorga créditos específicos:
    tipoClase: { type: mongoose.Schema.Types.ObjectId, ref: 'TipoClase' }, 
    creditsAmount: { type: Number, default: 0 }, // Ej: 8
    
    // Si el paquete otorga un Pase Libre (Clases ilimitadas + QR):
    isPaseLibre: { type: Boolean, default: false },
    // Si el paquete otorga Membresía (Solo acceso por QR):
    isMembresia: { type: Boolean, default: false },
    durationDays: { type: Number, default: 30 }, // Ej: 30 días de pase libre o membresía

    isActive: { type: Boolean, default: true } // Para que el admin pueda ocultar paquetes viejos
}, {
    timestamps: true
});

const getPaymentPackageModel = (dbConnection) => {
    return dbConnection.model('PaymentPackage', paymentPackageSchema);
};

export default getPaymentPackageModel;