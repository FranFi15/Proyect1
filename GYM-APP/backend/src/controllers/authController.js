import getUserModel from '../models/User.js';
import asyncHandler from 'express-async-handler';
import generateToken from '../utils/generateToken.js';
import { calculateAge } from '../utils/ageUtils.js';

// @desc    Registrar un nuevo usuario
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    // La verificación de conexión redundante ha sido eliminada.
    // Confiamos en que el middleware ya hizo su trabajo.
    const User = getUserModel(req.gymDBConnection);

    const { nombre, apellido, email, contraseña, dni, fechaNacimiento, telefonoEmergencia, direccion, numeroTelefono, obraSocial, sexo } = req.body;

    if (!nombre || !apellido || !email || !contraseña || !dni || !fechaNacimiento || !telefonoEmergencia) {
        res.status(400);
        throw new Error('Por favor, ingresa todos los campos obligatorios: nombre, apellido, email, contraseña, DNI, fecha de nacimiento y teléfono de emergencia.');
    } 

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('Ya existe un usuario con este email.');
    }
     
    const dniExists = await User.findOne({ dni });
    if (dniExists) {
        res.status(400);
        throw new Error('Ya existe un usuario con este DNI.');
    }

    const userCount = await User.countDocuments();
    let roles = ['cliente'];

    if (userCount === 0) {
        roles = ['admin'];
    }

    const userData = {
        nombre,
        apellido,
        email,
        contraseña: contraseña,
        dni,
        fechaNacimiento: new Date(fechaNacimiento),
        telefonoEmergencia,
        direccion: direccion || '', 
        numeroTelefono: numeroTelefono || '',
        obraSocial: obraSocial || '',
        roles: roles,
        sexo: sexo || 'Otro',
    };

    try { 
        const user = await User.create(userData);

        if (user) {
            res.status(201).json({
                _id: user._id,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                roles: user.roles,
                creditosPorTipo: Object.fromEntries(user.creditosPorTipo || new Map()),
                clasesInscritas: user.clasesInscritas,
                telefonoEmergencia: user.telefonoEmergencia,
                dni: user.dni,
                fechaNacimiento: user.fechaNacimiento,
                edad: calculateAge(user.fechaNacimiento),
                direccion: user.direccion, 
                numeroTelefono: user.numeroTelefono,
                obraSocial: user.obraSocial,
                sexo: user.sexo,
                token: generateToken(user._id, user.roles, user.email, user.nombre),
                gymId: req.gymId,
            });
        } else {
            res.status(400);
            throw new Error('Datos de usuario inválidos después de la creación.');
        }
    } catch (dbError) {
        if (dbError.name === 'ValidationError') {
            res.status(400);
            throw new Error(`Error de validación al crear usuario: ${dbError.message}`);
        }
        console.error("Error no manejado en registerUser:", dbError);
        res.status(500);
        throw new Error('Error interno del servidor al crear usuario en la base de datos del inquilino.');
    }
});

// @desc    Autenticar un usuario y obtener token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
    // También eliminamos la verificación redundante aquí para mantener la consistencia.
    const User = getUserModel(req.gymDBConnection);
    const { email, contraseña } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(contraseña))) {
        res.json({
            _id: user._id,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            roles: user.roles,
            creditosPorTipo: Object.fromEntries(user.creditosPorTipo || new Map()),
            clasesInscritas: user.clasesInscritas,
            telefonoEmergencia: user.telefonoEmergencia,
            dni: user.dni,
            fechaNacimiento: user.fechaNacimiento,
            edad: calculateAge(user.fechaNacimiento),
            direccion: user.direccion, 
            numeroTelefono: user.numeroTelefono,
            obraSocial: user.obraSocial,
            token: generateToken(user._id, user.roles, user.email, user.nombre, req.gymId),
            gymId: req.gymId 
        });
    } else {
        res.status(401);
        throw new Error('Email o contraseña inválidos.');
    }
});

export { registerUser, loginUser };