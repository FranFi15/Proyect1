import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';
import { sendTrialVerificationEmail } from '../services/emailService.js';
import { getTurnstilePublicConfig, verifyTurnstileToken } from '../utils/turnstile.js';
import { isTrialOnlyUser } from '../utils/superAdminApiClient.js';

const capitalize = (value) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

const formatTrialClassDate = (fecha) => {
    if (!fecha) return '';
    let date;
    if (fecha instanceof Date) {
        date = fecha;
    } else if (typeof fecha === 'string') {
        // Prefer noon UTC for date-only strings to avoid timezone day shifts.
        const raw = fecha.length <= 10 ? `${fecha}T12:00:00.000Z` : fecha;
        date = parseISO(raw);
        if (!isValid(date)) date = new Date(fecha);
    } else {
        date = new Date(fecha);
    }
    if (!isValid(date)) return String(fecha).slice(0, 10);
    return capitalize(format(date, "EEEE d 'de' MMMM", { locale: es }));
};

const CODE_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

const normalizeEmail = (email) => String(email || '').toLowerCase().trim();
/** Digits only, strip leading zeros so 0123 and 123 are the same identity. */
const normalizeDni = (dni) => String(dni || '').replace(/\D/g, '').replace(/^0+/, '');
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const makeCode = () => String(crypto.randomInt(100000, 999999));
const makeSessionToken = () => crypto.randomBytes(32).toString('hex');

const assertValidDni = (rawDni, dniNorm) => {
    const digitsOnly = String(rawDni || '').replace(/\D/g, '');
    if (!digitsOnly) {
        const err = new Error('Ingresá un DNI válido.');
        err.statusCode = 400;
        throw err;
    }
    if (/^0/.test(digitsOnly)) {
        const err = new Error('El DNI no puede empezar con 0.');
        err.statusCode = 400;
        throw err;
    }
    if (!dniNorm) {
        const err = new Error('Ingresá un DNI válido.');
        err.statusCode = 400;
        throw err;
    }
};

const findUserByNormalizedDni = async (User, dniNorm) => {
    if (!dniNorm) return null;
    return User.findOne({
        dni: { $regex: new RegExp(`^0*${escapeRegex(dniNorm)}$`) },
    });
};

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

const countTrialSeatsUsed = (cls) => {
    const enrolled = cls.usuariosInscritos || [];
    return enrolled.filter((u) => {
        if (!u || typeof u !== 'object') return false;
        return isTrialOnlyUser(u);
    }).length;
};

const mapClassForClient = (cls, maxTrialSeats = 0) => {
    const enrolled = (cls.usuariosInscritos || []).length;
    const capacity = cls.capacidad || 0;
    const trialUsed = countTrialSeatsUsed(cls);
    const trialCupos = maxTrialSeats > 0 ? Math.max(0, maxTrialSeats - trialUsed) : null;
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
        permiteUsuariosPrueba: true,
        trialCupos,
        maxUsuariosPruebaPorClase: maxTrialSeats || 0,
    };
};

const assertNotAlreadyRegistered = async (User, emailNorm, dniNorm) => {
    const existingByEmail = await User.findOne({ email: emailNorm });
    const existingByDni = await findUserByNormalizedDni(User, dniNorm);
    const existing = existingByEmail || existingByDni;
    if (!existing) return null;

    const usedTrial =
        isTrialOnlyUser(existing) ||
        isTrialOnlyUser(existingByEmail) ||
        isTrialOnlyUser(existingByDni);

    if (usedTrial) {
        const err = new Error(
            'Ya usaste tu clase de prueba con estos datos. Si querés cambiar de turno, usá “Cambiar mi turno”.'
        );
        err.statusCode = 400;
        err.code = 'TRIAL_ALREADY_USED';
        throw err;
    }
    const err = new Error('Este email o DNI ya está registrado. Ingresá desde la app para anotarte.');
    err.statusCode = 400;
    throw err;
};

const sendCodeEmail = async ({ email, code, gymName }) => {
    const html = `
        <h1>Verificá tu email</h1>
        <p>Para continuar con tu clase de prueba en <strong>${gymName || 'el gimnasio'}</strong>, ingresá este código:</p>
        <p style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #1a5276;">${code}</p>
        <p>El código vence en 15 minutos.</p>
        <p style="font-size: 12px; color: #666;">Si no solicitaste una clase de prueba, ignorá este mensaje.</p>
    `;
    await sendTrialVerificationEmail({
        to: email,
        subject: `Código de verificación — ${gymName || 'Clase de prueba'}`,
        html,
    });
};

