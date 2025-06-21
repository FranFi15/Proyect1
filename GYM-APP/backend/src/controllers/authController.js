// src/controllers/authController.js
import getUserModel from '../models/User.js';
import asyncHandler from 'express-async-handler';
import generateToken from '../utils/generateToken.js';
import { calculateAge } from '../utils/ageUtils.js';

// @desc    Registrar un nuevo usuario
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    // Asegúrate de que req.gymDBConnection es un objeto de conexión válido antes de pasarlo
    if (!req.gymDBConnection || req.gymDBConnection.readyState !== 1) { // readyState 1 significa 'connected'
        res.status(500);
        throw new Error('No se pudo establecer conexión con la base de datos del inquilino.');
    }
    const User = getUserModel(req.gymDBConnection)

    const { nombre, apellido, email, contraseña, dni, fechaNacimiento, telefonoEmergencia, direccion, numeroTelefono, obraSocial, sexo } = req.body;

    // Ajusta la validación según si los nuevos campos son obligatorios o no
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

    // Lógica para asignar el primer usuario como ADMIN
    const userCount = await User.countDocuments();
    let roles = ['cliente']; // Rol por defecto para nuevos usuarios

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
        res.status(500);
        throw new Error('Error interno del servidor al crear usuario en la base de datos del inquilino.');
    }
});

// @desc    Autenticar un usuario y obtener token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {

    if (!req.gymDBConnection || req.gymDBConnection.readyState !== 1) {
        res.status(500);
        throw new Error('No se pudo establecer conexión con la base de datos del inquilino para login.');
    }
    const User = getUserModel(req.gymDBConnection);
    const { email, contraseña } = req.body; // <-- Aquí es donde falla si req.body está vacío
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
            token: generateToken(user._id, user.roles, user.email, user.nombre),
        });
    } else {
        res.status(401);
        throw new Error('Email o contraseña inválidos.');
    }
});
export { registerUser, loginUser };
