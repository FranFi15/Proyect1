// src/controllers/classController.js
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
        // Tipo libre (fecha única)
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
                    rrule: rule.toString() 
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
            tipoInscripcion: 'libre' 
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
    // 1. Obtenemos la configuración del gimnasio
    const settings = await Settings.findById('main_settings');
    const visibilityDays = settings?.classVisibilityDays;

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    // Usamos 'today' (00:00hs) en lugar de 'new Date()' (hora actual)
    let dateFilter = {};
    
    if (includePast !== 'true') {
        dateFilter = { fecha: { $gte: today } }; 
        
        if (visibilityDays && visibilityDays > 0) {
            const limitDate = new Date(today);
            limitDate.setDate(today.getDate() + visibilityDays);
            dateFilter.fecha = { ...dateFilter.fecha, $lt: limitDate };
        }
    }

    // 3. Aplicamos el filtro y usamos tu populate optimizado
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
    const { capacidad,profesores, ...otherUpdates } = req.body;
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
                `Tu turno de "${updatedClass.tip}" del día ${fechaLegible} ha sido reprogramado a las ${updatedClass.horaInicio}hs.`,
                'class_update', // Tipo nuevo
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
                    
                    let creditoADevolverId;
                    if (detalle && detalle.tipoCreditoUsado) {
                        creditoADevolverId = detalle.tipoCreditoUsado.toString();
                    } else {
                        creditoADevolverId = classItem.tipoClase._id.toString();
                    }

                    const currentCredits = user.creditosPorTipo.get(creditoADevolverId) || 0;
                    user.creditosPorTipo.set(creditoADevolverId, currentCredits + 1);
                    await user.save();

                    if (classItem.inscripcionesDetalle) {
                        classItem.inscripcionesDetalle = classItem.inscripcionesDetalle.filter(d => d.user.toString() !== userId.toString());
                    }

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
    }
    classItem.usuariosInscritos = [];
    classItem.inscripcionesDetalle = []; 
    await classItem.save();
    res.json({ message: 'Turno cancelada exitosamente.', class: classItem });
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
                    let creditoADevolverId;
                    
                    if (detalle && detalle.tipoCreditoUsado) {
                        creditoADevolverId = detalle.tipoCreditoUsado.toString();
                    } else {
                        creditoADevolverId = tipoClaseId.toString();
                    }

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
    const { Clase, User, TipoClase } = getModels(req.gymDBConnection);
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

    if (tienePaseLibreValidoParaEsteTurno) {
    } else {
        
        const tipoClaseId = classItem.tipoClase._id.toString();
        let creditosEspecificos = user.creditosPorTipo.get(tipoClaseId) || 0;
        if (creditosEspecificos > 0) {
            user.creditosPorTipo.set(tipoClaseId, creditosEspecificos - 1);
            tipoCreditoADescontar = classItem.tipoClase._id; 
        } else {
            const universalType = await TipoClase.findOne({ esUniversal: true });
            
            if (universalType) {
                const universalTypeId = universalType._id.toString();
                const creditosUniversales = user.creditosPorTipo.get(universalTypeId) || 0;
                
                if (creditosUniversales > 0) {
                    user.creditosPorTipo.set(universalTypeId, creditosUniversales - 1);
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
            tipoCreditoUsado: tipoCreditoADescontar
        });
    }

    if (classItem.usuariosInscritos.length >= classItem.capacidad) {
        classItem.estado = 'llena';
    }
    user.clasesInscritas.push(classId);

    await user.save();
    await classItem.save();
    res.json({ message: 'Inscripción exitosa.', class: classItem });
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

    // --- ¡LÓGICA DE TIEMPO DEFINITIVA Y SIMPLIFICADA! ---
    
    // 1. Creamos un string con la fecha, la hora Y la zona horaria de Argentina (-03:00).
    const dateTimeString = `${clase.fecha.toISOString().substring(0, 10)}T${clase.horaInicio}:00-03:00`;
    
    // 2. JavaScript ahora entiende perfectamente que esta es la hora de Argentina y la convierte
    //    a la hora universal (UTC) correcta para poder compararla.
    const classStartDateTime = new Date(dateTimeString);

    // 3. Calculamos el límite de cancelación (1 hora antes).
    const cancellationDeadline = subHours(classStartDateTime, 1);
    
    // 4. Obtenemos la hora actual del servidor (que también está en UTC).
    const now = new Date();

    // 5. La comparación ahora es 100% precisa.
    if (now > cancellationDeadline) {
        res.status(400);
        throw new Error('No puedes anular la inscripción a menos de una hora del inicio del turno.');
    }

    const hoy = new Date();
    const tienePaseLibreActivo = user.paseLibreDesde && user.paseLibreHasta && 
                                 hoy >= user.paseLibreDesde && hoy <= user.paseLibreHasta;


   if (!tienePaseLibreActivo) {
        // --- MODIFICADO: BUSCAR QUÉ CRÉDITO USÓ Y DEVOLVER ESE MISMO ---
        const detalle = clase.inscripcionesDetalle?.find(d => d.user.toString() === userId.toString());

        if (detalle && detalle.tipoCreditoUsado) {
            const creditoADevolverId = detalle.tipoCreditoUsado.toString();
            const currentCredits = user.creditosPorTipo.get(creditoADevolverId) || 0;
            user.creditosPorTipo.set(creditoADevolverId, currentCredits + 1);
            
            // Borrar el detalle
            clase.inscripcionesDetalle = clase.inscripcionesDetalle.filter(d => d.user.toString() !== userId.toString());
        } else {
            // Fallback para turnos viejos
            if (clase.tipoClase && clase.tipoClase._id) {
                const tipoClaseId = clase.tipoClase._id.toString();
                const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
                user.creditosPorTipo.set(tipoClaseId, currentCredits + 1);
            }
        }
        user.markModified('creditosPorTipo');
    }

    user.clasesInscritas.pull(classId);
    clase.usuariosInscritos.pull(userId);

    if (clase.estado === 'llena') {
        clase.estado = 'activa';
    }

    await user.save();
    
    // Lista de espera
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


// @desc    Generar futuras instancias de clases fijas para un gimnasio específico
// Esta función será llamada por el cron job para cada gimnasio activo.
const generateFutureFixedClasses = asyncHandler(async (req, res) => {
    const { Clase, TipoClase } = getModels(req.gymDBConnection);

    // 1. DEFINIR EL PERÍODO A GENERAR
    // Generaremos las clases para el mes siguiente al actual.
    const now = new Date();
    // El primer día del mes que viene
    const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    // El último día del mes que viene
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);

   

    // 2. ENCONTRAR LAS CLASES FIJAS "PATRÓN"
    // Buscamos la última instancia de cada clase fija para usarla como plantilla.
    // Usamos una agregación de MongoDB para agrupar por lo que hace única a una clase recurrente.
    const lastInstances = await Clase.aggregate([
        // Filtrar solo clases fijas del pasado reciente para usarlas como plantilla
        { $match: { tipoInscripcion: 'fijo', fecha: { $lte: now } } },
        // Ordenar para que la más reciente de cada grupo quede primera
        { $sort: { fecha: -1 } },
        // Agrupar por lo que define a una clase recurrente (nombre, tipo, horario, profesor)
        {
            $group: {
                _id: {
                    nombre: "$nombre",
                    tipoClase: "$tipoClase",
                    horaInicio: "$horaInicio",
                    horaFin: "$horaFin",
                    profesores: "$profesores"
                },
                // Nos quedamos con los datos del documento más reciente de cada grupo
                lastInstance: { $first: "$$ROOT" }
            }
        }
    ]);

    if (lastInstances.length === 0) {
        return 0;
    }

    let classesGeneratedCount = 0;

    // 3. ITERAR SOBRE CADA "PLANTILLA" Y GENERAR LAS NUEVAS CLASES
    for (const group of lastInstances) {
        const pattern = group.lastInstance;
        
        // No podemos generar clases si la plantilla no tiene días de la semana definidos.
        if (!pattern.diaDeSemana || pattern.diaDeSemana.length === 0) {
            console.warn(`[Cron Job] Saltando patrón "${pattern.nombre}" porque no tiene días de la semana definidos.`);
            continue;
        }

        const rule = new RRule({
            freq: RRule.WEEKLY,
            byweekday: pattern.diaDeSemana.map(mapDayToRRule).filter(Boolean), // Filtramos por si hay algún día inválido
            dtstart: startDate,
            until: endDate,
        });

        const classDates = rule.all();

        for (const classDate of classDates) {
            // Verificar si ya existe una clase para esa fecha y hora EXACTAS
            const existingClass = await Class.findOne({
                nombre: pattern.nombre,
                tipoClase: pattern.tipoClase,
                fecha: classDate,
                horaInicio: pattern.horaInicio,
            });

            if (!existingClass) {
                // Si no existe, la creamos
                await Clase.create({
                    nombre: pattern.nombre,
                    tipoClase: pattern.tipoClase,
                    capacidad: pattern.capacidad,
                    profesores: pattern.profesores,
                    fecha: classDate,
                    horaInicio: pattern.horaInicio,
                    horaFin: pattern.horaFin,
                    horarioFijo: pattern.horarioFijo,
                    diaDeSemana: [getDayName(classDate.getDay())],
                    tipoInscripcion: 'fijo',
                    estado: 'activa',
                    usuariosInscritos: [],
                    inscripcionesDetalle: [],
                });
                classesGeneratedCount++;
            }
        }
    }

    return classesGeneratedCount;
});
const bulkUpdateClasses = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
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

    if (updates.diasDeSemana) {
        const futureInstances = await Clase.find(query).sort({ fecha: 1 });
        if (futureInstances.length === 0) {
            res.status(404);
            throw new Error('No se encontraron clases futuras para modificar los días.');
        }

        const template = futureInstances[0].toObject();
        const idsToDelete = futureInstances.map(inst => inst._id);
        
        await Clase.deleteMany({ _id: { $in: idsToDelete } });

        if (updates.profesores) template.profesores = updates.profesores;
        if (updates.horaInicio) template.horaInicio = updates.horaInicio;
        if (updates.horaFin) template.horaFin = updates.horaFin;
        if (updates.horaInicio && updates.horaFin) {
            template.horarioFijo = `${updates.horaInicio} - ${updates.horaFin}`;
        }
        
       const ruleStart = new Date(fechaDesdeFiltro);
        ruleStart.setUTCHours(12, 0, 0, 0); // <-- FORZAR MEDIODÍA

        const lastDate = futureInstances[futureInstances.length - 1].fecha;
        const ruleUntil = new Date(lastDate);
        ruleUntil.setUTCHours(23, 59, 59, 999); // Asegurar final del día

        const rule = new RRule({
            freq: RRule.WEEKLY,
            byweekday: updates.diasDeSemana.map(day => mapDayToRRule(day)).filter(Boolean),
            dtstart: ruleStart, // Usamos la fecha corregida a las 12:00
            until: ruleUntil
        });
        
        const newDates = rule.all();
        for (const date of newDates) {
            // 3. Asegurar que las nuevas fechas también estén a las 12:00 UTC (RRule hereda dtstart, así que debería estar bien, pero por seguridad:)
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
    
    const updateData = { $set: {} };
    if (updates.profesores) updateData.$set.profesores = updates.profesores;
    if (updates.horaInicio) updateData.$set.horaInicio = updates.horaInicio;
    if (updates.horaFin) updateData.$set.horaFin = updates.horaFin;
    if (updates.horaInicio && updates.horaFin) {
        updateData.$set.horarioFijo = `${updates.horaInicio} - ${updates.horaFin}`;
    }

    const result = await Clase.updateMany(query, updateData);
    res.json({ message: 'Operación completada.', actualizadas: result.modifiedCount, encontradas: result.matchedCount });
});