const createOrRefreshPending = async ({ TrialPending, payload, gymName }) => {
    const code = makeCode();
    const now = Date.now();

    await TrialPending.deleteMany({
        email: payload.email,
        consumedAt: null,
    });

    const pending = await TrialPending.create({
        ...payload,
        purpose: payload.purpose || 'enroll',
        userId: payload.userId || null,
        codeHash: hashValue(code),
        codeExpiresAt: new Date(now + CODE_TTL_MS),
        verifiedAt: null,
        sessionTokenHash: null,
        sessionExpiresAt: null,
        consumedAt: null,
    });

    await sendCodeEmail({ email: payload.email, code, gymName });
    return pending;
};

const removeUserFromClass = async (Clase, User, userId, classId) => {
    const classItem = await Clase.findById(classId);
    if (!classItem) return;
    classItem.usuariosInscritos = (classItem.usuariosInscritos || []).filter(
        (id) => String(id) !== String(userId)
    );
    classItem.inscripcionesDetalle = (classItem.inscripcionesDetalle || []).filter(
        (row) => String(row.user) !== String(userId)
    );
    if (classItem.estado === 'llena' && classItem.usuariosInscritos.length < classItem.capacidad) {
        classItem.estado = 'activa';
    }
    await classItem.save();
    await User.updateOne(
        { _id: userId },
        { $pull: { clasesInscritas: classItem._id } }
    );
};

/** Public branding only — classes require a verified session. */
const getTrialPage = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const token = req.query.t || req.query.token;
    const { connection, timezone, gym } = await loadGym(clientId);
    const { Settings } = getModels(connection);
    const settings = await Settings.findById('main_settings');
    assertTrialAccess(settings, token);

    res.json({
        enabled: true,
        timezone,
        gymId: clientId,
        gym,
        requiresEmailVerification: true,
        captcha: getTurnstilePublicConfig(),
    });
});

/** Silent reject for bots that fill hidden fields. */
const isHoneypotTripped = (body = {}) => {
    const bait = body.website ?? body.company ?? body.fax;
    return typeof bait === 'string' && bait.trim().length > 0;
};

const assertCaptchaOrThrow = async (req, captchaToken) => {
    const result = await verifyTurnstileToken(captchaToken, req.ip);
    if (!result.ok) {
        const err = new Error(result.error || 'Verificación anti-bot fallida.');
        err.statusCode = 400;
        throw err;
    }
};

const startTrial = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const {
        token,
        nombre,
        apellido,
        dni,
        email,
        numeroTelefono,
        captchaToken,
    } = req.body || {};

    // Honeypot: pretend success so scrapers don't learn the real flow.
    if (isHoneypotTripped(req.body)) {
        return res.status(200).json({
            message: 'Te enviamos un código a tu email. Ingresalo para ver los turnos.',
            email: normalizeEmail(email) || 'ok',
        });
    }

    if (!nombre?.trim() || !apellido?.trim() || !dni || !email || !numeroTelefono?.trim()) {
        res.status(400);
        throw new Error('Completá nombre, apellido, DNI, teléfono y email.');
    }

    const emailNorm = normalizeEmail(email);
    const dniNorm = normalizeDni(dni);
    if (!emailNorm) {
        res.status(400);
        throw new Error('Email inválido.');
    }
    assertValidDni(dni, dniNorm);

    const { connection, gym } = await loadGym(clientId);
    const { Settings, User, TrialPending } = getModels(connection);
    const settings = await Settings.findById('main_settings');
    assertTrialAccess(settings, token || req.query.t);

    await assertCaptchaOrThrow(req, captchaToken);
    await assertNotAlreadyRegistered(User, emailNorm, dniNorm);

    try {
        await createOrRefreshPending({
            TrialPending,
            gymName: gym.name,
            payload: {
                nombre: String(nombre).trim(),
                apellido: String(apellido).trim(),
                dni: dniNorm,
                email: emailNorm,
                numeroTelefono: String(numeroTelefono).trim(),
                purpose: 'enroll',
            },
        });
    } catch (err) {
        res.status(503);
        throw new Error(err.message || 'No se pudo enviar el email de verificación.');
    }

    res.status(200).json({
        message: `Te enviamos un código a ${emailNorm}. Ingresalo para ver los turnos.`,
        email: emailNorm,
        purpose: 'enroll',
    });
});

