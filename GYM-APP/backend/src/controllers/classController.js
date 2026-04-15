import rrule from 'rrule';
import asyncHandler from 'express-async-handler';
import { calculateAge } from '../utils/ageUtils.js';
import getModels from '../utils/getModels.js';
import { parse, subHours, format } from 'date-fns';
const {RRule} = rrule
import mongoose from 'mongoose';
import { sendSingleNotification } from './notificationController.js'; 

const mapDayToRRule = (day) => {
    const map = {
        'Lunes': RRule.MO,
        'Martes': RRule.TU,
        'Miércoles': RRule.WE,
        'Jueves': RRule.TH,
        'Viernes': RRule.FR,
        'Sábado': RRule.SA,
        'Domingo': RRule.SU,
    };
    return map[day];
};

const getDayName = (date) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[date.getUTCDay()];
};

const setNoonUTC = (date) => {
    const newDate = new Date(date);
    newDate.setUTCHours(12, 0, 0, 0);
    return newDate;
};

const createClass = asyncHandler(async (req, res) => {
    const { Clase, TipoClase } = getModels(req.gymDBConnection);
    const { nombre, tipoClase: tipoClaseId, profesores, profesor, capacidad, tipoInscripcion, fecha, horaInicio, horaFin, fechaInicio, fechaFin, diaDeSemana } = req.body;
    
    if (!tipoClaseId) {
        res.status(400);
        throw new Error('Debes seleccionar un tipo de turno. Si no hay tipos creados, crea uno primero.');
    }
    const tipoSeleccionado = await TipoClase.findById(tipoClaseId);
    if (tipoSeleccionado && tipoSeleccionado.esUniversal) {
        res.status(400);
        throw new Error('No puedes crear turnos del tipo "Crédito Universal". Este tipo es exclusivo para pagos.');
    }
    if (!capacidad) {
        res.status(400);
        throw new Error('La capacidad del turno es obligatoria.');
    }
    if (!horaInicio || !horaFin) {
        res.status(400);
        throw new Error('El horario de inicio y fin es obligatorio.');
    }

    if (tipoInscripcion === 'fijo') {
        if (!fechaInicio || !fechaFin) {
            res.status(400);
            throw new Error('Para turnos Recurrentes, debes especificar fecha de inicio y fin.');
        }
        if (!diaDeSemana || diaDeSemana.length === 0) {
            res.status(400);
            throw new Error('Debes seleccionar al menos un día de la semana para turnos.');
        }
    } else {
        if (!fecha) {
            res.status(400);
            throw new Error('La fecha del turno es obligatoria.');
        }
    }

    const capacidadNum = Number(capacidad) || 0;
    let totalCapacityCreated = 0;
    let createdClassesData = [];

    let profesoresIds = [];
    if (profesores && Array.isArray(profesores)) {
        profesoresIds = profesores;
    } else if (profesor) {
        profesoresIds = [profesor];
    }

    if (tipoInscripcion === 'fijo') {
        try {
            const rule = new RRule({
                freq: RRule.WEEKLY,
                byweekday: diaDeSemana.map(day => mapDayToRRule(day)).filter(Boolean),
                dtstart: new Date(`${fechaInicio}T12:00:00.000Z`),
                until: new Date(`${fechaFin}T12:00:00.000Z`),
            });
            const allDates = rule.all();
            
            if (allDates.length === 0) {
                return res.status(400).json({ message: "La configuración de fechas y días no generó ningún turno válido. Verifica el rango y los días seleccionados." });
            }
            
            const classCreationPromises = allDates.map(dateInstance => {
                const newClassData = { 
                    nombre, 
                    tipoClase: tipoClaseId, 
                    profesores: profesoresIds,
                    profesor: profesoresIds[0], 
                    capacidad: capacidadNum, 
                    horaInicio, 
                    horaFin, 
                    fecha: dateInstance, 
                    diaDeSemana: [getDayName(dateInstance)], 
                    tipoInscripcion: 'fijo', 
                    rrule: rule.toString(),
                    usuariosInscritos: [],
                    inscripcionesDetalle: []
                };
                return Clase.create(newClassData);
            });
            createdClassesData = await Promise.all(classCreationPromises);
            totalCapacityCreated = capacidadNum * createdClassesData.length;
            
        } catch (rruleError) {
            console.error("Error al generar fechas recurrentes:", rruleError);
            res.status(400);
            throw new Error('Error al generar los turnos recurrentes. Verifica las fechas.');
        }

    } else {
        const safeDate = new Date(`${fecha}T12:00:00.000Z`);
        const newClass = new Clase({ 
            nombre, 
            tipoClase: tipoClaseId, 
            profesores: profesoresIds,
            profesor: profesoresIds[0], 
            capacidad: capacidadNum, 
            horaInicio, 
            horaFin, 
            fecha: safeDate, 
            diaDeSemana: [getDayName(safeDate)], 
            tipoInscripcion: 'libre',
            usuariosInscritos: [],
            inscripcionesDetalle: []
        });
        createdClassesData = [await newClass.save()];
        totalCapacityCreated = capacidadNum;
    }

    if (totalCapacityCreated > 0) {
        await TipoClase.findByIdAndUpdate(tipoClaseId, {
            $inc: {
                creditosTotales: totalCapacityCreated,
                creditosDisponibles: totalCapacityCreated
            }
        });
    }

    res.status(201).json({ message: `Se crearon ${createdClassesData.length} turnos exitosamente.`, data: createdClassesData });
});

const getAllClassesAdmin = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const classes = await Clase.find({})
    .populate('tipoClase', 'nombre')
    .populate('profesores', 'nombre apellido')
    .populate('profesor', 'nombre apellido');

     res.json(classes);
});

const getAllClasses = asyncHandler(async (req, res) => {
    const { Clase, Settings } = getModels(req.gymDBConnection);

    const { includePast } = req.query;
    const settings = await Settings.findById('main_settings');
    const visibilityDays = settings?.classVisibilityDays;

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    let dateFilter = {};
    
    if (includePast !== 'true') {
        dateFilter = { fecha: { $gte: today } }; 
        
        if (visibilityDays && visibilityDays > 0) {
            const limitDate = new Date(today);
            limitDate.setDate(today.getDate() + visibilityDays);
            dateFilter.fecha = { ...dateFilter.fecha, $lt: limitDate };
        }
    }

    const classes = await Clase.find({ ...dateFilter })
        .populate('tipoClase', 'nombre')
        .populate('profesores', 'nombre apellido')
        .populate('profesor', 'nombre apellido');
        
    res.json(classes);
});