// @desc    Eliminar múltiples clases en lote basado en filtros
// @route   POST /api/classes/bulk-delete
// @access  Private/Admin
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
                _id: { rrule: "$rrule" }, // Agrupamos por la regla única
                nombre: { $first: "$nombre" },
                horaInicio: { $first: "$horaInicio" },
                horaFin: { $first: "$horaFin" },
                tipoClase: { $first: "$tipoClase" },
                profesoresIds: { $first: "$profesores" }, 
                diasDeSemana: { $addToSet: {
                    // --- LÓGICA A PRUEBA DE ERRORES ---
                    // Si 'diaDeSemana' es un array, toma el primer elemento. Si no (es texto o nulo), ignóralo.
                    $cond: {
                        if: { $isArray: "$diaDeSemana" },
                        then: { $arrayElemAt: ["$diaDeSemana", 0] },
                        else: null
                    }
                }},
                cantidadDeInstancias: { $sum: 1 }
            }
        },
        // Filtramos los 'null' que se pudieron haber añadido si había datos malos
        { $addFields: { diasDeSemana: { $filter: { input: "$diasDeSemana", as: "day", cond: { $ne: ["$$day", null] } } } } },
        
        // El resto de la consulta para poblar los datos
        { $lookup: { from: User.collection.name, localField: 'profesoresIds', foreignField: '_id', as: 'profesoresInfo'} },
        { $lookup: { from: TipoClase.collection.name, localField: 'tipoClase', foreignField: '_id', as: 'tipoClaseInfo' } },
        {
            $project: {
                _id: 0,
                rrule: '$_id.rrule',
                nombre: '$nombre',
                horaInicio: '$horaInicio',
                horaFin: '$horaFin',
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
    const { Clase } = getModels(req.gymDBConnection);
    // Desestructuramos para obtener los 'diasDeSemana' directamente de los filtros
    const { filters, extension } = req.body;
    const { nombre, tipoClase, horaInicio, diasDeSemana } = filters; // AÑADIDO: diasDeSemana de los filtros

    if (!filters || !extension || !extension.fechaFin || !diasDeSemana || diasDeSemana.length === 0) {
        res.status(400);
        throw new Error('Se requieren filtros, una fecha final de extensión y los días de la semana para la extensión.');
    }

    // Buscamos la *última* instancia de este grupo para obtener su fecha final
    // y otros datos como capacidad, profesor, etc., que son comunes a todas las instancias.
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
    startDate.setDate(startDate.getDate() + 1); // Empezar un día después de la última clase existente
    const endDate = new Date(extension.fechaFin);

    if (startDate > endDate) {
        res.status(400);
        throw new Error('La fecha de extensión debe ser posterior a la último turno existente.');
    }

    const rule = new RRule({
        freq: RRule.WEEKLY,
        byweekday: diasDeSemana.map(day => mapDayToRRule(day)).filter(Boolean), // USAMOS diasDeSemana DEL FILTRO
        dtstart: startDate,
        until: endDate,
    });

    const newDates = rule.all();
    let createdCount = 0;

    for (const date of newDates) {
        // Asegurarse de que el diaDeSemana guardado es correcto para cada instancia
        const classDayName = getDayName(date); // Obtiene el nombre del día de la fecha generada

        await Clase.create({
            nombre: lastInstance.nombre,
            tipoClase: lastInstance.tipoClase,
            horarioFijo: lastInstance.horarioFijo,
            diaDeSemana: [classDayName], 
            tipoInscripcion: lastInstance.tipoInscripcion,
            capacidad: lastInstance.capacidad,
            profesores: lastInstance.profesores,
            fecha: date,
            horaInicio: lastInstance.horaInicio,
            horaFin: lastInstance.horaFin,
            estado: 'activa',
            usuariosInscritos: [],
            inscripcionesDetalle: [],
            rrule: lastInstance.rrule // Es importante mantener la rrule para agrupaciones futuras si es necesario
        });
        createdCount++;
    }

    res.json({ message: 'Turnos extendidos exitosamente.', creadas: createdCount });
});

