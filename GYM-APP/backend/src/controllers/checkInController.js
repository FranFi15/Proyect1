import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import moment from 'moment-timezone';
import { format } from 'date-fns';

const getGymTodayRange = (tz) => {
    const timeZone = tz || 'America/Argentina/Buenos_Aires';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
    return {
        todayStart: new Date(`${todayStr}T00:00:00.000Z`),
        todayEnd: new Date(`${todayStr}T23:59:59.999Z`)
    };
};

const getCurrentTimeInGym = (tz) => {
    const timeFormatter = new Intl.DateTimeFormat('es-AR', {
        timeZone: tz || 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    return timeFormatter.format(new Date());
};

const getCreditEntries = (user) => {
    const entries = [];
    const map = user?.creditosPorTipo;
    if (!map) return entries;

    const push = (typeId, count) => {
        const n = Number(count);
        if (typeId != null && n > 0) {
            entries.push({ typeId: String(typeId), count: n });
        }
    };

    // Mongoose Map / JS Map
    if (typeof map.forEach === 'function' && typeof map.get === 'function') {
        map.forEach((count, typeId) => push(typeId, count));
        if (entries.length > 0 || (typeof map.size === 'number' && map.size === 0)) {
            return entries;
        }
    }

    // Fallback: Object.fromEntries / plain object
    try {
        const plain = typeof map.entries === 'function'
            ? Object.fromEntries(map)
            : (typeof map.toObject === 'function' ? map.toObject() : map);
        Object.entries(plain || {}).forEach(([typeId, count]) => push(typeId, count));
    } catch (_) {
        // ignore
    }
    return entries;
};

const getCreditBalance = (user, tipoClaseId) => {
    if (!user?.creditosPorTipo || tipoClaseId == null) return 0;
    const id = String(tipoClaseId);
    const map = user.creditosPorTipo;
    if (typeof map.get === 'function') {
        const direct = map.get(id);
        if (direct != null) return Number(direct) || 0;
        // Some historical docs used ObjectId keys
        try {
            if (typeof map.keys === 'function') {
                for (const key of map.keys()) {
                    if (String(key) === id) return Number(map.get(key)) || 0;
                }
            }
        } catch (_) {
            // ignore
        }
    }
    return Number(map[id]) || 0;
};

const userHasAnyCredits = (user) => getCreditEntries(user).length > 0;

const canEnrollWithCredits = (user, tipoClaseId, universalTypeId) => {
    if (getCreditBalance(user, tipoClaseId) > 0) return true;
    if (universalTypeId && getCreditBalance(user, universalTypeId) > 0) return true;
    // Fallback to entries list (covers odd Map shapes)
    const credits = getCreditEntries(user);
    const tipoId = String(tipoClaseId);
    if (credits.some((c) => c.typeId === tipoId)) return true;
    if (universalTypeId && credits.some((c) => c.typeId === String(universalTypeId))) return true;
    return false;
};

const hasValidPaseLibreForDate = (user, fechaTurno) => {
    if (!user.paseLibreHasta) return false;
    const fecha = new Date(fechaTurno);
    const hasta = new Date(user.paseLibreHasta);
    if (fecha > hasta) return false;
    if (user.paseLibreDesde && fecha < new Date(user.paseLibreDesde)) return false;
    return true;
};

const isClassStillOpen = (clase, tz) => {
    if (!clase?.fecha || !clase?.horaFin) return true;
    const timeZone = tz || 'America/Argentina/Buenos_Aires';
    const dateStr = new Date(clase.fecha).toISOString().substring(0, 10);
    const endUTC = moment.tz(`${dateStr} ${clase.horaFin}`, 'YYYY-MM-DD HH:mm', timeZone);
    if (!endUTC.isValid()) {
        // Fallback loose parse
        const loose = moment.tz(`${dateStr} ${clase.horaFin}`, timeZone);
        if (!loose.isValid()) return true;
        return moment().isBefore(loose);
    }
    return moment().isBefore(endUTC);
};

/**
 * Debit credits / validate pase libre and enroll user into class (mutates user + classItem).
 * Does not save — caller must save both.
 */
const applyEnrollmentToClass = async ({ user, classItem, TipoClase }) => {
    const userId = user._id;
    let tipoCreditoADescontar = null;
    let fechaVencimientoCapturada = null;

    const tienePaseLibreValidoParaEsteTurno = hasValidPaseLibreForDate(user, classItem.fecha);
    const tipoClaseId = classItem.tipoClase._id.toString();

    if (!tienePaseLibreValidoParaEsteTurno) {
        let creditosEspecificos = 0;
        if (user.creditosPorTipo?.get) {
            creditosEspecificos = user.creditosPorTipo.get(tipoClaseId) || 0;
        } else if (user.creditosPorTipo) {
            creditosEspecificos = user.creditosPorTipo[tipoClaseId] || 0;
        }

        if (creditosEspecificos > 0) {
            user.creditosPorTipo.set(tipoClaseId, creditosEspecificos - 1);

            const indicesVto = user.vencimientosDetallados
                .map((v, i) => v.tipoClaseId.toString() === tipoClaseId ? i : -1)
                .filter(i => i !== -1)
                .sort((a, b) => user.vencimientosDetallados[a].fechaVencimiento - user.vencimientosDetallados[b].fechaVencimiento);

            if (indicesVto.length > 0) {
                const idx = indicesVto[0];
                fechaVencimientoCapturada = user.vencimientosDetallados[idx].fechaVencimiento;
                user.vencimientosDetallados[idx].cantidad -= 1;
                if (user.vencimientosDetallados[idx].cantidad <= 0) {
                    user.vencimientosDetallados.splice(idx, 1);
                }
            }
            tipoCreditoADescontar = classItem.tipoClase._id;
        } else {
            const universalType = await TipoClase.findOne({ esUniversal: true });
            if (universalType) {
                const uId = universalType._id.toString();
                const uCreds = user.creditosPorTipo?.get ? (user.creditosPorTipo.get(uId) || 0) : 0;
                if (uCreds > 0) {
                    user.creditosPorTipo.set(uId, uCreds - 1);
                    const indicesVtoUni = user.vencimientosDetallados
                        .map((v, i) => v.tipoClaseId.toString() === uId ? i : -1)
                        .filter(i => i !== -1)
                        .sort((a, b) => new Date(user.vencimientosDetallados[a].fechaVencimiento) - new Date(user.vencimientosDetallados[b].fechaVencimiento));

                    if (indicesVtoUni.length > 0) {
                        const idxU = indicesVtoUni[0];
                        fechaVencimientoCapturada = user.vencimientosDetallados[idxU].fechaVencimiento;
                        user.vencimientosDetallados[idxU].cantidad -= 1;
                        if (user.vencimientosDetallados[idxU].cantidad <= 0) user.vencimientosDetallados.splice(idxU, 1);
                    }
                    tipoCreditoADescontar = universalType._id;
                }
            }
        }

        if (!tipoCreditoADescontar) {
            const hoy = new Date();
            if (user.paseLibreHasta) {
                const fechaVencimiento = format(new Date(user.paseLibreHasta), 'dd/MM/yyyy');
                const err = new Error(`Tu Acceso Libre vence el ${fechaVencimiento} y este turno es posterior. Tampoco tienes créditos disponibles.`);
                err.statusCode = 400;
                throw err;
            }
            if (user.membresiaHasta && new Date(user.membresiaHasta) >= hoy) {
                const err = new Error(`No tienes créditos disponibles para "${classItem.tipoClase.nombre}". (Tu Membresía solo es válida para ingresar al gimnasio sin turno mediante código QR).`);
                err.statusCode = 400;
                throw err;
            }
            const err = new Error(`No tienes un Acceso Libre activo ni créditos disponibles para "${classItem.tipoClase.nombre}".`);
            err.statusCode = 400;
            throw err;
        }
    }

    classItem.usuariosInscritos.push(userId);

    if (!tienePaseLibreValidoParaEsteTurno && tipoCreditoADescontar) {
        classItem.inscripcionesDetalle.push({
            user: userId,
            tipoCreditoUsado: tipoCreditoADescontar,
            fechaVencimientoCredito: fechaVencimientoCapturada
        });
    }

    if (classItem.usuariosInscritos.length >= classItem.capacidad) {
        classItem.estado = 'llena';
    }

    if (!user.clasesInscritas.some(id => id.toString() === classItem._id.toString())) {
        user.clasesInscritas.push(classItem._id);
    }

    user.markModified('creditosPorTipo');
    user.markModified('vencimientosDetallados');
};

const processGeneralCheckIn = asyncHandler(async (req, res) => {
    const { Clase, User } = getModels(req.gymDBConnection);
    const { userId } = req.body;

    if (!userId) {
        res.status(400);
        throw new Error('No se proporcionó un ID de usuario.');
    }

    const user = await User.findById(userId).populate('monthlySubscriptions.tipoClase');
    if (!user) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }

    const { todayStart, todayEnd } = getGymTodayRange(req.gymTimezone);

    const hasActivePaseLibre = user.paseLibreHasta && new Date(user.paseLibreHasta) >= todayStart;
    const hasActiveMembresia = user.membresiaHasta && new Date(user.membresiaHasta) >= todayStart;
    const hasOpenMembership = user.monthlySubscriptions?.some(sub =>
        sub.status === 'active' && (
            sub.tipoClase?.nombre?.toLowerCase().includes('libre') ||
            sub.tipoClase?.nombre?.toLowerCase().includes('musculación') ||
            sub.tipoClase?.nombre?.toLowerCase().includes('membresía')
        )
    );

    const enrolledClassesToday = await Clase.find({
        fecha: { $gte: todayStart, $lte: todayEnd },
        usuariosInscritos: userId,
        estado: 'activa',
    }).populate('tipoClase', 'nombre').sort({ horaInicio: 'asc' });

    if (enrolledClassesToday.length === 0) {
        if (hasActivePaseLibre || hasActiveMembresia || hasOpenMembership) {
            const alreadyRecordedToday = user.historialAsistencias.some(h =>
                (!h.claseId || h.nombreClase === 'Acceso Libre / Musculación') && new Date(h.fecha) >= todayStart
            );
            if (!alreadyRecordedToday) {
                user.historialAsistencias.push({
                    fecha: new Date(),
                    nombreClase: 'Acceso Libre / Musculación'
                });
                await user.save();
            }
            return res.status(200).json({
                success: true,
                message: ` Acceso Libre Permitido - ${user.nombre} ${user.apellido}`,
                classes: [{
                    nombre: 'Acceso Libre / Musculación',
                    horario: 'Membresía Libre'
                }],
                totalAsistencias: user.historialAsistencias.length
            });
        }

        return res.status(403).json({
            success: false,
            message: ` ${user.nombre} ${user.apellido} no está inscripto en ningún turno hoy y no cuenta con Acceso Libre o Membresía activa.`,
        });
    }

    const currentTime = getCurrentTimeInGym(req.gymTimezone);
    const upcomingClasses = enrolledClassesToday.filter(clase => clase.horaFin > currentTime);

    if (upcomingClasses.length === 0) {
        if (hasActivePaseLibre || hasActiveMembresia || hasOpenMembership) {
            return res.status(200).json({
                success: true,
                message: ` Acceso Libre Permitido - ${user.nombre} ${user.apellido}`,
                classes: [{
                    nombre: 'Acceso Libre / Musculación',
                    horario: 'Membresía Libre'
                }],
                totalAsistencias: user.historialAsistencias.length
            });
        }
        return res.status(200).json({
            success: true,
            message: ` ${user.nombre} ${user.apellido} sus turnos ya finalizaron.`,
            classes: []
        });
    }

    for (const clase of upcomingClasses) {
        if (!clase.asistencias.some(id => id.toString() === user._id.toString())) {
            clase.asistencias.push(user._id);
            await clase.save();
        }
        const alreadyRecordedToday = user.historialAsistencias.some(h =>
            h.claseId && h.claseId.toString() === clase._id.toString() && new Date(h.fecha) >= todayStart
        );
        if (!alreadyRecordedToday) {
            user.historialAsistencias.push({
                claseId: clase._id,
                fecha: new Date(),
                nombreClase: clase.tipoClase?.nombre || 'Turno General'
            });
        }
    }
    await user.save();

    res.status(200).json({
        success: true,
        message: ` ${user.nombre} ${user.apellido}:`,
        classes: upcomingClasses.map(c => ({
            nombre: c.tipoClase?.nombre || 'General',
            horario: `${c.horaInicio}hs - ${c.horaFin}hs`
        })),
        totalAsistencias: user.historialAsistencias.length
    });
});

const getClientCheckInOptions = asyncHandler(async (req, res) => {
    const { Clase, User, TipoClase, Settings } = getModels(req.gymDBConnection);
    const userId = req.user._id;

    const user = await User.findById(userId).populate('monthlySubscriptions.tipoClase');
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }

    const { todayStart, todayEnd } = getGymTodayRange(req.gymTimezone);
    const tz = req.gymTimezone || 'America/Argentina/Buenos_Aires';

    const hasActiveMembresia = !!(user.membresiaHasta && new Date(user.membresiaHasta) >= todayStart
        && (!user.membresiaDesde || new Date(user.membresiaDesde) <= todayEnd));
    const paseLibreActiveToday = !!(user.paseLibreHasta && new Date(user.paseLibreHasta) >= todayStart
        && (!user.paseLibreDesde || new Date(user.paseLibreDesde) <= todayEnd));
    const hasCredits = userHasAnyCredits(user);

    const enrolledClassesToday = await Clase.find({
        fecha: { $gte: todayStart, $lte: todayEnd },
        usuariosInscritos: userId,
        estado: 'activa',
    })
        .populate('tipoClase', 'nombre')
        .populate('sucursal', 'nombre')
        .sort({ horaInicio: 'asc' });

    const recordedIds = user.historialAsistencias
        .filter(h => new Date(h.fecha) >= todayStart && h.claseId)
        .map(h => h.claseId.toString());

    let upcomingEnrolled = enrolledClassesToday
        .filter(clase => isClassStillOpen(clase, tz))
        .filter(clase => !recordedIds.includes(clase._id.toString()));

    const options = upcomingEnrolled.map(c => ({
        type: 'clase',
        id: c._id.toString(),
        nombre: c.nombre || c.tipoClase?.nombre || 'Turno General',
        horario: `${c.horaInicio}hs - ${c.horaFin}hs`,
        subtitle: 'Ya estás inscripto',
        actionLabel: 'Registrar presentismo',
        tipoClaseId: c.tipoClase?._id?.toString() || null,
        tipoClaseNombre: c.tipoClase?.nombre || c.nombre || 'Turno',
        sucursalId: c.sucursal?._id?.toString() || c.sucursal?.toString?.() || null,
        sucursalNombre: c.sucursal?.nombre || 'Sin sede',
    }));

    const recordedLibreToday = user.historialAsistencias.some(h =>
        (!h.claseId || h.nombreClase === 'Acceso Libre / Musculación') && new Date(h.fecha) >= todayStart
    );

    // Membresía / Acceso libre: registrar entrada (sin turno)
    // Pase libre: "Registrar entrada"; Membresía: same Acceso Libre label as before
    if ((paseLibreActiveToday || hasActiveMembresia) && !recordedLibreToday) {
        options.unshift({
            type: 'membresia',
            id: 'membresia',
            nombre: paseLibreActiveToday && !hasActiveMembresia
                ? 'Registrar entrada'
                : 'Acceso Libre / Musculación',
            horario: paseLibreActiveToday && !hasActiveMembresia ? 'Acceso Libre' : 'Membresía Libre',
            subtitle: paseLibreActiveToday && !hasActiveMembresia
                ? 'Ingresar sin inscribirte a un turno'
                : 'Ingreso con membresía',
            actionLabel: 'Registrar entrada'
        });
    }

    // Credits or Pase libre: offer today's classes they can enroll into (+ auto presentismo)
    const canOfferEnrollment = hasCredits || paseLibreActiveToday;
    if (canOfferEnrollment) {
        const universalType = await TipoClase.findOne({ esUniversal: true }).select('_id');
        const universalTypeId = universalType?._id?.toString() || null;

        let canEnrollMoreToday = true;
        try {
            const settings = await Settings.findById('main_settings');
            const maxDailyClasses = settings?.maxDailyClassesPerUser || 0;
            if (maxDailyClasses > 0) {
                const enrollmentsToday = await Clase.countDocuments({
                    fecha: { $gte: todayStart, $lte: todayEnd },
                    usuariosInscritos: userId,
                    estado: { $in: ['activa', 'completada', 'llena'] }
                });
                canEnrollMoreToday = enrollmentsToday < maxDailyClasses;
            }
        } catch (settingsErr) {
            console.error('check-in options: settings lookup failed', settingsErr?.message);
        }

        if (canEnrollMoreToday) {
            const classQuery = {
                fecha: { $gte: todayStart, $lte: todayEnd },
                estado: 'activa',
            };

            // Respect branch restrictions the same way calendar listing does
            if (user.todasLasSucursales === false && Array.isArray(user.sucursales) && user.sucursales.length > 0) {
                classQuery.$or = [
                    { sucursal: { $in: user.sucursales } },
                    { sucursal: null },
                    { sucursal: { $exists: false } },
                ];
            }

            const todayClasses = await Clase.find(classQuery)
                .populate('tipoClase', 'nombre esUniversal')
                .populate('sucursal', 'nombre')
                .sort({ horaInicio: 'asc' });

            const enrolledIds = new Set(
                enrolledClassesToday.map(c => c._id.toString())
            );

            for (const clase of todayClasses) {
                const classId = clase._id.toString();
                if (enrolledIds.has(classId)) continue;
                if (!isClassStillOpen(clase, tz)) continue;
                const capacity = Number(clase.capacidad);
                const enrolledCount = (clase.usuariosInscritos || []).length;
                if (Number.isFinite(capacity) && capacity > 0 && enrolledCount >= capacity) continue;

                const tipo = clase.tipoClase;
                if (!tipo || tipo.esUniversal) continue;

                const tipoId = (tipo._id || tipo).toString();
                const withPase = hasValidPaseLibreForDate(user, clase.fecha);
                const withCredit = canEnrollWithCredits(user, tipoId, universalTypeId);
                if (!withPase && !withCredit) continue;

                options.push({
                    type: 'enroll_clase',
                    id: classId,
                    nombre: clase.nombre || tipo.nombre || 'Turno',
                    horario: `${clase.horaInicio}hs - ${clase.horaFin}hs`,
                    subtitle: withPase
                        ? 'Inscribirte con Acceso Libre + presentismo'
                        : 'Inscribirte con crédito + presentismo',
                    actionLabel: 'Inscribirme y presentismo',
                    cupos: Number.isFinite(capacity) ? Math.max(0, capacity - enrolledCount) : null,
                    tipoClaseId: tipoId,
                    tipoClaseNombre: tipo.nombre || clase.nombre || 'Turno',
                    sucursalId: clase.sucursal?._id?.toString() || clase.sucursal?.toString?.() || null,
                    sucursalNombre: clase.sucursal?.nombre || 'Sin sede',
                });
            }
        }
    }

    if (options.length === 0) {
        let message = 'No tienes turnos pendientes hoy o ya registraste tu presentismo.';
        if (hasCredits) {
            message = 'No hay turnos disponibles ahora para tus créditos. Inscribite desde el calendario o volvé más tarde.';
        } else if (paseLibreActiveToday) {
            message = 'Ya registraste tu entrada o no hay turnos disponibles para inscribirte ahora.';
        } else if (hasActiveMembresia) {
            message = 'Ya registraste tu acceso de membresía hoy.';
        }

        return res.status(403).json({
            success: false,
            message,
        });
    }

    res.status(200).json({
        success: true,
        message: '¿Qué querés registrar?',
        options,
        meta: {
            hasCredits,
            hasPaseLibre: paseLibreActiveToday,
            hasMembresia: hasActiveMembresia,
        }
    });
});