const getClassById = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const classItem = await Clase.findById(req.params.id)
        .populate('tipoClase', 'nombre')
        .populate('usuariosInscritos', 'nombre apellido dni fechaNacimiento sexo numeroTelefono telefonoEmergencia obraSocial')
        .populate('profesores', 'nombre apellido')
         .populate('profesor', 'nombre apellido');

    if (classItem) {
        const classWithAge = classItem.toObject();
        if (classWithAge.usuariosInscritos && classWithAge.usuariosInscritos.length > 0) {
            classWithAge.usuariosInscritos = classWithAge.usuariosInscritos.map(user => ({
                ...user,
                edad: user.fechaNacimiento ? calculateAge(user.fechaNacimiento) : 'N/A'
            }));
        }
        res.json(classWithAge);
    } else {
        res.status(404);
        throw new Error('Turno no encontrado.');
    }
});

const updateClass = asyncHandler(async (req, res) => {
    const { Clase, TipoClase, Notification, User } = getModels(req.gymDBConnection);
    
    // BLINDAJE DE SEGURIDAD: Extraemos usuariosInscritos para evitar que venga en el body y sobrescriba
    const { capacidad, profesores, usuariosInscritos, inscripcionesDetalle, waitlist, ...otherUpdates } = req.body;
    
    const classItem = await Clase.findById(req.params.id).populate('usuariosInscritos');

    if (!classItem) {
        res.status(404);
        throw new Error('Turno no encontrado.');
    }

    const oldHoraInicio = classItem.horaInicio;
    const oldFecha = classItem.fecha;

     if (otherUpdates.fecha) {
        otherUpdates.fecha = new Date(`${otherUpdates.fecha}T12:00:00.000Z`);
    }

    const oldCapacity = classItem.capacidad;
    const newCapacity = capacidad !== undefined ? Number(capacidad) : oldCapacity;
    const capacityDifference = newCapacity - oldCapacity;

    Object.assign(classItem, otherUpdates); 
    classItem.capacidad = newCapacity;

    if (profesores) {
         classItem.profesores = Array.isArray(profesores) ? profesores : [profesores];
    }

    const updatedClass = await classItem.save();

    if ((otherUpdates.horaInicio && otherUpdates.horaInicio !== oldHoraInicio) || 
        (otherUpdates.fecha && otherUpdates.fecha.getTime() !== oldFecha.getTime())) {
        
        const fechaLegible = format(new Date(updatedClass.fecha), 'dd/MM');
        
        for (const user of classItem.usuariosInscritos) {
            await sendSingleNotification(
                Notification,
                User,
                user._id,
                "⚠️ Cambio de Horario",
                `Tu turno de "${updatedClass.nombre}" del día ${fechaLegible} ha sido reprogramado a las ${updatedClass.horaInicio}hs.`,
                'class_update', 
                true,
                updatedClass._id
            );
        }
    }

    if (capacityDifference !== 0) {
        await TipoClase.findByIdAndUpdate(classItem.tipoClase, {
            $inc: {
                creditosTotales: capacityDifference,
                creditosDisponibles: capacityDifference
            }
        });
    }

    res.json(updatedClass);
});

const cancelClassInstance = asyncHandler(async (req, res) => {
    const { Clase, User, Notification } = getModels(req.gymDBConnection);
    const { refundCredits } = req.body;
    const classItem = await Clase.findById(req.params.id).populate('tipoClase');

    if (!classItem) {
        res.status(404);
        throw new Error('Turno no encontrado.');
    }
    if (classItem.estado === 'cancelada') {
        res.status(400);
        throw new Error('El turno ya ha sido cancelado.');
    }
    
    classItem.estado = 'cancelada';

    if (refundCredits) {
        for (const userId of classItem.usuariosInscritos) {
            const user = await User.findById(userId);
            if (user) {
                const hoy = new Date();
                const tienePaseLibreActivo = user.paseLibreDesde && user.paseLibreHasta &&
                    hoy >= user.paseLibreDesde && hoy <= user.paseLibreHasta;

                if (!tienePaseLibreActivo) {
                    const detalle = classItem.inscripcionesDetalle?.find(d => d.user.toString() === userId.toString());
                    let creditoADevolverId = detalle?.tipoCreditoUsado ? detalle.tipoCreditoUsado.toString() : classItem.tipoClase._id.toString();

                    const currentCredits = user.creditosPorTipo.get(creditoADevolverId) || 0;
                    user.creditosPorTipo.set(creditoADevolverId, currentCredits + 1);
                    await user.save();

                    await Notification.create({
                        user: user._id,
                        message: `Se te ha reembolsado 1 crédito para el turno "${classItem.nombre}" del ${new Date(classItem.fecha).toLocaleDateString()} debido a su cancelación.`,
                        type: 'class_cancellation_refund',
                        class: classItem._id
                    });
                } else {
                    await Notification.create({
                        user: user._id,
                        message: `El turno "${classItem.nombre}" del ${new Date(classItem.fecha).toLocaleDateString()} ha sido cancelado.`,
                        type: 'class_cancellation_refund',
                        class: classItem._id
                    });
                }
            }
        }
        
        classItem.usuariosInscritos = [];
        classItem.inscripcionesDetalle = []; 
    }

    await classItem.save();
    res.json({ message: 'Turno cancelado exitosamente.', class: classItem });
});

const reactivateClass = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const classItem = await Clase.findById(req.params.id);

    if (!classItem) {
        res.status(404);
        throw new Error('Turno no encontrado.');
    }
    if (classItem.estado === 'activa' || classItem.estado === 'llena') {
        res.status(400);
        throw new Error('El turno ya está activo o lleno.');
    }
    classItem.estado = 'activa';
    await classItem.save();
    res.json({ message: 'Turno reactivado exitosamente.', class: classItem });
});