/** Start a class-change flow for someone who already used their trial. */
const startTrialChange = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { token, email, captchaToken } = req.body || {};

    if (isHoneypotTripped(req.body)) {
        return res.status(200).json({
            message: 'Te enviamos un código a tu email.',
            email: normalizeEmail(email) || 'ok',
            purpose: 'change',
        });
    }

    const emailNorm = normalizeEmail(email);
    if (!emailNorm) {
        res.status(400);
        throw new Error('Ingresá el email con el que te anotaste.');
    }

    const { connection, gym } = await loadGym(clientId);
    const { Settings, User, TrialPending } = getModels(connection);
    const settings = await Settings.findById('main_settings');
    assertTrialAccess(settings, token || req.query.t);
    await assertCaptchaOrThrow(req, captchaToken);

    const user = await User.findOne({ email: emailNorm });
    if (!user || !isTrialOnlyUser(user)) {
        res.status(404);
        throw new Error('No encontramos una clase de prueba con ese email.');
    }

    try {
        await createOrRefreshPending({
            TrialPending,
            gymName: gym.name,
            payload: {
                nombre: user.nombre || 'Usuario',
                apellido: user.apellido || '',
                dni: normalizeDni(user.dni) || String(user.dni || '').replace(/\D/g, '') || '0',
                email: emailNorm,
                numeroTelefono: user.numeroTelefono || user.telefonoEmergencia || '-',
                purpose: 'change',
                userId: user._id,
            },
        });
    } catch (err) {
        res.status(503);
        throw new Error(err.message || 'No se pudo enviar el email de verificación.');
    }

    res.status(200).json({
        message: `Te enviamos un código a ${emailNorm}. Ingresalo para cambiar tu turno.`,
        email: emailNorm,
        purpose: 'change',
        nombre: user.nombre,
    });
});

const verifyTrialEmail = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { token, email, code } = req.body || {};
    const emailNorm = normalizeEmail(email);
    const codeNorm = String(code || '').replace(/\D/g, '');

    if (!emailNorm || codeNorm.length !== 6) {
        res.status(400);
        throw new Error('Ingresá el email y el código de 6 dígitos.');
    }

    const { connection } = await loadGym(clientId);
    const { Settings, TrialPending } = getModels(connection);
    const settings = await Settings.findById('main_settings');
    assertTrialAccess(settings, token || req.query.t);

    const pending = await TrialPending.findOne({
        email: emailNorm,
        consumedAt: null,
    }).sort({ createdAt: -1 });

    if (!pending) {
        res.status(400);
        throw new Error('No hay una solicitud pendiente. Completá tus datos otra vez.');
    }
    if (!pending.codeExpiresAt || pending.codeExpiresAt.getTime() < Date.now()) {
        res.status(400);
        throw new Error('El código venció. Pedí uno nuevo.');
    }
    if (pending.codeHash !== hashValue(codeNorm)) {
        res.status(400);
        throw new Error('Código incorrecto.');
    }

    const sessionToken = makeSessionToken();
    pending.verifiedAt = new Date();
    pending.sessionTokenHash = hashValue(sessionToken);
    pending.sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
    pending.codeHash = hashValue(crypto.randomBytes(8).toString('hex')); // invalidate code
    await pending.save();

    res.json({
        message: pending.purpose === 'change'
            ? 'Email verificado. Elegí el nuevo turno.'
            : 'Email verificado. Ya podés elegir tu clase de prueba.',
        sessionToken,
        email: emailNorm,
        nombre: pending.nombre,
        apellido: pending.apellido,
        purpose: pending.purpose || 'enroll',
    });
});

const resendTrialCode = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { token, email, captchaToken } = req.body || {};

    if (isHoneypotTripped(req.body)) {
        return res.json({ message: 'Te reenviamos el código.' });
    }

    const emailNorm = normalizeEmail(email);
    if (!emailNorm) {
        res.status(400);
        throw new Error('Falta el email.');
    }

    const { connection, gym } = await loadGym(clientId);
    const { Settings, TrialPending } = getModels(connection);
    const settings = await Settings.findById('main_settings');
    assertTrialAccess(settings, token || req.query.t);
    await assertCaptchaOrThrow(req, captchaToken);

    const pending = await TrialPending.findOne({
        email: emailNorm,
        consumedAt: null,
        verifiedAt: null,
    }).sort({ createdAt: -1 });

    if (!pending) {
        res.status(400);
        throw new Error('No hay una solicitud pendiente para reenviar el código.');
    }
    // Allow resend for both enroll and change purposes.

    const code = makeCode();
    pending.codeHash = hashValue(code);
    pending.codeExpiresAt = new Date(Date.now() + CODE_TTL_MS);
    await pending.save();

    try {
        await sendCodeEmail({ email: emailNorm, code, gymName: gym.name });
    } catch (err) {
        res.status(503);
        throw new Error(err.message || 'No se pudo reenviar el email.');
    }

    res.json({ message: `Te reenviamos el código a ${emailNorm}.` });
});