const confirmClientCheckIn = asyncHandler(async (req, res) => {
    const { Clase, User, TipoClase, Settings } = getModels(req.gymDBConnection);
    const userId = req.user._id;
    const { type, id } = req.body;

    if (!type || !id) {
        res.status(400);
        throw new Error('Faltan datos de confirmación.');
    }

    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }

    const { todayStart, todayEnd } = getGymTodayRange(req.gymTimezone);
    const tz = req.gymTimezone || 'America/Argentina/Buenos_Aires';
    let checkInMessage = '';

    if (type === 'membresia') {
        const hasActivePaseLibre = !!(user.paseLibreHasta && new Date(user.paseLibreHasta) >= todayStart);
        const hasActiveMembresia = !!(user.membresiaHasta && new Date(user.membresiaHasta) >= todayStart);
        if (!hasActivePaseLibre && !hasActiveMembresia) {
            res.status(403);
            throw new Error('No tenés Acceso Libre ni Membresía activa.');
        }

        const alreadyRecordedToday = user.historialAsistencias.some(h =>
            (!h.claseId || h.nombreClase === 'Acceso Libre / Musculación') && new Date(h.fecha) >= todayStart
        );
        if (!alreadyRecordedToday) {
            user.historialAsistencias.push({
                fecha: new Date(),
                nombreClase: 'Acceso Libre / Musculación'
            });
            await user.save();
        }
        checkInMessage = hasActivePaseLibre && !hasActiveMembresia
            ? 'Entrada registrada con éxito.'
            : 'Acceso Libre registrado con éxito.';
    } else if (type === 'clase' || type === 'enroll_clase') {
        const clase = await Clase.findById(id).populate('tipoClase');
        if (!clase) {
            res.status(404);
            throw new Error('Clase no encontrada.');
        }

        const alreadyEnrolled = (clase.usuariosInscritos || []).some(
            uid => uid.toString() === user._id.toString()
        );

        if (type === 'enroll_clase') {
            if (alreadyEnrolled) {
                // Already enrolled — fall through to presentismo only
            } else {
                if (clase.estado !== 'activa') {
                    res.status(400);
                    throw new Error(`No te puedes inscribir a un turno ${clase.estado}.`);
                }
                if ((clase.usuariosInscritos || []).length >= clase.capacidad) {
                    res.status(400);
                    throw new Error('Este turno ya está completo.');
                }
                if (clase.tipoClase?.esUniversal) {
                    res.status(400);
                    throw new Error('No te puedes inscribir a este tipo de turno.');
                }

                if (clase.fecha && clase.horaFin) {
                    const dateStr = new Date(clase.fecha).toISOString().substring(0, 10);
                    const endUTC = moment.tz(`${dateStr} ${clase.horaFin}`, tz).toDate();
                    if (new Date() >= endUTC) {
                        res.status(400);
                        throw new Error('No te puedes inscribir a un turno que ya ha finalizado.');
                    }
                }

                const settings = await Settings.findById('main_settings');
                const maxDailyClasses = settings?.maxDailyClassesPerUser || 0;
                if (maxDailyClasses > 0) {
                    const enrollmentsToday = await Clase.countDocuments({
                        fecha: { $gte: todayStart, $lte: todayEnd },
                        usuariosInscritos: userId,
                        estado: { $in: ['activa', 'completada', 'llena'] }
                    });
                    if (enrollmentsToday >= maxDailyClasses) {
                        res.status(400);
                        throw new Error(`Has alcanzado el límite máximo de inscripciones por día (${maxDailyClasses} turnos).`);
                    }
                }

                if (clase.waitlist && clase.waitlist.includes(userId)) {
                    clase.waitlist.pull(userId);
                }

                try {
                    await applyEnrollmentToClass({ user, classItem: clase, TipoClase });
                } catch (err) {
                    res.status(err.statusCode || 400);
                    throw err;
                }
            }
        } else if (!alreadyEnrolled) {
            res.status(403);
            throw new Error('No estás inscripto en este turno.');
        }

        if (!clase.asistencias.some(aId => aId.toString() === user._id.toString())) {
            clase.asistencias.push(user._id);
        }

        const alreadyRecordedToday = user.historialAsistencias.some(h =>
            h.claseId && h.claseId.toString() === clase._id.toString() && new Date(h.fecha) >= todayStart
        );

        if (!alreadyRecordedToday) {
            user.historialAsistencias.push({
                claseId: clase._id,
                fecha: new Date(),
                nombreClase: clase.tipoClase?.nombre || 'Turno General'
            });
        }

        await clase.save();
        await user.save();

        checkInMessage = type === 'enroll_clase' && !alreadyEnrolled
            ? `Inscripción y presentismo: ${clase.tipoClase?.nombre || clase.nombre || 'General'}.`
            : `Presentismo registrado: ${clase.tipoClase?.nombre || 'General'}.`;
    } else {
        res.status(400);
        throw new Error('Tipo de presentismo no válido.');
    }

    res.status(200).json({
        success: true,
        message: ` ${checkInMessage}`,
        totalAsistencias: user.historialAsistencias.length
    });
});

export { processGeneralCheckIn, getClientCheckInOptions, confirmClientCheckIn };