const deleteClass = asyncHandler(async (req, res) => {
    const { Clase, User, TipoClase, Notification } = getModels(req.gymDBConnection);
    const classItem = await Clase.findById(req.params.id).populate('usuariosInscritos');

    if (classItem) {
        const capacity = classItem.capacidad;
        const tipoClaseId = classItem.tipoClase;

        if (classItem.usuariosInscritos && classItem.usuariosInscritos.length > 0) {
            const fechaLegible = format(new Date(classItem.fecha), 'dd/MM');
            const hoy = new Date();

            const userPromises = classItem.usuariosInscritos.map(async (user) => {
                const tienePaseLibreActivo = user.paseLibreDesde && user.paseLibreHasta &&
                    hoy >= user.paseLibreDesde && hoy <= user.paseLibreHasta;

                let mensajeExtra = "";

                if (!tienePaseLibreActivo) {
                    const detalle = classItem.inscripcionesDetalle?.find(d => d.user.toString() === user._id.toString());
                    let creditoADevolverId = detalle?.tipoCreditoUsado ? detalle.tipoCreditoUsado.toString() : tipoClaseId.toString();

                    const currentCredits = user.creditosPorTipo.get(creditoADevolverId) || 0;
                    user.creditosPorTipo.set(creditoADevolverId, currentCredits + 1);
                    await user.save();
                    mensajeExtra = " Se te ha reembolsado 1 crédito.";
                }

                await sendSingleNotification(
                    Notification,
                    User,
                    user._id,
                    "Turno Eliminado",
                    `El turno de "${classItem.nombre}" del día ${fechaLegible} a las ${classItem.horaInicio}hs ha sido eliminado por el administrador.${mensajeExtra}`,
                    'class_deletion',
                    true,
                    null
                );
            });

            await Promise.all(userPromises);
        }

        await User.updateMany({ clasesInscritas: classItem._id }, { $pull: { clasesInscritas: classItem._id } });
        await classItem.deleteOne();

        if (capacity > 0) {
            await TipoClase.findByIdAndUpdate(tipoClaseId, {
                $inc: {
                    creditosTotales: -capacity,
                    creditosDisponibles: -capacity
                }
            });
        }

        res.json({ message: 'Turno eliminado correctamente.' });
    } else {
        res.status(404);
        throw new Error('Turno no encontrado.');
    }
});