const loadVerifiedPending = async (TrialPending, sessionToken) => {
    if (!sessionToken) {
        const err = new Error('Verificá tu email para continuar.');
        err.statusCode = 403;
        throw err;
    }
    const pending = await TrialPending.findOne({
        sessionTokenHash: hashValue(sessionToken),
        consumedAt: null,
    }).sort({ createdAt: -1 });

    if (!pending?.verifiedAt) {
        const err = new Error('Sesión inválida. Verificá tu email otra vez.');
        err.statusCode = 403;
        throw err;
    }
    if (!pending.sessionExpiresAt || pending.sessionExpiresAt.getTime() < Date.now()) {
        const err = new Error('La sesión venció. Verificá tu email otra vez.');
        err.statusCode = 403;
        throw err;
    }
    return pending;
};

const getTrialClasses = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const token = req.query.t || req.query.token;
    const sessionToken = req.query.session || req.headers['x-trial-session'];

    const { connection, timezone, gym } = await loadGym(clientId);
    const { Settings, Clase, TrialPending } = getModels(connection);
    const settings = await Settings.findById('main_settings');
    assertTrialAccess(settings, token);
    await loadVerifiedPending(TrialPending, sessionToken);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 21);

    const maxTrialSeats = Number(settings?.maxUsuariosPruebaPorClase) || 0;

    const classes = await Clase.find({
        estado: { $in: ['activa', 'llena'] },
        fecha: { $gte: today, $lte: horizon },
        // Missing/undefined = allowed (legacy open trial); only explicit false is blocked.
        permiteUsuariosPrueba: { $ne: false },
    })
        .populate('tipoClase', 'nombre')
        .populate('sucursal', 'nombre')
        .populate('profesores', 'nombre apellido ratingAverage')
        .populate('usuariosInscritos', 'isTrialOnly trialEnrollmentUsedAt')
        .sort({ fecha: 1, horaInicio: 1 })
        .lean();

    const available = classes
        .filter((cls) => cls.estado !== 'cancelada')
        .filter((cls) => {
            if (maxTrialSeats <= 0) return true;
            return countTrialSeatsUsed(cls) < maxTrialSeats;
        })
        .map((cls) => mapClassForClient(cls, maxTrialSeats));

    res.json({
        enabled: true,
        timezone,
        gymId: clientId,
        gym,
        maxUsuariosPruebaPorClase: maxTrialSeats,
        classes: available,
    });
});

const assertClassAcceptsTrial = (classItem, settings, excludingUserId = null) => {
    if (!classItem || classItem.estado === 'cancelada') {
        const err = new Error('El turno no está disponible.');
        err.statusCode = 404;
        throw err;
    }
    if (classItem.permiteUsuariosPrueba === false) {
        const err = new Error('Este turno no admite usuarios de prueba.');
        err.statusCode = 400;
        throw err;
    }

    const enrolledIds = (classItem.usuariosInscritos || []).map((u) => (u?._id ? u._id : u));
    const othersCount = excludingUserId
        ? enrolledIds.filter((id) => String(id) !== String(excludingUserId)).length
        : enrolledIds.length;
    if (othersCount >= classItem.capacidad) {
        const err = new Error('Ese turno ya está completo.');
        err.statusCode = 400;
        throw err;
    }

    const maxTrialSeats = Number(settings?.maxUsuariosPruebaPorClase) || 0;
    if (maxTrialSeats > 0) {
        const trialUsed = countTrialSeatsUsed(classItem);
        const selfIsTrialSeat = excludingUserId
            && (classItem.usuariosInscritos || []).some((u) => {
                const id = u?._id || u;
                return String(id) === String(excludingUserId) && isTrialOnlyUser(u);
            });
        const effectiveUsed = selfIsTrialSeat ? Math.max(0, trialUsed - 1) : trialUsed;
        if (effectiveUsed >= maxTrialSeats) {
            const err = new Error(
                maxTrialSeats === 1
                    ? 'Este turno ya tiene el cupo de prueba ocupado.'
                    : `Este turno ya alcanzó el máximo de ${maxTrialSeats} usuarios de prueba.`
            );
            err.statusCode = 400;
            throw err;
        }
    }
};

