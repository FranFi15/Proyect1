import { format } from 'date-fns';
import { sendSingleNotification } from '../controllers/notificationController.js';

/**
 * Enroll a user into a fixed schedule plan (classes matching criteria + planesFijos).
 * Shared by free subscribe-to-plan and paid caja sales.
 */
export const enrollUserInFixedPlan = async ({
    models,
    user,
    tipoClaseId,
    diasDeSemana,
    fechaInicio,
    fechaFin,
    horaInicio,
    horaFin,
    gymTimezone = 'America/Argentina/Buenos_Aires',
    notify = true,
}) => {
    const { Clase, TipoClase, Notification, User } = models;
    const endDate = fechaFin || fechaInicio;

    if (!tipoClaseId || !diasDeSemana?.length || !fechaInicio || !horaInicio) {
        const err = new Error('Faltan datos para la inscripción al plan.');
        err.statusCode = 400;
        throw err;
    }

    const tipoClase = await TipoClase.findById(tipoClaseId);
    if (!tipoClase) {
        const err = new Error('Tipo de turno no encontrado.');
        err.statusCode = 404;
        throw err;
    }

    const classesToEnroll = await Clase.find({
        tipoClase: tipoClaseId,
        diaDeSemana: { $in: diasDeSemana },
        horaInicio,
        fecha: { $gte: new Date(`${fechaInicio}T00:00:00Z`), $lte: new Date(`${endDate}T23:59:59Z`) },
        estado: 'activa',
    });

    if (classesToEnroll.length === 0) {
        const err = new Error('No se encontraron turnos activos que coincidan con los criterios del plan.');
        err.statusCode = 404;
        throw err;
    }

    const userId = user._id.toString();

    for (const classInstance of classesToEnroll) {
        if (classInstance.usuariosInscritos.length >= classInstance.capacidad) {
            const classDate = new Date(classInstance.fecha).toLocaleDateString('es-AR', { timeZone: gymTimezone });
            const err = new Error(`No se puede inscribir al plan. Los turnos del día ${classDate} a las ${classInstance.horaInicio} está lleno.`);
            err.statusCode = 400;
            throw err;
        }
        if (classInstance.usuariosInscritos.some((id) => id.toString() === userId)) {
            const classDate = new Date(classInstance.fecha).toLocaleDateString('es-AR', { timeZone: gymTimezone });
            const err = new Error(`El usuario ya está inscrito en el turno del ${classDate}.`);
            err.statusCode = 400;
            throw err;
        }
    }

    let enrolledCount = 0;
    for (const classInstance of classesToEnroll) {
        classInstance.usuariosInscritos.push(user._id);
        if (classInstance.usuariosInscritos.length >= classInstance.capacidad) {
            classInstance.estado = 'llena';
        }
        await classInstance.save();

        if (!user.clasesInscritas.some((id) => id.toString() === classInstance._id.toString())) {
            user.clasesInscritas.push(classInstance._id);
        }
        enrolledCount++;
    }

    user.planesFijos.push({
        tipoClase: tipoClaseId,
        diasDeSemana,
        horaInicio,
        horaFin,
        fechaInicio: new Date(`${fechaInicio}T00:00:00Z`),
        fechaFin: new Date(`${endDate}T23:59:59Z`),
    });
    await user.save();

    if (notify && Notification && User) {
        const title = '¡Inscripción a Plan Exitosa!';
        const message = `Se te inscribió en un nuevo plan para los turnos de ${tipoClase.nombre} los días ${diasDeSemana.join(', ')} a las ${horaInicio}hs. Hasta el ${format(new Date(endDate), 'dd/MM/yyyy')}.`;
        try {
            await sendSingleNotification(Notification, User, user._id, title, message, 'plan_enrollment', false);
        } catch (e) {
            console.error('No se pudo notificar inscripción a plan fijo:', e.message);
        }
    }

    return {
        enrolledCount,
        tipoClaseNombre: tipoClase.nombre,
        benefitMessage: `Inscripción a horario fijo: ${enrolledCount} turnos.`,
    };
};