const enrollUserInClass = asyncHandler(async (req, res) => {

    const { Clase, User, TipoClase, Notification } = getModels(req.gymDBConnection);
    const classId = req.params.id;
    const userId = req.user._id;

    const classItem = await Clase.findById(classId).populate('tipoClase');
    const user = await User.findById(userId);

    if (!classItem || !user) {
        res.status(404);
        throw new Error('Turno o usuario no encontrados.');
    }

    if (!classItem.tipoClase) {
        res.status(500); 
        throw new Error('El turno no tiene un tipo asociado, no se puede procesar la inscripción.');
    }

    if (classItem.tipoClase.esUniversal) {
        res.status(400);
        throw new Error('Error de sistema: No te puedes inscribir a una clase de tipo Universal.');
    }
    
    if (classItem.estado !== 'activa') {
        res.status(400);
        throw new Error(`No te puedes inscribir a un turno ${classItem.estado}.`);
    }
    if (classItem.usuariosInscritos.includes(userId)) {
        res.status(400);
        throw new Error('Ya estás inscrito en este turno.');
    }

    if (classItem.waitlist && classItem.waitlist.includes(userId)) {
        classItem.waitlist.pull(userId);
    }
    
    const fechaDelTurno = new Date(classItem.fecha);
    let tienePaseLibreValidoParaEsteTurno = false;

    if (user.paseLibreDesde && user.paseLibreHasta) {
        const inicioPase = new Date(user.paseLibreDesde);
        inicioPase.setHours(0, 0, 0, 0); 
        const finPase = new Date(user.paseLibreHasta);
        finPase.setHours(23, 59, 59, 999); 
        if (fechaDelTurno >= inicioPase && fechaDelTurno <= finPase) {
            tienePaseLibreValidoParaEsteTurno = true;
        }
    }
    
    let tipoCreditoADescontar = null; 
    let fechaVencimientoCapturada = null;

    if (!tienePaseLibreValidoParaEsteTurno) {
        const tipoClaseId = classItem.tipoClase._id.toString();
        let creditosEspecificos = user.creditosPorTipo.get(tipoClaseId) || 0;

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
                const uCreds = user.creditosPorTipo.get(uId) || 0;
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
            if (user.paseLibreHasta) {
                res.status(400);
                const fechaVencimiento = format(new Date(user.paseLibreHasta), 'dd/MM/yyyy');
                throw new Error(`Tu Pase Libre vence el ${fechaVencimiento} y este turno es posterior. Tampoco tienes créditos disponibles.`);
            } else {
                res.status(400);
                throw new Error(`No tienes un Pase Libre activo ni créditos disponibles para "${classItem.tipoClase.nombre}".`);
            }
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
    user.clasesInscritas.push(classId);

    user.markModified('creditosPorTipo');
    await user.save();
    await classItem.save();
    
    // El cliente recibe su éxito inmediatamente
    res.json({ message: 'Inscripción exitosa.', class: classItem });

    // Obtenemos los créditos restantes
    const tipoClaseId = classItem.tipoClase._id.toString();
    const creditosRestantes = user.creditosPorTipo.get(tipoClaseId);

    // Comprobamos si tiene 
    if (!tienePaseLibreValidoParaEsteTurno && creditosRestantes === 0) {

        setTimeout(async () => {
            try {
                const title = "¡Te quedaste sin créditos! ";
                const message = `Usaste tu último crédito para ${classItem.tipoClase.nombre}. `;

                await sendSingleNotification(
                    Notification, 
                    User, 
                    user._id, 
                    title, 
                    message, 
                    'out_of_credits',
                    true,
                );

                if (user.pushToken && Expo.isExpoPushToken(user.pushToken)) {
                    await expo.sendPushNotificationsAsync([{
                        to: user.pushToken,
                        sound: 'default',
                        title: title,
                        body: message,
                        data: { route: 'Packages' },
                    }]);
                    console.log(`Aviso de 0 créditos enviado a ${user.email}`);
                }
            } catch (error) {
                console.error("Error en la notificación retrasada de 0 créditos:", error);
            }
        }, 5000); 
    }
});

const unenrollUserFromClass = asyncHandler(async (req, res) => {
    const { Clase, User, Notification } = getModels(req.gymDBConnection);
    const classId = req.params.id;
    const userId = req.user._id;

    const clase = await Clase.findById(classId).populate('tipoClase'); 
    const user = await User.findById(userId);

    if (!clase || !user) {
        res.status(404);
        throw new Error('Turno o usuario no encontrados.');
    }

    const dateTimeString = `${clase.fecha.toISOString().substring(0, 10)}T${clase.horaInicio}:00-03:00`;
    const classStartDateTime = new Date(dateTimeString);
    const cancellationDeadline = subHours(classStartDateTime, 1);
    const now = new Date();

    if (now > cancellationDeadline) {
        res.status(400);
        throw new Error('No puedes anular la inscripción a menos de una hora del inicio del turno.');
    }

    const hoy = new Date();
    const tienePaseLibreActivo = user.paseLibreDesde && user.paseLibreHasta && 
                                 hoy >= user.paseLibreDesde && hoy <= user.paseLibreHasta;

   if (!tienePaseLibreActivo) {
        const detalle = clase.inscripcionesDetalle?.find(d => d.user.toString() === userId.toString());
        let creditoADevolverId = detalle?.tipoCreditoUsado ? detalle.tipoCreditoUsado.toString() : clase.tipoClase._id.toString();

        const currentCredits = user.creditosPorTipo.get(creditoADevolverId) || 0;
        user.creditosPorTipo.set(creditoADevolverId, currentCredits + 1);
        
        let fechaRestaurada;
        if (detalle && detalle.fechaVencimientoCredito) {
            fechaRestaurada = detalle.fechaVencimientoCredito;
        } else {
            const fechaDefault = new Date();
            fechaDefault.setDate(fechaDefault.getDate() + 30);
            fechaRestaurada = fechaDefault;
        }

        user.vencimientosDetallados.push({
            tipoClaseId: creditoADevolverId,
            cantidad: 1,
            fechaVencimiento: fechaRestaurada,
            idCarga: 'DEVOLUCION-CLASE' 
        });

        if (clase.inscripcionesDetalle) {
            clase.inscripcionesDetalle = clase.inscripcionesDetalle.filter(d => d.user.toString() !== userId.toString());
        }
        
        user.markModified('creditosPorTipo');
    }

    user.clasesInscritas.pull(classId);
    clase.usuariosInscritos.pull(userId);

    if (clase.estado === 'llena') {
        clase.estado = 'activa';
    }

    await user.save();
    
    if (clase.waitlist && clase.waitlist.length > 0) {
        const title = "¡Lugar Disponible!";
        const message = `Se ha liberado un lugar en el turno de "${clase.nombre || clase.tipoClase.nombre}" del día ${format(clase.fecha, 'dd/MM')} a las ${clase.horaInicio}hs. ¡Corre a inscribirte!`;

        for (const waitingUserId of clase.waitlist) {
            await sendSingleNotification(
                Notification,
                User,
                waitingUserId,
                title,
                message,
                'spot_available',
                true,
                clase._id
            );
        }
    }
    await clase.save();

    res.json({ message: 'Anulación exitosa. Se te devolvió 1 crédito.' });
});

const generateFutureFixedClasses = asyncHandler(async (req, res) => {
    const { Clase, TipoClase, User } = getModels(req.gymDBConnection);

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    const lastInstances = await Clase.aggregate([
        { $match: { tipoInscripcion: 'fijo', fecha: { $lte: now } } },
        { $sort: { fecha: -1 } },
        {
            $group: {
                _id: {
                    nombre: "$nombre",
                    tipoClase: "$tipoClase",
                    horaInicio: "$horaInicio",
                    horaFin: "$horaFin",
                    profesores: "$profesores"
                },
                lastInstance: { $first: "$$ROOT" }
            }
        }
    ]);

    if (lastInstances.length === 0) return 0;
    let classesGeneratedCount = 0;

    for (const group of lastInstances) {
        const pattern = group.lastInstance;
        
        if (!pattern.diaDeSemana || pattern.diaDeSemana.length === 0) continue;

        const rule = new RRule({
            freq: RRule.WEEKLY,
            byweekday: pattern.diaDeSemana.map(mapDayToRRule).filter(Boolean),
            dtstart: startDate,
            until: endDate,
        });

        const classDates = rule.all();

        for (const classDate of classDates) {
            const dateAtNoon = setNoonUTC(classDate);

            const existingClass = await Clase.findOne({
                nombre: pattern.nombre,
                tipoClase: pattern.tipoClase,
                fecha: dateAtNoon, 
                horaInicio: pattern.horaInicio,
            });

            if (!existingClass) {
                const classDayName = getDayName(dateAtNoon);

                const newClass = await Clase.create({
                    nombre: pattern.nombre,
                    tipoClase: pattern.tipoClase,
                    capacidad: pattern.capacidad,
                    profesores: pattern.profesores,
                    fecha: dateAtNoon, 
                    horaInicio: pattern.horaInicio,
                    horaFin: pattern.horaFin,
                    horarioFijo: pattern.horarioFijo,
                    diaDeSemana: [classDayName],
                    tipoInscripcion: 'fijo',
                    estado: 'activa',
                    usuariosInscritos: [], 
                    inscripcionesDetalle: [],
                });
                
                const usersWithPlan = await User.find({
                    isActive: true,
                    planesFijos: {
                        $elemMatch: {
                            tipoClase: pattern.tipoClase,
                            horaInicio: pattern.horaInicio,
                            diasDeSemana: classDayName,
                            fechaInicio: { $lte: dateAtNoon },
                            fechaFin: { $gte: dateAtNoon }
                        }
                    }
                });

                if (usersWithPlan.length > 0) {
                    const userIds = usersWithPlan.map(u => u._id);
                    newClass.usuariosInscritos = userIds;
                    
                    if (userIds.length >= newClass.capacidad) {
                        newClass.estado = 'llena';
                    }
                    await newClass.save();

                    await User.updateMany(
                        { _id: { $in: userIds } },
                        { $addToSet: { clasesInscritas: newClass._id } }
                    );
                }

                classesGeneratedCount++;
            }
        }
    }
    return classesGeneratedCount;
});

// --- LÓGICA INTELIGENTE IMPLEMENTADA AQUÍ ---
const bulkUpdateClasses = asyncHandler(async (req, res) => {
    // Añadimos User y Notification para poder hacer los reembolsos
    const { Clase, User, Notification } = getModels(req.gymDBConnection);
    const { filters, updates } = req.body;

    if (!filters || !updates || Object.keys(updates).length === 0) {
        res.status(400);
        throw new Error('Se requieren filtros y datos para actualizar.');
    }

    const fechaDesdeFiltro = new Date(`${filters.fechaDesde || new Date().toISOString().substring(0,10)}T00:00:00Z`);

    const query = {
        nombre: filters.nombre,
        tipoClase: filters.tipoClase,
        horaInicio: filters.horaInicio,
        fecha: { $gte: fechaDesdeFiltro }
    };

    const futureInstances = await Clase.find(query).sort({ fecha: 1 });
    if (futureInstances.length === 0) {
        res.status(404);
        throw new Error('No se encontraron clases futuras para modificar.');
    }

    // 1. Lógica inteligente: Verificar si los días de la semana REALMENTE cambiaron
    let daysChanged = false;
    if (updates.diasDeSemana && updates.diasDeSemana.length > 0) {
        // En la BD, cada instancia tiene guardado solo SU día (ej: ['Lunes']).
        // Tenemos que juntar los días de TODAS las instancias futuras para comparar con el array del frontend.
        const currentDaysSet = new Set();
        futureInstances.forEach(inst => {
            if (inst.diaDeSemana && inst.diaDeSemana.length > 0) {
                currentDaysSet.add(inst.diaDeSemana[0]);
            }
        });
        const currentDays = Array.from(currentDaysSet);
        
        const sortedCurrent = currentDays.sort().join(',');
        const sortedNew = [...updates.diasDeSemana].sort().join(',');
        
        if (sortedCurrent !== sortedNew) {
            daysChanged = true;
        }
    }

    // 2. Si cambiaron los días, hay que borrar y recrear (ahora REEMBOLSAMOS automáticamente)
    if (daysChanged) {
        const hoy = new Date();

        // Iteramos sobre todos los turnos futuros que van a ser eliminados
        for (const inst of futureInstances) {
            // Si el turno tiene alumnos inscriptos, procesamos devoluciones
            if (inst.usuariosInscritos && inst.usuariosInscritos.length > 0) {
                const fechaLegible = format(new Date(inst.fecha), 'dd/MM');
                const tipoClaseIdStr = inst.tipoClase.toString();

                for (const userId of inst.usuariosInscritos) {
                    const user = await User.findById(userId);
                    if (!user) continue;

                    const tienePaseLibreActivo = user.paseLibreDesde && user.paseLibreHasta &&
                        hoy >= user.paseLibreDesde && hoy <= user.paseLibreHasta;

                    let mensajeExtra = "";

                    // Devolución de crédito si no tiene pase libre
                    if (!tienePaseLibreActivo) {
                        const detalle = inst.inscripcionesDetalle?.find(d => d.user.toString() === userId.toString());
                        let creditoADevolverId = detalle?.tipoCreditoUsado ? detalle.tipoCreditoUsado.toString() : tipoClaseIdStr;

                        const currentCredits = user.creditosPorTipo.get(creditoADevolverId) || 0;
                        user.creditosPorTipo.set(creditoADevolverId, currentCredits + 1);
                        await user.save();
                        mensajeExtra = " Se te ha reembolsado 1 crédito.";
                    }

                    // Notificación al usuario
                    await sendSingleNotification(
                        Notification,
                        User,
                        user._id,
                        "Turno Reprogramado/Cancelado",
                        `El administrador ha modificado los días del turno "${inst.nombre}". La clase del ${fechaLegible} a las ${inst.horaInicio}hs ha sido cancelada.${mensajeExtra}`,
                        'class_deletion',
                        false,
                        null
                    );
                }
                
                // Sacamos este turno de la lista de clases inscritas de los usuarios
                await User.updateMany({ clasesInscritas: inst._id }, { $pull: { clasesInscritas: inst._id } });
            }
        }

        const template = futureInstances[0].toObject();
        const idsToDelete = futureInstances.map(inst => inst._id);
        
        await Clase.deleteMany({ _id: { $in: idsToDelete } });

        if (updates.profesores) template.profesores = updates.profesores;
        if (updates.horaInicio) template.horaInicio = updates.horaInicio;
        if (updates.horaFin) template.horaFin = updates.horaFin;
        if (updates.capacidad !== undefined) template.capacidad = Number(updates.capacidad); 

        if (updates.horaInicio && updates.horaFin) {
            template.horarioFijo = `${updates.horaInicio} - ${updates.horaFin}`;
        }
        
        const ruleStart = new Date(fechaDesdeFiltro);
        ruleStart.setUTCHours(12, 0, 0, 0); 

        const lastDate = futureInstances[futureInstances.length - 1].fecha;
        const ruleUntil = new Date(lastDate);
        ruleUntil.setUTCHours(23, 59, 59, 999); 

        const rule = new RRule({
            freq: RRule.WEEKLY,
            byweekday: updates.diasDeSemana.map(day => mapDayToRRule(day)).filter(Boolean),
            dtstart: ruleStart, 
            until: ruleUntil
        });
        
        const newDates = rule.all();
        for (const date of newDates) {
            const dateAtNoon = setNoonUTC(date);
            await Clase.create({
                ...template,
                _id: new mongoose.Types.ObjectId(),
                fecha: dateAtNoon,
                diaDeSemana: [getDayName(dateAtNoon)], 
                usuariosInscritos: [],
                inscripcionesDetalle: [],
                estado: 'activa',
            });
        }
        return res.json({ message: 'Días del turno actualizados.', eliminadas: idsToDelete.length, creadas: newDates.length });
    } 
    
    // 3. ACTUALIZACIÓN SEGURA: Si los días son los mismos, solo actualizamos los campos 
    const updateData = { $set: {} };
    if (updates.profesores) updateData.$set.profesores = updates.profesores;
    if (updates.horaInicio) updateData.$set.horaInicio = updates.horaInicio;
    if (updates.horaFin) updateData.$set.horaFin = updates.horaFin;
    if (updates.capacidad !== undefined) updateData.$set.capacidad = Number(updates.capacidad); 
    
    if (updates.horaInicio && updates.horaFin) {
        updateData.$set.horarioFijo = `${updates.horaInicio} - ${updates.horaFin}`;
    }

    const result = await Clase.updateMany(query, updateData);
    res.json({ message: 'Operación completada de forma segura.', actualizadas: result.modifiedCount, encontradas: result.matchedCount });
});

const bulkDeleteClasses = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const { filters } = req.body;

    if (!filters) {
        res.status(400);
        throw new Error('Se requieren filtros para la eliminación en lote.');
    }

    const query = {};
    if (filters.nombre) query.nombre = { $regex: filters.nombre, $options: 'i' };
    if (filters.tipoClase) query.tipoClase = filters.tipoClase;
    if (filters.horaInicio) query.horaInicio = filters.horaInicio;

    const startDate = filters.fechaDesde ? new Date(filters.fechaDesde) : new Date();
    startDate.setHours(0, 0, 0, 0);
    query.fecha = { $gte: startDate };

    const result = await Clase.deleteMany(query);

    if (result.deletedCount === 0) {
        res.status(404);
        throw new Error('No se encontraron turnos que coincidan con los filtros para eliminar.');
    }

    res.json({
        message: 'Turnos eliminados exitosamente.',
        eliminadas: result.deletedCount,
    });
});

