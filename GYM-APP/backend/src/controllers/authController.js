import asyncHandler from 'express-async-handler';
import generateToken from '../utils/generateToken.js';
import { calculateAge } from '../utils/ageUtils.js';
import getModels from '../utils/getModels.js';
import { checkClientLimit, countActiveClients, syncActiveClientCount, isTrialOnlyUser } from '../utils/superAdminApiClient.js';
import { sendSingleNotification } from './notificationController.js';


const isValidEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
};

const applyCourtesyCredit = async (user, Settings) => {
    try {
        const settings = await Settings.findById('main_settings');
        if (settings && settings.courtesyCredit?.isActive && settings.courtesyCredit.tipoClase) {
            const creditTypeId = settings.courtesyCredit.tipoClase.toString();
            const amountToGive = settings.courtesyCredit.amount || 1;
            if (!user.creditosPorTipo || !(user.creditosPorTipo instanceof Map)) {
                user.creditosPorTipo = new Map();
            }
            user.creditosPorTipo.set(creditTypeId, amountToGive);
            return { amount: amountToGive, creditTypeId };
        }
    } catch (error) {
        console.error("Error asignando crédito de cortesía (no crítico):", error);
    }
    return null;
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
        pushToken,
        todasLasSucursales,
        sucursales
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
    const dniNorm = String(dni || '').replace(/\D/g, '') || String(dni || '').trim();

    const byEmail = await User.findOne({ email: normalizedEmail });
    const byDni = await User.findOne({
        $or: [{ dni: dniNorm }, { dni: String(dni).trim() }],
    });

    if (byEmail && byDni && byEmail._id.toString() !== byDni._id.toString()) {
        res.status(400);
        throw new Error('El email o DNI ya está en uso por otra cuenta.');
    }

    const existing = byEmail || byDni;

    // Trial guest → upgrade into a real client (same person, now counts toward the plan).
    if (existing && isTrialOnlyUser(existing)) {
        const liveCount = await countActiveClients(User);
        const hasSpace = await checkClientLimit(req.gymId, req.apiSecretKey, liveCount);
        if (!hasSpace) {
            res.status(403);
            throw new Error('La institución ha alcanzado el límite de usuarios. Por favor, contacta al administrador.');
        }

        existing.nombre = nombre;
        existing.apellido = apellido;
        existing.email = normalizedEmail;
        existing.contraseña = contraseña;
        existing.dni = dniNorm || String(dni).trim();
        existing.fechaNacimiento = new Date(fechaNacimiento);
        existing.telefonoEmergencia = telefonoEmergencia;
        existing.direccion = direccion || existing.direccion || '';
        existing.numeroTelefono = numeroTelefono || existing.numeroTelefono || '';
        existing.obraSocial = obraSocial || existing.obraSocial || '';
        existing.sexo = sexo || existing.sexo || 'Otro';
        existing.pushToken = pushToken || existing.pushToken || null;
        existing.todasLasSucursales = todasLasSucursales !== undefined ? todasLasSucursales : true;
        existing.sucursales = sucursales || existing.sucursales || [];
        existing.isTrialOnly = false;
        existing.isActive = true;
        if (!existing.roles?.includes('cliente')) {
            existing.roles = ['cliente'];
        }

        const courtesyNotificationData = await applyCourtesyCredit(existing, Settings);
        await existing.save();
        await syncActiveClientCount(User, req.gymId, req.apiSecretKey);

        if (courtesyNotificationData) {
            try {
                const tipoClase = await TipoClase.findById(courtesyNotificationData.creditTypeId);
                const nombreCredito = tipoClase ? tipoClase.nombre : 'Crédito de Bienvenida';
                await sendSingleNotification(
                    Notification,
                    User,
                    existing._id,
                    '¡Bienvenido/a! ',
                    `Te regalamos ${courtesyNotificationData.amount} crédito(s) de "${nombreCredito}" para que te anotes.`,
                    'welcome_gift',
                    true
                );
            } catch (notifError) {
                console.error('Error enviando notificación de bienvenida:', notifError);
            }
        }

        return res.status(201).json({
            _id: existing._id,
            nombre: existing.nombre,
            email: existing.email,
            paseLibreDesde: existing.paseLibreDesde,
            paseLibreHasta: existing.paseLibreHasta,
            membresiaDesde: existing.membresiaDesde,
            membresiaHasta: existing.membresiaHasta,
            fotoPerfil: existing.fotoPerfil,
            qrIngresoUrl: existing.qrIngresoUrl || null,
            token: generateToken(existing._id, req.gymId, existing.roles, existing.email, existing.nombre),
        });
    }

    if (byEmail) {
        res.status(400);
        throw new Error('Ya existe un usuario con este email.');
    }
    if (byDni) {
        res.status(400);
        throw new Error('Ya existe un usuario con este DNI.');
    }
    
    const userCount = await User.countDocuments();
    const roles = userCount === 0 ? ['admin'] : ['cliente'];

    if (roles.includes('cliente')) {
        const liveCount = await countActiveClients(User);
        const hasSpace = await checkClientLimit(req.gymId, req.apiSecretKey, liveCount);
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
        dni: dniNorm || String(dni).trim(), 
        fechaNacimiento: new Date(fechaNacimiento), 
        telefonoEmergencia, 
        direccion: direccion || '', 
        numeroTelefono: numeroTelefono || '', 
        obraSocial: obraSocial || '', 
        roles: roles,
        sexo: sexo || 'Otro' ,
        pushToken: pushToken || null,
        todasLasSucursales: todasLasSucursales !== undefined ? todasLasSucursales : true,
        sucursales: sucursales || [],
        isTrialOnly: false,
    };
    
    const user = new User(userData);

    let courtesyNotificationData = null;

    if (user.roles.includes('cliente')) {
        courtesyNotificationData = await applyCourtesyCredit(user, Settings);
    }

    await user.save();

    if (user) {
        if (user.roles.includes('cliente')) {
            await syncActiveClientCount(User, req.gymId, req.apiSecretKey);
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
                    `Te regalamos ${courtesyNotificationData.amount} crédito(s) de "${nombreCredito}" para que te anotes.`,
                    'welcome_gift',
                    true
                );
            } catch (notifError) {
                console.error("Error enviando notificación de bienvenida:", notifError);
            }
        }

        res.status(201).json({
            _id: user._id, 
            nombre: user.nombre, 
            email: user.email, 
            paseLibreDesde: user.paseLibreDesde,
            paseLibreHasta: user.paseLibreHasta,
            membresiaDesde: user.membresiaDesde,
            membresiaHasta: user.membresiaHasta,
            fotoPerfil: user.fotoPerfil,
            qrIngresoUrl: user.qrIngresoUrl || null,
            // --- CORRECCIÓN DEL BUG: Se añade req.gymId ---
            token: generateToken(user._id, req.gymId, user.roles, user.email, user.nombre) 
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

    const user = await User.findOne({ email: normalizedEmail }).select('+contraseña');


    if (user && (await user.matchPassword(contraseña))) {
        if (isTrialOnlyUser(user)) {
            res.status(403);
            throw new Error('Usaste una clase de prueba. Registrate en la app con el mismo email para crear tu cuenta.');
        }

        if (user.isActive === false) {
            res.status(403);
            throw new Error('Tu cuenta ha sido desactivada. Por favor, contacta al administrador.');
        }

        if (user.isActive === undefined) {
            user.isActive = true;
        }

        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });

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
            paseLibreDesde: user.paseLibreDesde,
            paseLibreHasta: user.paseLibreHasta,
            membresiaDesde: user.membresiaDesde,
            membresiaHasta: user.membresiaHasta,
            token: generateToken(user._id, req.gymId, user.roles, user.email, user.nombre),
            puedeGestionarEjercicios: user.puedeGestionarEjercicios || false,
            fotoPerfil: user.fotoPerfil,
            qrIngresoUrl: user.qrIngresoUrl || null,
            ordenMedicaUrl: user.ordenMedicaUrl,
            ordenMedica: user.ordenMedicaUrl,
            historialAsistencias: user.historialAsistencias || [],
        });
    } else {
        res.status(401);
        throw new Error('Email o contraseña incorrectos.');
    }
});


const refreshToken = asyncHandler(async (req, res) => {
    const { User } = getModels(req.gymDBConnection);
    
    // Obtenemos al usuario usando el ID que viene del token viejo (ya validado por el middleware protect)
    const user = await User.findById(req.user._id);

    if (user) {
        if (user.isActive === false) {
            res.status(403);
            throw new Error('Tu cuenta ha sido desactivada.');
        }

        // Generamos y enviamos un token nuevo de 90 días
        res.json({
            token: generateToken(user._id, req.gymId, user.roles, user.email, user.nombre)
        });
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
});

export { registerUser, loginUser, refreshToken };