// src/controllers/classController.js
import rrule from 'rrule';
import asyncHandler from 'express-async-handler';
import { calculateAge } from '../utils/ageUtils.js';
import getModels from '../utils/getModels.js';
import { parse, subHours } from 'date-fns';
const {RRule} = rrule
import mongoose from 'mongoose';
import { sendSingleNotification } from './notificationController.js'; 

// --- NUEVA FUNCIÓN DE AYUDA ---
// Mapea los nombres de los días en español a las constantes de la librería RRule
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

// --- FUNCIÓN DE AYUDA (EXISTENTE) ---
const getDayName = (date) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[date.getUTCDay()];
};

const createClass = asyncHandler(async (req, res) => {
    const { Clase, TipoClase } = getModels(req.gymDBConnection);
    const { nombre, tipoClase: tipoClaseId, profesor, capacidad, tipoInscripcion, fecha, horaInicio, horaFin, fechaInicio, fechaFin, diaDeSemana } = req.body;
    
    const capacidadNum = Number(capacidad) || 0;
    let totalCapacityCreated = 0;
    let createdClassesData = [];

    if (tipoInscripcion === 'fijo') {
        const rule = new RRule({
            freq: RRule.WEEKLY,
            byweekday: diaDeSemana.map(day => mapDayToRRule(day)).filter(Boolean),
            dtstart: new Date(`${fechaInicio}T12:00:00.000Z`),
            until: new Date(`${fechaFin}T12:00:00.000Z`),
        });
        const allDates = rule.all();
        if (allDates.length === 0) {
            return res.status(400).json({ message: "La configuración no generó ningun turno." });
        }
        const classCreationPromises = allDates.map(dateInstance => {
            const newClassData = { nombre, tipoClase: tipoClaseId, profesor, capacidad: capacidadNum, horaInicio, horaFin, fecha: dateInstance, diaDeSemana: [getDayName(dateInstance)], tipoInscripcion: 'fijo', rrule: rule.toString() };
            return Clase.create(newClassData);
        });
        createdClassesData = await Promise.all(classCreationPromises);
        totalCapacityCreated = capacidadNum * createdClassesData.length;
    } else {
        const safeDate = new Date(`${fecha}T12:00:00.000Z`);
        const newClass = new Clase({ nombre, tipoClase: tipoClaseId, profesor, capacidad: capacidadNum, horaInicio, horaFin, fecha: safeDate, diaDeSemana: [getDayName(safeDate)], tipoInscripcion: 'libre' });
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

    res.status(201).json({ message: `Se crearon ${createdClassesData.length} turnos.`, data: createdClassesData });
});


const getAllClasses = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const classes = await Clase.find({}).populate('tipoClase', 'nombre').populate('profesor', 'nombre apellido');
    res.json(classes);
});


const getClassById = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const classItem = await Clase.findById(req.params.id)
        .populate('tipoClase', 'nombre')
        .populate('profesor', 'nombre apellido')
        .populate('usuariosInscritos', 'nombre apellido dni fechaNacimiento sexo numeroTelefono telefonoEmergencia obraSocial');

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
    const { Clase, TipoClase } = getModels(req.gymDBConnection);
    const { capacidad, ...otherUpdates } = req.body;
    const classItem = await Clase.findById(req.params.id);

    if (!classItem) {
        res.status(404);
        throw new Error('Turno no encontrado.');
    }

    const oldCapacity = classItem.capacidad;
    const newCapacity = capacidad !== undefined ? Number(capacidad) : oldCapacity;
    const capacityDifference = newCapacity - oldCapacity;

    Object.assign(classItem, otherUpdates);
    classItem.capacidad = newCapacity;
    const updatedClass = await classItem.save();

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
                const tipoClaseId = classItem.tipoClase._id.toString();
                const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
                user.creditosPorTipo.set(tipoClaseId, currentCredits + 1);
                await user.save();
                await Notification.create({
                    user: user._id,
                    message: `Se te ha reembolsado 1 crédito para el turno "${classItem.nombre}" del ${new Date(classItem.fecha).toLocaleDateString()} debido a su cancelación.`,
                    type: 'class_cancellation_refund',
                    class: classItem._id
                });
            }
        }
    }
    classItem.usuariosInscritos = [];
    await classItem.save();
    res.json({ message: 'Turno cancelada exitosamente.', class: classItem });
});