const getGroupedClasses = asyncHandler(async (req, res) => {
    const { Clase, TipoClase, User } = getModels(req.gymDBConnection);

    const groupedClasses = await Clase.aggregate([
        { $match: { rrule: { $exists: true, $ne: null }, fecha: { $gte: new Date() } } },
        { $sort: { fecha: 1 } },
        {
            $group: {
                _id: { rrule: "$rrule" },
                nombre: { $first: "$nombre" },
                horaInicio: { $first: "$horaInicio" },
                horaFin: { $first: "$horaFin" },
                tipoClase: { $first: "$tipoClase" },
                capacidad: { $first: "$capacidad" }, // AÑADIDO PARA LEER CAPACIDAD ACTUAL
                profesoresIds: { $first: "$profesores" }, 
                diasDeSemana: { $addToSet: {
                    $cond: {
                        if: { $isArray: "$diaDeSemana" },
                        then: { $arrayElemAt: ["$diaDeSemana", 0] },
                        else: null
                    }
                }},
                cantidadDeInstancias: { $sum: 1 }
            }
        },
        { $addFields: { diasDeSemana: { $filter: { input: "$diasDeSemana", as: "day", cond: { $ne: ["$$day", null] } } } } },
        { $lookup: { from: User.collection.name, localField: 'profesoresIds', foreignField: '_id', as: 'profesoresInfo'} },
        { $lookup: { from: TipoClase.collection.name, localField: 'tipoClase', foreignField: '_id', as: 'tipoClaseInfo' } },
        {
            $project: {
                _id: 0,
                rrule: '$_id.rrule',
                nombre: '$nombre',
                horaInicio: '$horaInicio',
                horaFin: '$horaFin',
                capacidad: '$capacidad', // AÑADIDO PARA ENVIARLA AL FRONTEND
                tipoClase: { $arrayElemAt: ['$tipoClaseInfo', 0] },
                profesores: '$profesoresInfo',
                diasDeSemana: '$diasDeSemana',
                cantidadDeInstancias: '$cantidadDeInstancias'
            }
        }
    ]);

    res.json(groupedClasses);
});

