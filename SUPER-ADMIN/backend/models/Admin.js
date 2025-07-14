// admin-panel-backend/models/Admin.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // Importa bcryptjs para el hash de contraseñas

const AdminSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,      // El email es obligatorio
        unique: true,        // Cada email debe ser único
        lowercase: true,     // Guarda el email en minúsculas
        trim: true           // Elimina espacios en blanco al inicio/final
    },
    password: {
        type: String,
        required: true       // La contraseña es obligatoria
    },
    role: {
        type: String,
        enum: ['superadmin', 'admin'], // Solo permite estos roles ('superadmin' o 'admin')
        default: 'superadmin'        // Por defecto, será 'superadmin' si no se especifica
    },
    createdAt: {
        type: Date,
        default: Date.now    // Asigna la fecha y hora actual por defecto al crearse
    }
});

// Middleware de Mongoose: Hash de la contraseña antes de guardar
// Se ejecuta cada vez que se guarda (save) un documento Admin,
// pero solo si la contraseña ha sido modificada.
AdminSchema.pre('save', async function(next) {
    // Si la contraseña no ha sido modificada, pasa al siguiente middleware
    if (!this.isModified('password')) {
        return next();
    }
    // Genera un "salt" (cadena aleatoria) para el hash de la contraseña
    const salt = await bcrypt.genSalt(10); // 10 es el costo de hash, un valor recomendado
    // Hashea la contraseña usando el salt generado
    this.password = await bcrypt.hash(this.password, salt);
    next(); // Continúa con el proceso de guardado
});

// Método personalizado del esquema: Compara contraseñas
// Se usará para verificar si una contraseña ingresada coincide con la contraseña hasheada guardada.
AdminSchema.methods.matchPassword = async function(enteredPassword) {
    // Compara la contraseña ingresada con la contraseña hasheada del documento
    return await bcrypt.compare(enteredPassword, this.password);
};

// Crea el modelo 'Admin' a partir del esquema AdminSchema
const Admin = mongoose.model('Admin', AdminSchema);

export default Admin; // Exporta el modelo para usarlo en otras partes de tu aplicación