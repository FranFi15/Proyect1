// admin-panel-backend/controllers/adminController.js
import asyncHandler from 'express-async-handler'; // Para manejar errores asíncronos de forma limpia
import Admin from '../models/Admin.js'; // Asegúrate de que esta ruta sea correcta para tu modelo Admin
import generateToken from '../utils/generateToken.js'; // Necesitas esta utilidad para crear el JWT

// @desc    Autenticar administrador y obtener token
// @route   POST /api/admin/login
// @access  Public
const authAdmin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // 1. Encontrar al administrador por email
    const admin = await Admin.findOne({ email });

    // 2. Verificar si el administrador existe y si la contraseña es correcta
    if (admin && (await admin.matchPassword(password))) {
        // 3. Si las credenciales son válidas, devolver la información del administrador y un token
        res.json({
            _id: admin._id,
            email: admin.email,
            role: admin.role,
            token: generateToken(admin._id) // Genera un JWT para la sesión
        });
    } else {
        // 4. Si las credenciales son inválidas, responder con un error 401
        res.status(401); // Unauthorized
        throw new Error('Email o contraseña inválidos');
    }
});
// @desc    Crear un nuevo administrador (TEMPORAL)
// @route   POST /api/admin/create-temp-admin
// @access  Public (¡CUIDADO! Solo para desarrollo)
const createAdmin = asyncHandler(async (req, res) => {
    const { email, password, role } = req.body;

    // Puedes establecer el rol a 'superadmin' por defecto o forzarlo
    const adminRole = role || 'superadmin';

    // Verificar si ya existe un administrador con ese email
    const adminExists = await Admin.findOne({ email });

    if (adminExists) {
        res.status(400); // Bad Request
        throw new Error('Ya existe un administrador con este email.');
    }

    // Crear el nuevo administrador. El middleware 'pre("save")' en el modelo se encargará de hashear la contraseña.
    const admin = await Admin.create({
        email,
        password, // La contraseña se hashea automáticamente por el middleware del modelo
        role: adminRole
    });

    if (admin) {
        res.status(201).json({ // 201 Created
            _id: admin._id,
            email: admin.email,
            role: admin.role,
            message: 'Administrador creado exitosamente (¡RECUERDA ELIMINAR ESTA RUTA!).'
        });
    } else {
        res.status(400); // Bad Request
        throw new Error('Datos de administrador inválidos.');
    }
});

const resetOrCreateAdmin = asyncHandler(async (req, res) => {
    const { email, password, secretKey } = req.body;

    // 1. Comparamos la clave secreta del body con la de nuestro archivo .env
    if (secretKey !== process.env.INTERNAL_ADMIN_API_KEY) {
        res.status(401);
        throw new Error('No autorizado para realizar esta acción.');
    }

    if (!email || !password) {
        res.status(400);
        throw new Error('Por favor, proporcione un email y una contraseña.');
    }

    // 2. Buscamos si el administrador ya existe
    const admin = await Admin.findOne({ email });

    if (admin) {
        // Si existe, actualizamos su contraseña.
        // El middleware 'pre-save' en el modelo se encargará de hashearla.
        admin.password = password;
        await admin.save();
        res.status(200).json({
            message: `La contraseña para el administrador ${email} ha sido actualizada.`,
            _id: admin._id,
            email: admin.email,
        });
    } else {
        // Si no existe, creamos un nuevo superadmin.
        const newAdmin = await Admin.create({
            email,
            password,
            role: 'superadmin'
        });
        res.status(201).json({
            message: `El administrador ${email} ha sido creado exitosamente.`,
            _id: newAdmin._id,
            email: newAdmin.email,
        });
    }
});

export { authAdmin, createAdmin, resetOrCreateAdmin}; // Exporta la función para usarla en tus rutas