const bulkExtendClasses = asyncHandler(async (req, res) => {
    const { Clase, User } = getModels(req.gymDBConnection);
    const { filters, extension } = req.body;
    const { nombre, tipoClase, horaInicio, diasDeSemana } = filters; 

    if (!filters || !extension || !extension.fechaFin || !diasDeSemana || diasDeSemana.length === 0) {
        res.status(400);
        throw new Error('Se requieren filtros, una fecha final de extensión y los días de la semana para la extensión.');
    }

    const lastInstance = await Clase.findOne({
        nombre: nombre,
        tipoClase: tipoClase,
        horaInicio: horaInicio
    }).sort({ fecha: -1 });

    if (!lastInstance) {
        res.status(404);
        throw new Error('No se encontró un turno existente que coincide con los filtros para usar como plantilla.');
    }

    const startDate = new Date(lastInstance.fecha);
    startDate.setDate(startDate.getDate() + 1); 
    const endDate = new Date(extension.fechaFin);

    if (startDate > endDate) {
        res.status(400);
        throw new Error('La fecha de extensión debe ser posterior a la último turno existente.');
    }

    const rule = new RRule({
        freq: RRule.WEEKLY,
        byweekday: diasDeSemana.map(day => mapDayToRRule(day)).filter(Boolean), 
        dtstart: startDate,
        until: endDate,
    });

    const newDates = rule.all();
    let createdCount = 0;

    for (const date of newDates) {
        const dateAtNoon = setNoonUTC(date);
        const classDayName = getDayName(dateAtNoon);

        const newClass = await Clase.create({
            nombre: lastInstance.nombre,
            tipoClase: lastInstance.tipoClase,
            horarioFijo: lastInstance.horarioFijo,
            diaDeSemana: [classDayName], 
            tipoInscripcion: lastInstance.tipoInscripcion,
            capacidad: lastInstance.capacidad,
            profesores: lastInstance.profesores,
            fecha: dateAtNoon, 
            horaInicio: lastInstance.horaInicio,
            horaFin: lastInstance.horaFin,
            estado: 'activa',
            usuariosInscritos: [],
            inscripcionesDetalle: [],
            rrule: lastInstance.rrule 
        });

        const usersWithPlan = await User.find({
            isActive: true,
            planesFijos: {
                $elemMatch: {
                    tipoClase: lastInstance.tipoClase,
                    horaInicio: lastInstance.horaInicio,
                    diasDeSemana: classDayName,
                    fechaInicio: { $lte: dateAtNoon },
                    fechaFin: { $gte: dateAtNoon }
                }
            }
        });

        if (usersWithPlan.length > 0) {
            const userIds = usersWithPlan.map(u => u._id);
            newClass.usuariosInscritos = userIds;
            
            if (userIds.length >= newClass.capacidad) {
                newClass.estado = 'llena';
            }
            await newClass.save();

            await User.updateMany(
                { _id: { $in: userIds } },
                { $addToSet: { clasesInscritas: newClass._id } }
            );
        }

        createdCount++;
    }

    res.json({ message: 'Turnos extendidos exitosamente.', creadas: createdCount });
});