// @desc    Cancelar todas las clases de una fecha específica
// @route   POST /api/classes/cancel-day
// @access  Private/Admin
const cancelClassesByDate = asyncHandler(async (req, res) => {
    const { date, refundCredits } = req.body; // Recibimos el nuevo parámetro
    const { Clase, User, Notification } = getModels(req.gymDBConnection); // Añadimos el modelo User

    if (!date) {
        res.status(400);
        throw new Error('Se requiere una fecha para cancelar los turnos.');
    }

    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    // Hacemos populate de tipoClase para tener la info necesaria para el reembolso
    const classesToCancel = await Clase.find({
        fecha: { $gte: startOfDay, $lte: endOfDay },
        estado: 'activa'
    }).populate('tipoClase');

    if (classesToCancel.length === 0) {
        return res.status(404).json({ message: 'No se encontraron turnos activos para cancelar en esa fecha.' });
    }

    const allAffectedUserIds = new Set();
    
    // Iteramos sobre cada clase para procesar la cancelación y el posible reembolso
    for (const classItem of classesToCancel) {
        classItem.estado = 'cancelada';
        
        if (refundCredits && classItem.usuariosInscritos.length > 0) {
            for (const userId of classItem.usuariosInscritos) {
                allAffectedUserIds.add(userId.toString());
                const user = await User.findById(userId);
                
                if (user) {
                     // --- Devolución inteligente ---
                     const detalle = classItem.inscripcionesDetalle?.find(d => d.user.toString() === userId.toString());
                     let creditoADevolverId;
                     if (detalle && detalle.tipoCreditoUsado) {
                         creditoADevolverId = detalle.tipoCreditoUsado.toString();
                     } else if (classItem.tipoClase?._id) {
                         creditoADevolverId = classItem.tipoClase._id.toString();
                     }

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


// @desc    Reactivar todas las clases de una fecha específica
// @route   POST /api/classes/reactivate-day
// @access  Private/Admin
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
    // Necesitamos los modelos para hacer los lookups (populate)
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
            // 1. ETAPA DE FILTRADO (Esta parte ya estaba correcta)
            $match: {
                tipoClase: new mongoose.Types.ObjectId(tipoClaseId),
                fecha: {
                    $gte: new Date(`${fechaInicio}T00:00:00Z`),
                    $lte: new Date(`${fechaFin}T23:59:59Z`),
                },
                estado: 'activa',
                // ... (tu filtro de diaDeSemana)
            }
        },
        // --- ¡CORRECCIÓN AQUÍ! ---
        // 2. AGRUPAMOS por una combinación que hace a la clase única
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
        // 3. HACEMOS LOOKUP para obtener los nombres (como un .populate)
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
        // 4. PROYECTAMOS el resultado final en un formato limpio
        {
            $project: {
                _id: 0, // No necesitamos el _id de la agrupación
                nombre: '$_id.nombre',
                horaInicio: '$_id.horaInicio',
                horaFin: '$_id.horaFin',
                tipoClase: { $arrayElemAt: ['$tipoClaseInfo', 0] },
                profesores: '$profesoresInfo' 
            }
        },
        // 5. Ordenamos por hora de inicio
        { $sort: { horaInicio: 1 } }
    ]);
    
    res.status(200).json(availableSlots);
});

const subscribeToWaitlist = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const clase = await Clase.findById(req.params.id);

    if (!clase) {
        res.status(404);
        throw new Error('Turno no encontrado.');
    }

    // Validación: solo puedes apuntarte si la clase está realmente llena.
    if ((clase.usuariosInscritos || []).length < clase.capacidad) {
        res.status(400);
        throw new Error('No puedes apuntarte a la lista de espera, el turno aún tiene lugares.');
    }

    // --- CORRECCIÓN FINAL ---
    // Usamos 'waitlist' que es el nombre correcto del campo en el modelo.
    if (!clase.waitlist) {
        clase.waitlist = [];
    }

    // Verificamos si el usuario ya está en la 'waitlist'.
    if (clase.waitlist.includes(req.user._id)) {
        return res.status(200).json({ message: 'Ya estás en la lista de espera.' });
    }
    
    // Añadimos el usuario a la 'waitlist'.
    clase.waitlist.push(req.user._id);

    try {
        const title = `Confirmación de lista de espera`;
        const message = `Te has apuntado a la lista de espera para el turno de "${clase.nombre}" del día ${format(new Date(clase.fecha), 'dd/MM')}. ¡Te avisaremos si se libera un lugar!`;

        await sendSingleNotification(
            Notification,
            User,
            req.user._id,        // ID del usuario que se suscribe
            title,               // Título de la notificación
            message,             // Mensaje
            'waitlist_subscription', // Un nuevo tipo para identificarla
            true,                // true para que sea una notificación push
            clase._id            // ID de la clase asociada
        );

    } catch (notificationError) {
        // Si la notificación falla, no detenemos el proceso, pero sí lo registramos.
        console.error('Error al enviar la notificación de suscripción a la lista de espera:', notificationError);
    }

    await clase.save();

    res.status(200).json({ message: 'Te has apuntado a la lista de espera. Se te notificará si hay un lugar.' });
});


