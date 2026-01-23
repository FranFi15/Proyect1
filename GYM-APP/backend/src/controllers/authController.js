import asyncHandler from 'express-async-handler';
import generateToken from '../utils/generateToken.js';
import { calculateAge } from '../utils/ageUtils.js';
import getModels from '../utils/getModels.js';
import { checkClientLimit, updateClientCount } from '../utils/superAdminApiClient.js';
import { sendSingleNotification } from './notificationController.js';


const isValidEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
};

const registerUser = asyncHandler(async (req, res) => {
    const { User, Settings, Notification, TipoClase } = getModels(req.gymDBConnection);
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
        sexo,
        pushToken
    } = req.body;

    if (!nombre || !apellido || !email || !contraseña || !dni || !fechaNacimiento || !telefonoEmergencia) {
        res.status(400);
        throw new Error('Por favor, ingresa todos los campos obligatorios.');
    } 

    if (typeof email !== 'string' || typeof contraseña !== 'string') {
        res.status(400);
        throw new Error('Intento de inyección detectado. Datos inválidos.');
    }

    if (!isValidEmail(email)) {
        res.status(400);
        throw new Error('El formato del email no es válido.');
    }

    const normalizedEmail = email.toLowerCase().trim();

    const userExists = await User.findOne({ email: normalizedEmail });
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
        email: normalizedEmail, 
        contraseña, 
        dni, 
        fechaNacimiento: new Date(fechaNacimiento), 
        telefonoEmergencia, 
        direccion: direccion || '', 
        numeroTelefono: numeroTelefono || '', 
        obraSocial: obraSocial || '', 
        roles: roles,
        sexo: sexo || 'Otro' ,
        pushToken: pushToken || null
    };
    
    const user = new User(userData);

    let courtesyNotificationData = null;

    if (user.roles.includes('cliente')) {
        try {
            const settings = await Settings.findById('main_settings');
            
            if (settings && settings.courtesyCredit?.isActive && settings.courtesyCredit.tipoClase) {
                
                const creditTypeId = settings.courtesyCredit.tipoClase.toString();
                const amountToGive = settings.courtesyCredit.amount || 1;

                user.creditosPorTipo.set(creditTypeId, amountToGive);
                
                courtesyNotificationData = {
                    amount: amountToGive,
                    creditTypeId: creditTypeId
                };
            }
        } catch (error) {
            console.error("Error asignando crédito de cortesía (no crítico):", error);
        }
    }

    await user.save();

    if (user) {
        if (user.roles.includes('cliente')) {
            updateClientCount(req.gymId, req.apiSecretKey, 'increment');
        }

    if (courtesyNotificationData) {
            try {
                const tipoClase = await TipoClase.findById(courtesyNotificationData.creditTypeId);
                const nombreCredito = tipoClase ? tipoClase.nombre : "Crédito de Bienvenida";

                await sendSingleNotification(
                    Notification,
                    User,
                    user._id,
                    "¡Bienvenido/a! ",
                    `Te regalamos ${courtesyNotificationData.amount} crédito(s) de "${nombreCredito}" para que comiences a entrenar.`,
                    'welcome_gift'
                );
            } catch (notifError) {
                console.error("Error enviando notificación de bienvenida:", notifError);
            }
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

   if (typeof email !== 'string' || typeof contraseña !== 'string') {
        res.status(400);
        throw new Error('Datos inválidos. Se esperaban cadenas de texto.');
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });

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
            token: generateToken(user._id, req.gymId, user.roles, user.email, user.nombre),
            puedeGestionarEjercicios: user.puedeGestionarEjercicios || false
        });
    } else {
        res.status(401);
        throw new Error('Email o contraseña incorrectos.');
    }
});

export { registerUser, loginUser };