const cancelClassesByDate = asyncHandler(async (req, res) => {
    const { date, refundCredits } = req.body; 
    const { Clase, User, Notification } = getModels(req.gymDBConnection); 

    if (!date) {
        res.status(400);
        throw new Error('Se requiere una fecha para cancelar los turnos.');
    }

    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    const classesToCancel = await Clase.find({
        fecha: { $gte: startOfDay, $lte: endOfDay },
        estado: 'activa'
    }).populate('tipoClase');

    if (classesToCancel.length === 0) {
        return res.status(404).json({ message: 'No se encontraron turnos activos para cancelar en esa fecha.' });
    }

    const allAffectedUserIds = new Set();
    
    for (const classItem of classesToCancel) {
        classItem.estado = 'cancelada';
        
        if (refundCredits && classItem.usuariosInscritos.length > 0) {
            for (const userId of classItem.usuariosInscritos) {
                allAffectedUserIds.add(userId.toString());
                const user = await User.findById(userId);
                
                if (user) {
                     const detalle = classItem.inscripcionesDetalle?.find(d => d.user.toString() === userId.toString());
                     let creditoADevolverId = detalle?.tipoCreditoUsado ? detalle.tipoCreditoUsado.toString() : classItem.tipoClase?._id?.toString();

                     if (creditoADevolverId) {
                         const currentCredits = user.creditosPorTipo.get(creditoADevolverId) || 0;
                         user.creditosPorTipo.set(creditoADevolverId, currentCredits + 1);
                         await user.save();
                     }
                }
            }
            classItem.usuariosInscritos = [];
            classItem.inscripcionesDetalle = [];
        }
        await classItem.save();
    }

    if (allAffectedUserIds.size > 0) {
        const notificationMessage = `Atención: Todas los turnos del día ${startOfDay.toLocaleDateString('es-AR')} han sido cancelados. ${refundCredits ? 'Se te ha reembolsado el crédito por los turnos a los que estabas inscrito.' : ''}`;
        const notificationPromises = Array.from(allAffectedUserIds).map(userId =>
            sendSingleNotification(Notification, User, userId, "Clases Canceladas", notificationMessage, 'class_cancellation', true)
        );
        await Promise.all(notificationPromises);
    }

    res.status(200).json({
        message: `Se cancelaron ${classesToCancel.length} turnos. ${refundCredits ? 'Se procesaron los reembolsos.' : ''}`
    });
});

const reactivateClassesByDate = asyncHandler(async (req, res) => {
    const { date } = req.body;
    const { Clase } = getModels(req.gymDBConnection);
    
    if (!date) {
        res.status(400);
        throw new Error('Se requiere una fecha para reactivar los turnos.');
    }
    
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    const result = await Clase.updateMany(
        { fecha: { $gte: startOfDay, $lte: endOfDay }, estado: 'cancelada' },
        { $set: { estado: 'activa' } }
    );

    if (result.modifiedCount === 0) {
        return res.status(404).json({ message: 'No se encontraron turnos cancelados para reactivar en esa fecha.' });
    }
    
    res.status(200).json({ message: `Se reactivaron ${result.modifiedCount} turnos.` });
});

const getAvailableSlotsForPlan = asyncHandler(async (req, res) => {
    const { Clase, TipoClase, User } = getModels(req.gymDBConnection);
    const { tipoClaseId, diasDeSemana, fechaInicio } = req.query;
    let { fechaFin } = req.query;

    if (!fechaFin) {
        fechaFin = fechaInicio;
    }

    if (!tipoClaseId || !diasDeSemana || !fechaInicio) {
        res.status(400);
        throw new Error('Faltan parámetros de búsqueda.');
    }
    const diasArray = diasDeSemana.split(',');

    const availableSlots = await Clase.aggregate([
        {
            $match: {
                tipoClase: new mongoose.Types.ObjectId(tipoClaseId),
                fecha: {
                    $gte: new Date(`${fechaInicio}T00:00:00Z`),
                    $lte: new Date(`${fechaFin}T23:59:59Z`),
                },
                estado: 'activa',
            }
        },
        { 
            $group: { 
                _id: { 
                    nombre: '$nombre',
                    tipoClase: '$tipoClase',
                    horaInicio: '$horaInicio', 
                    horaFin: '$horaFin',
                    profesoresIds: '$profesores'
                } 
            } 
        },
        {
            $lookup: {
                from: TipoClase.collection.name,
                localField: '_id.tipoClase',
                foreignField: '_id',
                as: 'tipoClaseInfo'
            }
        },
        {
            $lookup: {
                from: User.collection.name,
                localField: '_id.profesoresIds',
                foreignField: '_id',
                as: 'profesoresInfo'
            }
        },
        {
            $project: {
                _id: 0, 
                nombre: '$_id.nombre',
                horaInicio: '$_id.horaInicio',
                horaFin: '$_id.horaFin',
                tipoClase: { $arrayElemAt: ['$tipoClaseInfo', 0] },
                profesores: '$profesoresInfo' 
            }
        },
        { $sort: { horaInicio: 1 } }
    ]);
    
    res.status(200).json(availableSlots);
});

