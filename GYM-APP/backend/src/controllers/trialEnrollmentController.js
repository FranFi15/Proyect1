import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';
import { checkClientLimit, countActiveClients, syncActiveClientCount } from '../utils/superAdminApiClient.js';

const normalizeEmail = (email) => String(email || '').toLowerCase().trim();
const normalizeDni = (dni) => String(dni || '').replace(/\D/g, '');

const loadGym = async (clientId) => {
    if (!clientId) {
        const err = new Error('Falta el identificador del gimnasio.');
        err.statusCode = 400;
        throw err;
    }
    const { connection, apiSecretKey, timezone, gymName, logoUrl, primaryColor } = await connectToGymDB(clientId);
    return {
        connection,
        apiSecretKey,
        timezone: timezone || 'America/Argentina/Buenos_Aires',
        clientId,
        gym: {
            name: gymName || 'Gimnasio',
            logoUrl: logoUrl || '',
            primaryColor: primaryColor || '#150224',
        },
    };
};

const assertTrialAccess = (settings, token) => {
    if (!settings?.trialEnrollmentEnabled) {
        const err = new Error('La inscripción a clase de prueba no está habilitada.');
        err.statusCode = 403;
        throw err;
    }
    if (!settings.trialAccessToken || String(token || '') !== String(settings.trialAccessToken)) {
        const err = new Error('Link de prueba inválido o vencido.');
        err.statusCode = 403;
        throw err;
    }
};

const mapClassForClient = (cls) => {
    const enrolled = (cls.usuariosInscritos || []).length;
    const capacity = cls.capacidad || 0;
    return {
        _id: cls._id,
        nombre: cls.nombre || cls.tipoClase?.nombre || 'Turno',
        fecha: cls.fecha,
        horaInicio: cls.horaInicio,
        horaFin: cls.horaFin,
        capacidad: capacity,
        estado: cls.estado || 'activa',
        usuariosInscritos: Array.from({ length: enrolled }, (_, i) => `slot-${i}`),
        tipoClase: cls.tipoClase ? { _id: cls.tipoClase._id, nombre: cls.tipoClase.nombre } : null,
        sucursal: cls.sucursal ? { _id: cls.sucursal._id, nombre: cls.sucursal.nombre } : null,
        profesores: (cls.profesores || []).map((p) => ({
            _id: p._id,
            nombre: p.nombre,
            apellido: p.apellido,
            ratingAverage: p.ratingAverage,
        })),
        cupos: Math.max(0, capacity - enrolled),
    };
};

const getTrialPage = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const token = req.query.t || req.query.token;
    const { connection, timezone, gym } = await loadGym(clientId);
    const { Settings, Clase } = getModels(connection);

    const settings = await Settings.findById('main_settings');
    assertTrialAccess(settings, token);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 21);

    const classes = await Clase.find({
        estado: { $in: ['activa', 'llena'] },
        fecha: { $gte: today, $lte: horizon },
    })
        .populate('tipoClase', 'nombre')
        .populate('sucursal', 'nombre')
        .populate('profesores', 'nombre apellido ratingAverage')
        .sort({ fecha: 1, horaInicio: 1 })
        .lean();

    const available = classes
        .filter((cls) => cls.estado !== 'cancelada')
        .map(mapClassForClient);

    res.json({
        enabled: true,
        timezone,
        gymId: clientId,
        gym,
        classes: available,
    });
});

const enrollTrial = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const {
        token,
        nombre,
        apellido,
        dni,
        email,
        numeroTelefono,
        classId,
    } = req.body || {};

    if (!nombre?.trim() || !apellido?.trim() || !dni || !email || !numeroTelefono?.trim() || !classId) {
        res.status(400);
        throw new Error('Completá nombre, apellido, DNI, teléfono, email y el turno.');
    }

    const emailNorm = normalizeEmail(email);
    const dniNorm = normalizeDni(dni);
    if (!emailNorm || !dniNorm) {
        res.status(400);
        throw new Error('Email o DNI inválidos.');
    }

    const { connection, apiSecretKey, clientId: gymId } = await loadGym(clientId);
    const { Settings, Clase, User } = getModels(connection);

    const settings = await Settings.findById('main_settings');
    assertTrialAccess(settings, token || req.query.t);

    const classItem = await Clase.findById(classId).populate('tipoClase', 'nombre');
    if (!classItem || classItem.estado === 'cancelada') {
        res.status(404);
        throw new Error('El turno no está disponible.');
    }
    if ((classItem.usuariosInscritos || []).length >= classItem.capacidad) {
        res.status(400);
        throw new Error('Ese turno ya está completo.');
    }

    const existingByEmail = await User.findOne({ email: emailNorm });
    const existingByDni = await User.findOne({
        $or: [{ dni: dniNorm }, { dni: String(dni).trim() }],
    });
    const existing = existingByEmail || existingByDni;

    if (existing) {
        if (existing.trialEnrollmentUsedAt || (existingByEmail?.trialEnrollmentUsedAt) || (existingByDni?.trialEnrollmentUsedAt)) {
            res.status(400);
            throw new Error('Ya usaste tu clase de prueba con estos datos.');
        }
        res.status(400);
        throw new Error('Este email o DNI ya está registrado. Ingresá desde la app para anotarte.');
    }

    const liveCount = await countActiveClients(User);
    const hasSpace = await checkClientLimit(gymId, apiSecretKey, liveCount);
    if (!hasSpace) {
        res.status(403);
        throw new Error('El gimnasio alcanzó el límite de usuarios. Contactá al administrador.');
    }

    const randomPassword = crypto.randomBytes(24).toString('hex');
    const phone = String(numeroTelefono).trim();

    const user = await User.create({
        nombre: String(nombre).trim(),
        apellido: String(apellido).trim(),
        email: emailNorm,
        dni: dniNorm,
        contraseña: randomPassword,
        numeroTelefono: phone,
        telefonoEmergencia: phone,
        fechaNacimiento: new Date('2000-01-01T12:00:00.000Z'),
        roles: ['cliente'],
        isActive: true,
        trialEnrollmentUsedAt: new Date(),
        todasLasSucursales: true,
        sucursales: [],
    });

    classItem.usuariosInscritos.push(user._id);
    if (!classItem.inscripcionesDetalle) classItem.inscripcionesDetalle = [];
    classItem.inscripcionesDetalle.push({
        user: user._id,
        tipoCreditoUsado: undefined,
        fechaInscripcion: new Date(),
    });
    if (classItem.usuariosInscritos.length >= classItem.capacidad) {
        classItem.estado = 'llena';
    }
    user.clasesInscritas = user.clasesInscritas || [];
    user.clasesInscritas.push(classItem._id);

    await classItem.save();
    await user.save();
    await syncActiveClientCount(User, gymId, apiSecretKey);

    res.status(201).json({
        message: `¡Listo! Quedaste anotado/a a ${classItem.nombre || classItem.tipoClase?.nombre || 'la clase'} el ${String(classItem.fecha).slice(0, 10)} a las ${classItem.horaInicio}hs.`,
        className: classItem.nombre || classItem.tipoClase?.nombre || 'Turno',
        fecha: classItem.fecha,
        horaInicio: classItem.horaInicio,
    });
});

export { getTrialPage, enrollTrial };
