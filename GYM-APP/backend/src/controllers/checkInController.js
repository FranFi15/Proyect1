import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import { startOfDay, endOfDay, format } from 'date-fns';

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

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const hasActivePaseLibre = user.paseLibreHasta && new Date(user.paseLibreHasta) >= todayStart;
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
        if (hasActivePaseLibre || hasOpenMembership) {
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
                message: `✅ Acceso Libre Permitido - ${user.nombre} ${user.apellido}`,
                classes: [{
                    nombre: 'Acceso Libre / Musculación',
                    horario: 'Membresía Libre'
                }],
                totalAsistencias: user.historialAsistencias.length
            });
        }

        return res.status(403).json({
            success: false,
            message: `❌ ${user.nombre} ${user.apellido} no está inscripto en ningún turno hoy y no cuenta con Pase Libre activo.`,
        });
    }

    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires', // <--- CAMBIA ESTO SEGÚN TU PAÍS
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const currentTime = timeFormatter.format(now);
    const upcomingClasses = enrolledClassesToday.filter(clase => clase.horaFin > currentTime);

    if (upcomingClasses.length === 0) {
        if (hasActivePaseLibre || hasOpenMembership) {
            return res.status(200).json({
                success: true,
                message: `✅ Acceso Libre Permitido - ${user.nombre} ${user.apellido}`,
                classes: [{
                    nombre: 'Acceso Libre / Musculación',
                    horario: 'Membresía Libre'
                }],
                totalAsistencias: user.historialAsistencias.length
            });
        }
        return res.status(200).json({
            success: true, // Es éxito, pero sin clases activas
            message: `✅ ${user.nombre} ${user.apellido} sus turnos ya finalizaron.`,
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
        message: `✅ ${user.nombre} ${user.apellido}:`,
        classes: upcomingClasses.map(c => ({ 
            nombre: c.tipoClase?.nombre || 'General',
            horario: `${c.horaInicio}hs - ${c.horaFin}hs`
        })),
        totalAsistencias: user.historialAsistencias.length
    });
});

const processClientReceptionScan = asyncHandler(async (req, res) => {
    const { Clase, User } = getModels(req.gymDBConnection);
    const userId = req.user._id;

    const user = await User.findById(userId).populate('monthlySubscriptions.tipoClase');
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const hasActivePaseLibre = user.paseLibreHasta && new Date(user.paseLibreHasta) >= todayStart;
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
        if (hasActivePaseLibre || hasOpenMembership) {
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
                message: `✅ Acceso Libre registrado con éxito`,
                classes: [{
                    nombre: 'Acceso Libre / Musculación',
                    horario: 'Membresía Libre'
                }],
                totalAsistencias: user.historialAsistencias.length
            });
        }

        return res.status(403).json({
            success: false,
            message: `❌ No estás inscripto en ningún turno hoy y no cuentas con Pase Libre activo.`,
        });
    }

    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const currentTime = timeFormatter.format(now);
    const upcomingClasses = enrolledClassesToday.filter(clase => clase.horaFin > currentTime);

    if (upcomingClasses.length === 0) {
        if (hasActivePaseLibre || hasOpenMembership) {
            return res.status(200).json({
                success: true,
                message: `✅ Acceso Libre registrado con éxito`,
                classes: [{
                    nombre: 'Acceso Libre / Musculación',
                    horario: 'Membresía Libre'
                }],
                totalAsistencias: user.historialAsistencias.length
            });
        }
        return res.status(200).json({
            success: true,
            message: `✅ Tus turnos de hoy ya finalizaron.`,
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

    res.status(200).json({
        success: true,
        message: `✅ Presentismo registrado con éxito para:`,
        classes: upcomingClasses.map(c => ({ 
            nombre: c.tipoClase?.nombre || 'General',
            horario: `${c.horaInicio}hs - ${c.horaFin}hs`
        })),
        totalAsistencias: user.historialAsistencias.length
    });
});

export { processGeneralCheckIn, processClientReceptionScan };