const enrollTrial = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { token, sessionToken, classId } = req.body || {};

    if (!classId) {
        res.status(400);
        throw new Error('Elegí un turno.');
    }

    const { connection } = await loadGym(clientId);
    const { Settings, Clase, User, TrialPending } = getModels(connection);

    const settings = await Settings.findById('main_settings');
    assertTrialAccess(settings, token || req.query.t);

    const pending = await loadVerifiedPending(TrialPending, sessionToken);
    const emailNorm = normalizeEmail(pending.email);
    const dniNorm = normalizeDni(pending.dni);
    const isChange = pending.purpose === 'change';

    const classItem = await Clase.findById(classId)
        .populate('tipoClase', 'nombre')
        .populate('usuariosInscritos', 'isTrialOnly trialEnrollmentUsedAt');

    if (isChange) {
        const user = pending.userId
            ? await User.findById(pending.userId)
            : await User.findOne({ email: emailNorm });

        if (!user || !isTrialOnlyUser(user)) {
            res.status(400);
            throw new Error('No encontramos tu inscripción de prueba para cambiar.');
        }

        assertClassAcceptsTrial(classItem, settings, user._id);

        const alreadyOnClass = (user.clasesInscritas || []).some(
            (id) => String(id) === String(classItem._id)
        );
        if (alreadyOnClass) {
            res.status(400);
            throw new Error('Ya estás anotado/a en ese turno.');
        }

        const previousClassIds = [...(user.clasesInscritas || [])];
        for (const prevId of previousClassIds) {
            await removeUserFromClass(Clase, User, user._id, prevId);
        }

        // Reload class after possible mutations if it was in previous set (unlikely same id).
        const freshClass = await Clase.findById(classId)
            .populate('tipoClase', 'nombre')
            .populate('usuariosInscritos', 'isTrialOnly trialEnrollmentUsedAt');
        assertClassAcceptsTrial(freshClass, settings, user._id);

        freshClass.usuariosInscritos.push(user._id);
        if (!freshClass.inscripcionesDetalle) freshClass.inscripcionesDetalle = [];
        freshClass.inscripcionesDetalle.push({
            user: user._id,
            tipoCreditoUsado: undefined,
            fechaInscripcion: new Date(),
        });
        if (freshClass.usuariosInscritos.length >= freshClass.capacidad) {
            freshClass.estado = 'llena';
        }
        user.clasesInscritas = [freshClass._id];

        pending.consumedAt = new Date();
        pending.sessionTokenHash = null;

        await freshClass.save();
        await user.save();
        await pending.save();

        const classLabel = freshClass.nombre || freshClass.tipoClase?.nombre || 'la clase';
        const fechaLabel = formatTrialClassDate(freshClass.fecha);
        return res.status(200).json({
            message: `¡Listo! Cambiaste tu turno a ${classLabel} el ${fechaLabel} a las ${freshClass.horaInicio}hs.`,
            className: freshClass.nombre || freshClass.tipoClase?.nombre || 'Turno',
            fecha: freshClass.fecha,
            horaInicio: freshClass.horaInicio,
            purpose: 'change',
        });
    }

    await assertNotAlreadyRegistered(User, emailNorm, dniNorm);
    assertClassAcceptsTrial(classItem, settings);

    const randomPassword = crypto.randomBytes(24).toString('hex');
    const phone = String(pending.numeroTelefono).trim();

    // Trial guests stay in the roster for that class, but do not count as plan clients.
    const user = await User.create({
        nombre: String(pending.nombre).trim(),
        apellido: String(pending.apellido).trim(),
        email: emailNorm,
        dni: dniNorm,
        contraseña: randomPassword,
        numeroTelefono: phone,
        telefonoEmergencia: phone,
        fechaNacimiento: new Date('2000-01-01T12:00:00.000Z'),
        roles: ['cliente'],
        isActive: true,
        isTrialOnly: true,
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

    pending.consumedAt = new Date();
    pending.sessionTokenHash = null;

    await classItem.save();
    await user.save();
    await pending.save();

    const classLabel = classItem.nombre || classItem.tipoClase?.nombre || 'la clase';
    const fechaLabel = formatTrialClassDate(classItem.fecha);
    res.status(201).json({
        message: `¡Listo! Quedaste anotado/a a ${classLabel} el ${fechaLabel} a las ${classItem.horaInicio}hs.`,
        className: classItem.nombre || classItem.tipoClase?.nombre || 'Turno',
        fecha: classItem.fecha,
        horaInicio: classItem.horaInicio,
        purpose: 'enroll',
    });
});

export {
    getTrialPage,
    startTrial,
    startTrialChange,
    verifyTrialEmail,
    resendTrialCode,
    getTrialClasses,
    enrollTrial,
};
