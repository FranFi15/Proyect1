import mongoose from 'mongoose';

const creditLogSchema = mongoose.Schema(
    {
        // A quién pertenece este registro
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        // Quién realizó la acción (si fue un admin)
        admin: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Referencia a la misma colección de usuarios
            required: false, // No es requerido si la acción la hace el propio usuario
        },
        // Cantidad de créditos movidos. Positivo para añadir, negativo para gastar.
        amount: {
            type: Number,
            required: true,
        },
        // El tipo de clase/crédito que se está moviendo.
        tipoClase: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TipoClase',
            required: true,
        },
        // El saldo que quedó el usuario DESPUÉS de esta transacción.
        newBalance: {
            type: Number,
            required: true,
        },
        // La razón del movimiento. Esto es clave para la auditoría.
        reason: {
            type: String,
            required: true,
            enum: [
                'ajuste_manual_admin', // Admin añade o quita créditos.
                'inscripcion_clase',   // Usuario se inscribe a una clase.
                'reembolso_anulacion', // Usuario anula inscripción.
                'compra_pack',         // Compra de un paquete (manual o MP).
                'renovacion_suscripcion',// Recarga automática mensual.
                'reembolso_cancelacion_admin', // Admin cancela una clase y devuelve créditos.
                'inicializacion',      // Créditos iniciales al registrarse.
            ],
        },
        // Un campo flexible para guardar detalles extra.
        // Ej: el ID de la clase a la que se inscribió, o una nota del admin.
        details: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true, // Para saber exactamente cuándo ocurrió.
    }
);

// Exportación del modelo para que pueda ser usado en la conexión de cada gym
export default (gymDBConnection) => {
    if (gymDBConnection.models.CreditLog) {
        return gymDBConnection.models.CreditLog;
    }
    return gymDBConnection.model('CreditLog', creditLogSchema);
};