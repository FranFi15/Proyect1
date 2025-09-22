import asyncHandler from 'express-async-handler';
import generateToken from '../utils/generateToken.js';
import { calculateAge } from '../utils/ageUtils.js';
import getModels from '../utils/getModels.js';
import { checkClientLimit, updateClientCount } from '../utils/superAdminApiClient.js';

const registerUser = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const { 
        nombre, 
        apellido, 
        email, 
        contraseña, 
        dni, 
        fechaNacimiento, 
        telefonoEmergencia, 
        direccion, 
        numeroTelefono, 
        obraSocial, 
        sexo 
    } = req.body;

    if (!nombre || !apellido || !email || !contraseña || !dni || !fechaNacimiento || !telefonoEmergencia) {
        res.status(400);
        throw new Error('Por favor, ingresa todos los campos obligatorios.');
    } 

    const userExists = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') }});
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
    const roles = userCount === 0 ? ['admin'] : ['cliente'];

    // --- VERIFICACIÓN DE LÍMITE ---
    if (roles.includes('cliente')) {
        const hasSpace = await checkClientLimit(req.gymId, req.apiSecretKey);
        if (!hasSpace) {
            res.status(403); 
            throw new Error('La institución ha alcanzado el límite de usuarios. Por favor, contacta al administrador.');
        }
    }
    
    const userData = { 
        nombre, 
        apellido, 
        email, 
        contraseña, 
        dni, 
        fechaNacimiento: new Date(fechaNacimiento), 
        telefonoEmergencia, 
        direccion: direccion || '', 
        numeroTelefono: numeroTelefono || '', 
        obraSocial: obraSocial || '', 
        roles: roles,
        sexo: sexo || 'Otro' 
    };
    
    const user = await User.create(userData);

    if (user) {
        if (user.roles.includes('cliente')) {
            updateClientCount(req.gymId, req.apiSecretKey, 'increment');
        }

        res.status(201).json({
            _id: user._id, 
            nombre: user.nombre, 
            email: user.email, 
            token: generateToken(user._id, user.roles, user.email, user.nombre) 
        });
    } else {
        res.status(400);
        throw new Error('Datos de usuario inválidos.');
    }
});


const loginUser = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    const { email, contraseña } = req.body;
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

    if (user && (await user.matchPassword(contraseña))) {
         if (!user.isActive) {
            res.status(403);
            throw new Error('Tu cuenta ha sido desactivada. Por favor, contacta al administrador.');
        }
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
            edad: user.fechaNacimiento ? calculateAge(user.fechaNacimiento) : 0,
            direccion: user.direccion, 
            numeroTelefono: user.numeroTelefono,
            obraSocial: user.obraSocial,
            token: generateToken(user._id),
            gymId: req.gymId 
        });
    } else {
        res.status(401);
        throw new Error('Email o contraseña incorrectos.');
    }
});

export { registerUser, loginUser };