const unsubscribeFromWaitlist = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const clase = await Clase.findById(req.params.id);

    if (clase) {
        // --- CORRECCIÓN FINAL ---
        // Verificamos y usamos 'waitlist'.
        if (clase.waitlist && clase.waitlist.includes(req.user._id)) {
            clase.waitlist.pull(req.user._id); // .pull() de Mongoose es ideal para esto
            await clase.save();
        }
    }

    res.status(200).json({ message: 'Has sido removido de la lista de espera.' });
});
const getProfessorClasses = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    
    // req.user._id viene del middleware 'protect'
    const professorId = req.user._id;

    const classes = await Clase.find({ 
        $or: [
            { profesores: professorId },
            { profesor: professorId }
        ]
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
            select: 'nombre apellido dni email numeroTelefono fechaNacimiento telefonoEmergencia obraSocial ordenMedicaRequerida ordenMedicaEntregada', // Seleccionamos los campos que necesita el profesor
        })
        .select('profesores profesor usuariosInscritos'); // Solo traemos los campos necesarios para la lógica

    if (!classItem) {
        res.status(404);
        throw new Error('Turno no encontrada.');
    }

    // --- Lógica de Autorización ---
    // Un usuario puede ver los alumnos si es el profesor de la clase O si es un admin.
    const isTheProfessor = (classItem.profesores && classItem.profesores.includes(req.user._id)) || classItem.profesor?.toString() === req.user._id.toString();
    const isAdmin = req.user.roles.includes('admin');

    if (!isTheProfessor && !isAdmin) {
        res.status(403); // 403 Forbidden
        throw new Error('No tienes autorización para ver los alumnos de este turno.');
    }

    res.status(200).json(classItem.usuariosInscritos);
});

