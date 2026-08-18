import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import { startOfDay, endOfDay, format } from 'date-fns';

const getGymTodayRange = (tz) => {
    const timeZone = tz || 'America/Argentina/Buenos_Aires';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
    return {
        todayStart: new Date(`${todayStr}T00:00:00.000Z`),
        todayEnd: new Date(`${todayStr}T23:59:59.999Z`)
    };
};

const processGeneralCheckIn = asyncHandler(async (req, res) => {
    const { Clase, User } = getModels(req.gymDBConnection); // Añadimos User para obtener el nombre
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

    // 1. Buscamos todas las clases de hoy en las que el usuario está inscrito.
    const enrolledClassesToday = await Clase.find({
        fecha: { $gte: todayStart, $lte: todayEnd },
        usuariosInscritos: userId, // Filtramos directamente en la consulta
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

    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat('es-AR', {
        timeZone: req.gymTimezone || 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const currentTime = timeFormatter.format(now);
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
            success: true, // Es éxito, pero sin clases activas
            message: ` ${user.nombre} ${user.apellido} sus turnos ya finalizaron.`,
            classes: []
        });
    }

    // Registrar asistencia
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

    // 3. Si se encuentran clases válidas, respondemos con la lista.
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
    const { Clase, User } = getModels(req.gymDBConnection);
    const userId = req.user._id;

    const user = await User.findById(userId).populate('monthlySubscriptions.tipoClase');
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
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
    const hasFreeAccess = hasActivePaseLibre || hasActiveMembresia || hasOpenMembership;

    const enrolledClassesToday = await Clase.find({
        fecha: { $gte: todayStart, $lte: todayEnd },
        usuariosInscritos: userId,
        estado: 'activa',
    }).populate('tipoClase', 'nombre').sort({ horaInicio: 'asc' });

    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat('es-AR', {
        timeZone: req.gymTimezone || 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const currentTime = timeFormatter.format(now);

    // Filtrar clases que ya pasaron
    let upcomingClasses = enrolledClassesToday.filter(clase => clase.horaFin > currentTime);

    // Filtrar clases en las que YA registró presentismo hoy
    const recordedIds = user.historialAsistencias
        .filter(h => new Date(h.fecha) >= todayStart && h.claseId)
        .map(h => h.claseId.toString());

    upcomingClasses = upcomingClasses.filter(clase => !recordedIds.includes(clase._id.toString()));

    const options = upcomingClasses.map(c => ({
        type: 'clase',
        id: c._id.toString(),
        nombre: c.tipoClase?.nombre || 'Turno General',
        horario: `${c.horaInicio}hs - ${c.horaFin}hs`
    }));

    // Si tiene acceso libre, agregarlo como opción (si no registró acceso libre hoy)
    const recordedLibreToday = user.historialAsistencias.some(h =>
        (!h.claseId || h.nombreClase === 'Acceso Libre / Musculación') && new Date(h.fecha) >= todayStart
    );

    if (hasFreeAccess && !recordedLibreToday) {
        options.push({
            type: 'membresia',
            id: 'membresia',
            nombre: 'Acceso Libre / Musculación',
            horario: 'Membresía Libre'
        });
    }

    if (options.length === 0) {
        return res.status(403).json({
            success: false,
            message: ` No tienes turnos pendientes hoy o ya registraste tu presentismo.`,
        });
    }

    res.status(200).json({
        success: true,
        message: '¿A qué vas a asistir?',
        options
    });
});

const confirmClientCheckIn = asyncHandler(async (req, res) => {
    const { Clase, User } = getModels(req.gymDBConnection);
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

    const { todayStart } = getGymTodayRange(req.gymTimezone);
    let checkInMessage = '';

    if (type === 'membresia') {
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
        checkInMessage = 'Acceso Libre registrado con éxito.';
    } else if (type === 'clase') {
        const clase = await Clase.findById(id).populate('tipoClase', 'nombre');
        if (!clase) {
            res.status(404);
            throw new Error('Clase no encontrada.');
        }

        if (!clase.asistencias.some(aId => aId.toString() === user._id.toString())) {
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
            await user.save();
        }
        checkInMessage = `Presentismo registrado: ${clase.tipoClase?.nombre || 'General'}.`;
    }

    res.status(200).json({
        success: true,
        message: ` ${checkInMessage}`,
        totalAsistencias: user.historialAsistencias.length
    });
});

export { processGeneralCheckIn, getClientCheckInOptions, confirmClientCheckIn };