const subscribeToWaitlist = asyncHandler(async (req, res) => {
    const { Clase, Notification, User } = getModels(req.gymDBConnection);
    const clase = await Clase.findById(req.params.id);

    if (!clase) {
        res.status(404);
        throw new Error('Turno no encontrado.');
    }

    if ((clase.usuariosInscritos || []).length < clase.capacidad) {
        res.status(400);
        throw new Error('No puedes apuntarte a la lista de espera, el turno aún tiene lugares.');
    }

    if (!clase.waitlist) clase.waitlist = [];

    if (clase.waitlist.includes(req.user._id)) {
        return res.status(200).json({ message: 'Ya estás en la lista de espera.' });
    }
    
    clase.waitlist.push(req.user._id);

    try {
        const title = `Confirmación de lista de espera`;
        const message = `Te has apuntado a la lista de espera para el turno de "${clase.nombre}" del día ${format(new Date(clase.fecha), 'dd/MM')}. ¡Te avisaremos si se libera un lugar!`;

        await sendSingleNotification(
            Notification, User, req.user._id, title, message, 'waitlist_subscription', true, clase._id
        );
    } catch (notificationError) {
        console.error('Error al enviar la notificación de suscripción a la lista de espera:', notificationError);
    }

    await clase.save();
    res.status(200).json({ message: 'Te has apuntado a la lista de espera. Se te notificará si hay un lugar.' });
});

const unsubscribeFromWaitlist = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const clase = await Clase.findById(req.params.id);

    if (clase) {
        if (clase.waitlist && clase.waitlist.includes(req.user._id)) {
            clase.waitlist.pull(req.user._id); 
            await clase.save();
        }
    }
    res.status(200).json({ message: 'Has sido removido de la lista de espera.' });
});

const getProfessorClasses = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const professorId = req.user._id;

    const classes = await Clase.find({ 
        $or: [{ profesores: professorId }, { profesor: professorId }]
    })
        .populate('tipoClase', 'nombre' )
        .populate('profesores', 'nombre apellido') 
        .populate('usuariosInscritos', 'nombre apellido dni email ')
        .sort({ fecha: 'asc' }); 

    res.status(200).json(classes);
});

const getClassStudents = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const classId = req.params.id;
    
    const classItem = await Clase.findById(classId)
        .populate({
            path: 'usuariosInscritos',
            select: 'nombre apellido dni email numeroTelefono fechaNacimiento telefonoEmergencia obraSocial ordenMedicaRequerida ordenMedicaEntregada', 
        })
        .select('profesores profesor usuariosInscritos'); 

    if (!classItem) {
        res.status(404);
        throw new Error('Turno no encontrada.');
    }

    const isTheProfessor = (classItem.profesores && classItem.profesores.includes(req.user._id)) || classItem.profesor?.toString() === req.user._id.toString();
    const isAdmin = req.user.roles.includes('admin');

    if (!isTheProfessor && !isAdmin) {
        res.status(403); 
        throw new Error('No tienes autorización para ver los alumnos de este turno.');
    }

    res.status(200).json(classItem.usuariosInscritos);
});

const checkInUser = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const { userId } = req.body; 
    const classId = req.params.id; 

    if (!userId) {
        res.status(400);
        throw new Error('No se proporcionó un ID de usuario.');
    }

    const classItem = await Clase.findById(classId).populate('usuariosInscritos', 'nombre apellido');

    if (!classItem) {
        res.status(404);
        throw new Error('Turno no encontrado.');
    }

    const userIsEnrolled = classItem.usuariosInscritos.some(user => user._id.toString() === userId);
    
    if (userIsEnrolled) {
        const enrolledUser = classItem.usuariosInscritos.find(user => user._id.toString() === userId);
        res.status(200).json({
            success: true,
            message: 'Habilitado',
            userName: `${enrolledUser.nombre} ${enrolledUser.apellido}`,
        });
    } else {
        res.status(403).json({ 
            success: false,
            message: 'Usuario no inscripto.',
        });
    }
});

const addUserToClass = asyncHandler(async (req, res) => {
    const { Clase, User, Notification } = getModels(req.gymDBConnection);
    const { userId } = req.body;

    const clase = await Clase.findById(req.params.id).populate('tipoClase', 'nombre'); 
    const user = await User.findById(userId);

    if (!clase || !user) {
        res.status(404);
        throw new Error('Clase o usuario no encontrado.');
    }
    
    clase.usuariosInscritos.push(userId);
    user.clasesInscritas.push(clase._id);

    await clase.save();
    await user.save();

    const title = "Te han inscripto a un turno";
    const message = `Se te ha añadido al turno de "${clase.tipoClase.nombre}" el día ${format(clase.fecha, 'dd/MM')} a las ${clase.horaInicio}hs.`;
    await sendSingleNotification(Notification, User, userId, title, message, 'manual_enrollment');

    res.status(200).json({ message: 'Usuario añadido a la clase.' });
});

const removeUserFromClass = asyncHandler(async (req, res) => {
    const { Clase, User, Notification } = getModels(req.gymDBConnection);
    const { userId } = req.body;

    const clase = await Clase.findById(req.params.id).populate('tipoClase', 'nombre'); 
    const user = await User.findById(userId);

    if (!clase || !user) {
        res.status(404);
        throw new Error('Clase o usuario no encontrado.');
    }
    
    clase.usuariosInscritos.pull(userId);
    if (clase.inscripcionesDetalle) {
        clase.inscripcionesDetalle = clase.inscripcionesDetalle.filter(
            d => d.user.toString() !== userId.toString()
        );
    }
    user.clasesInscritas.pull(clase._id);

    await clase.save();
    await user.save();

    const title = "Anulación de turno";
    const message = `Se te ha dado de baja del turno de "${clase.tipoClase.nombre}" del día ${format(clase.fecha, 'dd/MM')} a las ${clase.horaInicio}hs.`;
    await sendSingleNotification(Notification, User, userId, title, message, 'manual_unenrollment');

    res.status(200).json({ message: 'Usuario eliminado de la clase.' });
});

export {
    createClass,
    getAllClasses,
    getClassById,
    updateClass,
    deleteClass,
    enrollUserInClass,
    unenrollUserFromClass,
    cancelClassInstance,
    reactivateClass,
    generateFutureFixedClasses, 
    bulkUpdateClasses,
    bulkDeleteClasses,
    getGroupedClasses,
    bulkExtendClasses,
    cancelClassesByDate,
    reactivateClassesByDate,
    getAvailableSlotsForPlan,
    unsubscribeFromWaitlist,
    subscribeToWaitlist,
    getProfessorClasses,
    getClassStudents,
    checkInUser,
    getAllClassesAdmin,
    addUserToClass,
    removeUserFromClass,
};