const checkInUser = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const { userId } = req.body; // Recibimos el ID del usuario escaneado del QR
    const classId = req.params.id; // Recibimos el ID de la clase de la URL

    if (!userId) {
        res.status(400);
        throw new Error('No se proporcionó un ID de usuario.');
    }

    const classItem = await Clase.findById(classId).populate('usuariosInscritos', 'nombre apellido');

    if (!classItem) {
        res.status(404);
        throw new Error('Turno no encontrado.');
    }

    // Buscamos si el ID del usuario está en el array de inscriptos de la clase
    const userIsEnrolled = classItem.usuariosInscritos.some(user => user._id.toString() === userId);
    
    if (userIsEnrolled) {
        // Si está inscripto, encontramos sus datos para devolverlos y dar una buena UX
        const enrolledUser = classItem.usuariosInscritos.find(user => user._id.toString() === userId);
        res.status(200).json({
            success: true,
            message: 'Habilitado',
            userName: `${enrolledUser.nombre} ${enrolledUser.apellido}`,
        });
    } else {
        res.status(403).json({ // 403 Forbidden es un buen código para "Acceso Denegado"
            success: false,
            message: 'Usuario no inscripto.',
        });
    }
});
const addUserToClass = asyncHandler(async (req, res) => {
    const { Clase, User, Notification } = getModels(req.gymDBConnection);
    const { userId } = req.body;

    const clase = await Clase.findById(req.params.id).populate('tipoClase', 'nombre'); // Populate to get the name
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

    const clase = await Clase.findById(req.params.id).populate('tipoClase', 'nombre'); // Populate to get the name
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