const reactivateClass = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const classItem = await Clase.findById(req.params.id);

    if (!classItem) {
        res.status(404);
        throw new Error('Turno no encontrada.');
    }
    if (classItem.estado === 'activa' || classItem.estado === 'llena') {
        res.status(400);
        throw new Error('El turno ya está activo o lleno.');
    }
    classItem.estado = 'activa';
    await classItem.save();
    res.json({ message: 'Turno reactivada exitosamente.', class: classItem });
});


const deleteClass = asyncHandler(async (req, res) => {
    const { Clase, User, TipoClase } = getModels(req.gymDBConnection);
    const classItem = await Clase.findById(req.params.id);

    if (classItem) {
        const capacity = classItem.capacidad;
        const tipoClaseId = classItem.tipoClase;

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
        
        res.json({ message: 'Turno eliminada correctamente.' });
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
        res.status(500); // O 400, dependiendo de cómo quieras manejarlo
        throw new Error('El turno no tiene un tipo de turno asociado, no se puede procesar la inscripción.');
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
    
    const tipoClaseId = classItem.tipoClase._id.toString();
    let creditosEspecificos = user.creditosPorTipo.get(tipoClaseId) || 0;
    let creditDeducted = false;

    if (creditosEspecificos > 0) {
        user.creditosPorTipo.set(tipoClaseId, creditosEspecificos - 1);
        creditDeducted = true;
    } else {
        const universalType = await TipoClase.findOne({ nombre: 'Crédito Universal' });
        if (universalType) {
            const universalTypeId = universalType._id.toString();
            const creditosUniversales = user.creditosPorTipo.get(universalTypeId) || 0;
            if (creditosUniversales > 0) {
                user.creditosPorTipo.set(universalTypeId, creditosUniversales - 1);
                creditDeducted = true;
            }
        }
    }

    if (!creditDeducted) {
        res.status(400);
        throw new Error(`No tienes créditos disponibles para "${classItem.tipoClase.nombre}".`);
    }

    classItem.usuariosInscritos.push(userId);
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

    // Populamos tipoClase para tener su nombre
    const clase = await Clase.findById(classId).populate('tipoClase'); 
    const user = await User.findById(userId);

    if (!clase || !user) {
        res.status(404);
        throw new Error('Turno o usuario no encontrados.');
    }

    // Lógica de cancelación y devolución de crédito (sin cambios)
    const classStartDateTime = parse(`${clase.fecha.toISOString().substring(0, 10)} ${clase.horaInicio}`, 'yyyy-MM-dd HH:mm', new Date());
    const cancellationDeadline = subHours(classStartDateTime, 1);
    if (new Date() > cancellationDeadline) {
        res.status(400);
        throw new Error('No puedes anular la inscripción a menos de una hora del inicio del turno.');
    }

    // --- CORRECCIÓN EN DEVOLUCIÓN DE CRÉDITO ---
    // Asegurarnos de que tipoClase existe antes de devolver el crédito
    if (clase.tipoClase && clase.tipoClase._id) {
        const tipoClaseId = clase.tipoClase._id.toString();
        const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
        user.creditosPorTipo.set(tipoClaseId, currentCredits + 1);
    } else {
        // Opcional: Manejar el caso donde no hay tipoClase, quizás devolver un crédito universal o loggear un error.
        console.warn(`El turno ${clase._id} no tiene un tipoClase definido. No se pudo devolver el crédito específico.`);
    }

    user.clasesInscritas.pull(classId);
    
    // --- LÓGICA DE NOTIFICACIÓN MEJORADA Y SEGURA ---
    const wasFull = clase.usuariosInscritos.length >= clase.capacidad;
    clase.usuariosInscritos.pull(userId);
    
    // Si la clase ya no tiene el máximo de inscritos, su estado es 'activa'
    if (clase.usuariosInscritos.length < clase.capacidad) {
        clase.estado = 'activa';
    }

    if (wasFull && clase.waitlist && clase.waitlist.length > 0) {
        // **AQUÍ ESTÁ LA VALIDACIÓN CLAVE**
        const className = clase.nombre || 'Clase';
        const classTypeName = clase.tipoClase ? clase.tipoClase.nombre : 'la clase';

        const title = `¡Lugar disponible en ${className}!`;
        const message = `Se liberó un cupo en ${classTypeName} del día ${clase.fecha.toLocaleDateString('es-AR')} a las ${clase.horaInicio}hs. ¡Inscríbete rápido!`;

        const notificationPromises = clase.waitlist.map(userIdToNotify => 
            sendSingleNotification(
                Notification, User, userIdToNotify,
                title, message, 'spot_available', true, clase._id 
            )
        );
        
        await Promise.all(notificationPromises);
    }
    
    await user.save();
    await clase.save();

    res.json({ message: 'Anulación exitosa. Se ha devuelto 1 crédito a tu cuenta.' });
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
                    profesor: "$profesor"
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
                    profesor: pattern.profesor,
                    fecha: classDate,
                    horaInicio: pattern.horaInicio,
                    horaFin: pattern.horaFin,
                    horarioFijo: pattern.horarioFijo,
                    diaDeSemana: [getDayName(classDate.getDay())],
                    tipoInscripcion: 'fijo',
                    estado: 'activa',
                    usuariosInscritos: [],
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

        if (updates.profesor) template.profesor = updates.profesor;
        if (updates.horaInicio) template.horaInicio = updates.horaInicio;
        if (updates.horaFin) template.horaFin = updates.horaFin;
        if (updates.horaInicio && updates.horaFin) {
            template.horarioFijo = `${updates.horaInicio} - ${updates.horaFin}`;
        }
        
        const lastDate = futureInstances[futureInstances.length - 1].fecha;
        const rule = new RRule({
            freq: RRule.WEEKLY,
            byweekday: updates.diasDeSemana.map(day => mapDayToRRule(day)).filter(Boolean),
            dtstart: fechaDesdeFiltro,
            until: new Date(`${lastDate.toISOString().substring(0, 10)}T23:59:59Z`)
        });
        
        const newDates = rule.all();
        for (const date of newDates) {
            await Clase.create({
                ...template,
                _id: new mongoose.Types.ObjectId(),
                fecha: date,
                diaDeSemana: [getDayName(date)], // CORRECCIÓN
                usuariosInscritos: [],
                estado: 'activa',
            });
        }
        return res.json({ message: 'Días del turno actualizados.', eliminadas: idsToDelete.length, creadas: newDates.length });
    }
    
    const updateData = { $set: {} };
    if (updates.profesor) updateData.$set.profesor = updates.profesor;
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
    if (filters.profesor) query.profesor = filters.profesor;
    if (filters.horaInicio) query.horaInicio = filters.horaInicio;

    // MUY IMPORTANTE: Solo eliminar clases futuras
    query.fecha = { $gte: new Date(filters.fechaDesde || new Date()) };

    const result = await Clase.deleteMany(query);

    if (result.deletedCount === 0) {
        res.status(404);
        throw new Error('No se encontraron turnos que coincidan con los filtros para eliminar.');
    }

    res.json({
        message: 'Turnos eliminadas exitosamente.',
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
                profesorId: { $first: "$profesor" },
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
        { $lookup: { from: User.collection.name, localField: 'profesorId', foreignField: '_id', as: 'profesorInfo' } },
        { $lookup: { from: TipoClase.collection.name, localField: 'tipoClase', foreignField: '_id', as: 'tipoClaseInfo' } },
        {
            $project: {
                _id: 0,
                rrule: '$_id.rrule',
                nombre: '$nombre',
                horaInicio: '$horaInicio',
                horaFin: '$horaFin',
                tipoClase: { $arrayElemAt: ['$tipoClaseInfo', 0] },
                profesor: { $arrayElemAt: ['$profesorInfo', 0] },
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
            diaDeSemana: [classDayName], // Guarda el día específico de esta instancia
            tipoInscripcion: lastInstance.tipoInscripcion,
            capacidad: lastInstance.capacidad,
            profesor: lastInstance.profesor,
            fecha: date,
            horaInicio: lastInstance.horaInicio,
            horaFin: lastInstance.horaFin,
            estado: 'activa',
            usuariosInscritos: [],
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
        
        // Si se eligió reembolsar y hay usuarios inscritos
        if (refundCredits && classItem.usuariosInscritos.length > 0) {
            for (const userId of classItem.usuariosInscritos) {
                allAffectedUserIds.add(userId.toString());
                const user = await User.findById(userId);
                // Verificamos que el usuario y el tipo de clase existan para evitar errores
                if (user && classItem.tipoClase?._id) {
                    const tipoClaseId = classItem.tipoClase._id.toString();
                    const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
                    user.creditosPorTipo.set(tipoClaseId, currentCredits + 1);
                    await user.save();
                }
            }
            // Vaciamos la lista de inscritos después de reembolsar
            classItem.usuariosInscritos = [];
        }
        
        await classItem.save();
    }

    // Notificamos a todos los usuarios afectados una sola vez
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

// @desc    Encontrar los horarios únicos para un tipo de clase en días y fechas específicas
// @route   GET /api/classes/available-slots
// @access  Admin
const getAvailableSlotsForPlan = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const { tipoClaseId, diasDeSemana, fechaInicio, fechaFin } = req.query;

    if (!tipoClaseId || !diasDeSemana || !fechaInicio || !fechaFin) {
        res.status(400);
        throw new Error('Faltan parámetros de búsqueda.');
    }
    const diasArray = diasDeSemana.split(',');

    const availableSlots = await Clase.aggregate([
        {
            $match: {
                // 1. Filtros primarios que no fallan
                tipoClase: new mongoose.Types.ObjectId(tipoClaseId),
                fecha: {
                    $gte: new Date(`${fechaInicio}T00:00:00Z`),
                    $lte: new Date(`${fechaFin}T23:59:59Z`),
                },
                estado: 'activa',

                // 2. Filtro complejo y seguro para 'diaDeSemana'
                $expr: {
                    $let: {
                        vars: {
                            // Se crea una variable 'safeDia' que SIEMPRE es un array
                            safeDia: {
                                $cond: {
                                    if: { $isArray: "$diaDeSemana" },
                                    then: "$diaDeSemana",
                                    else: { $cond: { if: "$diaDeSemana", then: ["$diaDeSemana"], else: [] } }
                                }
                            }
                        },
                        // Se comprueba si hay intersección entre el array seguro y los días buscados
                        in: { $gt: [{ $size: { $setIntersection: ["$$safeDia", diasArray] } }, 0] }
                    }
                }
            }
        },
        // 3. El resto de la consulta se mantiene igual
        { $group: { _id: { horaInicio: '$horaInicio', horaFin: '$horaFin' } } },
        { $project: { _id: 0, horaInicio: '$_id.horaInicio', horaFin: '$_id.horaFin' } },
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
        const message = `Te has apuntado a la lista de espera para el turno de "${clase.nombre}" del día ${new Date(clase.fecha).toLocaleDateString('es-AR')}. ¡Te avisaremos si se libera un lugar!`;

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

    const classes = await Clase.find({ profesor: professorId })
        .populate('tipoClase', 'nombre') // Traemos el nombre del tipo de clase
        .sort({ fecha: 'asc' }); // Ordenamos por fecha ascendente

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
        .select('profesor usuariosInscritos'); // Solo traemos los campos necesarios para la lógica

    if (!classItem) {
        res.status(404);
        throw new Error('Turno no encontrada.');
    }

    // --- Lógica de Autorización ---
    // Un usuario puede ver los alumnos si es el profesor de la clase O si es un admin.
    const isTheProfessor = classItem.profesor?.toString() === req.user._id.toString();
    const isAdmin = req.user.roles.includes('admin');

    if (!isTheProfessor && !isAdmin) {
        res.status(403); // 403 Forbidden
        throw new Error('No tienes autorización para ver los alumnos de este turno.');
    }

    res.status(200).json(classItem.usuariosInscritos);
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
};
