// src/controllers/classController.js
import getClassModel from '../models/Clase.js';
import rrule from 'rrule';
import getUserModel from '../models/User.js'; 
import getTipoClaseModel from '../models/TipoClase.js'; 
import getNotificationModel from '../models/Notification.js'; 
import asyncHandler from 'express-async-handler';
import { calculateAge } from '../utils/ageUtils.js';
import getConfiguracionModel from '../models/Configuracion.js';
import { parse, subHours } from 'date-fns';
const {RRule} = rrule
import mongoose from 'mongoose';


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

// =================================================================
// --- VERSIÓN DEFINITIVA DE createClass ---
// =================================================================
const createClass = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    // Extraemos todos los campos que envía el frontend
    const { nombre, tipoClase, profesor, capacidad, tipoInscripcion, fecha, horaInicio, horaFin, fechaInicio, fechaFin, diaDeSemana } = req.body;

    if (tipoInscripcion === 'fijo') {
        // --- LÓGICA PARA CLASES FIJAS (RECURRENTES) ---
        // Validamos los campos necesarios para este tipo de clase
        if (!fechaInicio || !fechaFin || !diaDeSemana || diaDeSemana.length === 0) {
            res.status(400);
            throw new Error("Para clases fijas, se requieren fechas de inicio, fin y al menos un día de la semana.");
        }

        // Construimos la regla de recurrencia (rrule) aquí en el backend
        const rule = new RRule({
            freq: RRule.WEEKLY,
            byweekday: diaDeSemana.map(day => mapDayToRRule(day)).filter(Boolean), // Mapeamos y filtramos días inválidos
            dtstart: new Date(`${fechaInicio}T00:00:00.000Z`), // Forzamos UTC para evitar errores
            until: new Date(`${fechaFin}T23:59:59.000Z`), // Forzamos UTC para evitar errores
        });

        const allDates = rule.all();
        console.log(`[Clases Fijas] Regla generó ${allDates.length} fechas.`);

        if (allDates.length === 0) {
            return res.status(400).json({ message: "La configuración no generó ninguna clase. Revisa las fechas y los días seleccionados." });
        }

        const classCreationPromises = allDates.map(dateInstance => {
            const newClassData = {
                nombre, tipoClase, profesor, capacidad, horaInicio, horaFin,
                fecha: dateInstance,
                diaDeSemana: [getDayName(dateInstance)],
                tipoInscripcion: 'fijo',
                rrule: rule.toString(), // Guardamos la regla generada
                estado: 'activa',
                usuariosInscritos: [],
            };
            return Class.create(newClassData);
        });

        const createdClasses = await Promise.all(classCreationPromises);
        res.status(201).json({ message: `Se crearon ${createdClasses.length} clases.`, data: createdClasses });

    } else {
        // --- LÓGICA PARA CLASE ÚNICA (LIBRE) ---
        if (!fecha) {
            res.status(400);
            throw new Error('La fecha es obligatoria para una clase única.');
        }

        const safeDate = new Date(`${fecha}T12:00:00.000Z`);

        const newClass = new Class({
            nombre, tipoClase, profesor, capacidad, horaInicio, horaFin, fecha: safeDate,
            diaDeSemana: [getDayName(safeDate)],
            tipoInscripcion: 'libre',
        });

        const createdClass = await newClass.save();
        res.status(201).json({ message: "Clase única creada.", data: createdClass });
    }
});


// =================================================================
// --- VERSIÓN getAllClasses (SIMPLE Y FUNCIONAL) ---
// =================================================================
const getAllClasses = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    // Por ahora, traemos todas las clases para que tu calendario actual funcione.
    // Más adelante podemos optimizarlo con filtros de fecha.
    const classes = await Class.find({})
        .populate('tipoClase', 'nombre color')
        .populate('profesor', 'nombre apellido');
    res.json(classes);
});


// @desc    Obtener clase por ID
// @route   GET /api/classes/:id
// @access  Public
const getClassById = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    
    
    // 1. Poblamos 'usuariosInscritos' con los campos que necesitamos
    const classItem = await Class.findById(req.params.id)
        .populate('tipoClase', 'nombre')
        .populate('profesor', 'nombre apellido')
        .populate('usuariosInscritos', 'nombre apellido fechaNacimiento sexo telefonoEmergencia obraSocial');

    if (classItem) {
        // 2. Convertimos el documento de Mongoose a un objeto plano para poder modificarlo
        const classWithAge = classItem.toObject();
        
        // 3. Calculamos la edad para cada usuario inscrito y la añadimos al objeto
        if (classWithAge.usuariosInscritos && classWithAge.usuariosInscritos.length > 0) {
            classWithAge.usuariosInscritos = classWithAge.usuariosInscritos.map(user => {
                return {
                    ...user,
                    edad: user.fechaNacimiento ? calculateAge(user.fechaNacimiento) : 'N/A'
                };
            });
        }

        // 4. Enviamos el objeto completo con las edades calculadas
        res.json(classWithAge);
    } else {
        res.status(404);
        throw new Error('Clase no encontrada.');
    }
});

// @desc    Actualizar una clase
// @route   PUT /api/classes/:id
// @access  Private/Admin/Teacher
const updateClass = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    const { nombre, tipoClase, capacidad, fecha, horaInicio, horaFin, horarioFijo, diaDeSemana, tipoInscripcion, estado, profesor } = req.body;

    const classItem = await Class.findById(req.params.id);

    if (!classItem) {
        res.status(404);
        throw new Error('Clase no encontrada.');
    }

    classItem.nombre = nombre !== undefined ? nombre : classItem.nombre;
    classItem.tipoClase = tipoClase !== undefined ? tipoClase : classItem.tipoClase;
    classItem.capacidad = capacidad !== undefined ? capacidad : classItem.capacidad;
    classItem.estado = estado !== undefined ? estado : classItem.estado;
    classItem.profesor = profesor !== undefined ? profesor : classItem.profesor; 

    // Aquí evitamos cambiar el tipo de inscripción de una clase ya creada
    if (tipoInscripcion && classItem.tipoInscripcion !== tipoInscripcion) {
        res.status(400); 
        throw new Error('No se puede cambiar el tipo de inscripción de una clase existente.');
    }

    // Ajustamos los campos según el tipo de inscripción
    if (classItem.tipoInscripcion === 'fijo') {
        classItem.horaInicio = horaInicio !== undefined ? horaInicio : classItem.horaInicio;
        classItem.horaFin = horaFin !== undefined ? horaFin : classItem.horaFin;
        classItem.horarioFijo = `${classItem.horaInicio} - ${classItem.horaFin}`;
        classItem.diaDeSemana = diaDeSemana !== undefined ? diaDeSemana : classItem.diaDeSemana;
        classItem.fecha = undefined; // Asegurarse de que no haya fecha para clases fijas
    } else { // tipoInscripcion === 'libre'
        classItem.fecha = fecha !== undefined ? new Date(fecha) : classItem.fecha;
        classItem.horaInicio = horaInicio !== undefined ? horaInicio : classItem.horaInicio;
        classItem.horaFin = horaFin !== undefined ? horaFin : classItem.horaFin;
        classItem.horarioFijo = undefined; // Asegurarse de que no haya horarioFijo para clases libres
        classItem.diaDeSemana = undefined; // Asegurarse de que no haya diaDeSemana para clases libres
    }

    const updatedClass = await classItem.save();
    res.json(updatedClass);
});

// @desc    Cancelar una clase específica
// @route   PUT /api/classes/:id/cancel
// @access  Private/Admin
const cancelClassInstance = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    const User = getUserModel(req.gymDBConnection); 
    const Notification = getNotificationModel(req.gymDBConnection); 
    const TipoClase = getTipoClaseModel(req.gymDBConnection);

    const classId = req.params.id;
    const { refundCredits } = req.body; 

    const classItem = await Class.findById(classId).populate('tipoClase');

    if (!classItem) {
        res.status(404);
        throw new Error('Clase no encontrada.');
    }

    if (classItem.estado === 'cancelada') {
        res.status(400);
        throw new Error('La clase ya ha sido cancelada.');
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

                const notificationMessage = `Se te ha reembolsado 1 crédito para la clase "${classItem.nombre}" del ${classItem.fecha ? new Date(classItem.fecha).toLocaleDateString() : classItem.horarioFijo} debido a su cancelación.`;
                await Notification.create({
                    user: user._id,
                    message: notificationMessage,
                    type: 'class_cancellation_refund',
                    class: classId,
                });
            }
        }
    }

    classItem.usuariosInscritos = [];
    await classItem.save();

    res.json({ message: 'Clase cancelada exitosamente.', class: classItem });
});

// @desc    Reactivar una clase cancelada
// @route   PUT /api/classes/:id/reactivate
// @access  Private/Admin
const reactivateClass = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);

    const classId = req.params.id;
    const classItem = await Class.findById(classId);

    if (!classItem) {
        res.status(404);
        throw new Error('Clase no encontrada.');
    }

    if (classItem.estado === 'activa' || classItem.estado === 'llena') {
        res.status(400);
        throw new Error('La clase ya está activa o llena y no necesita ser reactivada.');
    }

    classItem.estado = 'activa';
    // Opcional: Si al reactivar quieres permitir que los usuarios vuelvan a inscribirse,
    // asegúrate de que usuariosInscritos esté vacío o reseteado.
    // classItem.usuariosInscritos = []; // Puedes descomentar si quieres que la clase esté vacía al reactivar.
    
    await classItem.save();
    res.json({ message: 'Clase reactivada exitosamente.', class: classItem });
});


// @desc    Eliminar una clase
// @route   DELETE /api/classes/:id
// @access  Private/Admin
const deleteClass = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    const User = getUserModel(req.gymDBConnection); 

    const classItem = await Class.findById(req.params.id);

    if (classItem) {
        // En lugar de iterar sobre usuariosInscritos, busquemos usuarios que tengan esta clase en sus arrays
        // y la eliminamos. Esto es importante para clases fijas que podrían tener el ID en 'planesFijos' o 'clasesInscritas'
        const usersToUpdate = await User.find({
            $or: [
                { clasesInscritas: classItem._id },
                { [`planesFijos.${classItem._id.toString()}`]: { $exists: true } }
            ]
        });

        for (const user of usersToUpdate) {
            // Remover de clasesInscritas si existe
            user.clasesInscritas = user.clasesInscritas.filter(id => id.toString() !== classItem._id.toString());
            
            // Remover de planesFijos si es una clase fija
            if (classItem.tipoInscripcion === 'fijo' && user.planesFijos.has(classItem._id.toString())) {
                user.planesFijos.delete(classItem._id.toString());
            }
            await user.save(); 
        }

        await classItem.deleteOne();
        res.json({ message: 'Clase eliminada correctamente.' });
    } else {
        res.status(404);
        throw new Error('Clase no encontrada.');
    }
});

const enrollUserInClass = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    const User = getUserModel(req.gymDBConnection);
    const TipoClase = getTipoClaseModel(req.gymDBConnection); // Necesario para el crédito universal

    const classId = req.params.id;
    const userId = req.user._id;

    const classItem = await Class.findById(classId).populate('tipoClase');
    const user = await User.findById(userId);

    if (!classItem || !user) {
        res.status(404);
        throw new Error('Clase o usuario no encontrados.');
    }

    if (classItem.estado === 'cancelada') {
        res.status(400);
        throw new Error('No te puedes inscribir a una clase cancelada.');
    }

    if (classItem.usuariosInscritos.includes(userId)) {
        res.status(400);
        throw new Error('Ya estás inscrito en esta clase.');
    }

    if (classItem.usuariosInscritos.length >= classItem.capacidad) {
        res.status(400);
        throw new Error('La clase está llena.');
    }

    // --- LÓGICA DE CRÉDITOS (INCLUYENDO UNIVERSAL) ---
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
        throw new Error(`No tienes créditos disponibles para "${classItem.tipoClase.nombre}" ni créditos universales.`);
    }

    // --- LÓGICA DE INSCRIPCIÓN ---
    classItem.usuariosInscritos.push(userId);
    if (classItem.usuariosInscritos.length >= classItem.capacidad) {
        classItem.estado = 'llena';
    }

    if (!user.clasesInscritas.includes(classId)) {
        user.clasesInscritas.push(classId);
    }
    
    // --- BLOQUE DE CÓDIGO OBSOLETO ELIMINADO ---
    // El bloque que intentaba usar user.planesFijos.has() se ha quitado.

    await user.save();
    await classItem.save();

    res.json({ message: 'Inscripción exitosa.', class: classItem });
});


const unenrollUserFromClass = asyncHandler(async (req, res) => {
    const TipoClase = getTipoClaseModel(req.gymDBConnection);

    // El resto de las variables que ya tenías
    const Class = getClaseModel(req.gymDBConnection);
    const User = getUserModel(req.gymDBConnection);
    const Notification = getNotificationModel(req.gymDBConnection);

    const classId = req.params.id;
    const userId = req.user._id;

    // Esta línea ahora funcionará sin problemas
    const classItem = await Class.findById(classId).populate('tipoClase');
    const user = await User.findById(userId);

    // ... (EL RESTO DE LA FUNCIÓN SE MANTIENE EXACTAMENTE IGUAL)
    if (!classItem || !user) {
        res.status(404);
        throw new Error('Clase o usuario no encontrados.');
    }
    // ...etc

    // --- Lógica de validación de tiempo ---
    const now = new Date();
    const classStartDateTime = parse(`${classItem.fecha.toISOString().substring(0, 10)} ${classItem.horaInicio}`, 'yyyy-MM-dd HH:mm', new Date());
    const cancellationDeadline = subHours(classStartDateTime, 1);

    if (now > cancellationDeadline) {
        res.status(400);
        throw new Error('No puedes anular la inscripción a menos de una hora del inicio de la clase.');
    }

    // --- Lógica de otorgamiento de crédito ---
    const tipoClaseId = classItem.tipoClase._id.toString();
    const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
    user.creditosPorTipo.set(tipoClaseId, currentCredits + 1);

    // --- Lógica de desinscripción ---
    const userIndexInClass = classItem.usuariosInscritos.map(id => id.toString()).indexOf(userId.toString());
    if (userIndexInClass > -1) {
        classItem.usuariosInscritos.splice(userIndexInClass, 1);
    }
    
    if (classItem.estado === 'llena') {
        classItem.estado = 'activa';
    }

    const classIndexInUser = user.clasesInscritas.map(id => id.toString()).indexOf(classId.toString());
    if (classIndexInUser > -1) {
        user.clasesInscritas.splice(classIndexInUser, 1);
    }
    
    await user.save();
    await classItem.save();

    res.json({ 
        message: 'Anulación exitosa. Se ha añadido 1 crédito a tu cuenta para este tipo de clase.' 
    });
});

// @desc    Generar futuras instancias de clases fijas para un gimnasio específico
// Esta función será llamada por el cron job para cada gimnasio activo.
const generateFutureFixedClasses = asyncHandler(async (gymDBConnection) => {
    console.log(`[Cron Job] Iniciando generación automática de clases para el próximo mes.`);
    const Class = getClassModel(gymDBConnection);

    // 1. DEFINIR EL PERÍODO A GENERAR
    // Generaremos las clases para el mes siguiente al actual.
    const now = new Date();
    // El primer día del mes que viene
    const startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    // El último día del mes que viene
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    console.log(`[Cron Job] Período a generar: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);

    // 2. ENCONTRAR LAS CLASES FIJAS "PATRÓN"
    // Buscamos la última instancia de cada clase fija para usarla como plantilla.
    // Usamos una agregación de MongoDB para agrupar por lo que hace única a una clase recurrente.
    const lastInstances = await Class.aggregate([
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
        console.log('[Cron Job] No se encontraron clases fijas recientes para usar como plantilla. Finalizando.');
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
                await Class.create({
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

    console.log(`[Cron Job] Finalizado. Clases nuevas generadas: ${classesGeneratedCount}`);
    return classesGeneratedCount;
});
// @desc    Actualizar múltiples clases en lote basado en filtros
// @route   PUT /api/classes/bulk-update
// @access  Private/Admin
const bulkUpdateClasses = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
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
        const futureInstances = await Class.find(query).sort({ fecha: 1 });
        if (futureInstances.length === 0) {
            res.status(404);
            throw new Error('No se encontraron clases futuras para modificar los días.');
        }

        const template = futureInstances[0].toObject();
        const idsToDelete = futureInstances.map(inst => inst._id);
        
        await Class.deleteMany({ _id: { $in: idsToDelete } });

        // --- CORRECCIÓN AQUÍ: Aplicamos los otros updates a la plantilla ---
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
            await Class.create({
                ...template, // Usamos la plantilla ya actualizada
                _id: new mongoose.Types.ObjectId(),
                fecha: date,
                diaDeSemana: [getDayName(date.getUTCDay())],
                usuariosInscritos: [],
                estado: 'activa',
            });
        }
        return res.json({ message: 'Días de clase actualizados.', eliminadas: idsToDelete.length, creadas: newDates.length });
    }
    
    // Si no se cambian los días, se ejecuta la lógica simple de siempre
    const updateData = { $set: {} };
    if (updates.profesor) updateData.$set.profesor = updates.profesor;
    if (updates.horaInicio) updateData.$set.horaInicio = updates.horaInicio;
    if (updates.horaFin) updateData.$set.horaFin = updates.horaFin;
    if (updates.horaInicio && updates.horaFin) {
        updateData.$set.horarioFijo = `${updates.horaInicio} - ${updates.horaFin}`;
    }

    const result = await Class.updateMany(query, updateData);
    res.json({ message: 'Operación completada.', actualizadas: result.modifiedCount, encontradas: result.matchedCount });
});

// @desc    Eliminar múltiples clases en lote basado en filtros
// @route   POST /api/classes/bulk-delete
// @access  Private/Admin
const bulkDeleteClasses = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
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

    const result = await Class.deleteMany(query);

    if (result.deletedCount === 0) {
        res.status(404);
        throw new Error('No se encontraron clases que coincidan con los filtros para eliminar.');
    }

    res.json({
        message: 'Clases eliminadas exitosamente.',
        eliminadas: result.deletedCount,
    });
});

const getGroupedClasses = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    const User = getUserModel(req.gymDBConnection);
    const TipoClase = getTipoClaseModel(req.gymDBConnection);

    const groupedClasses = await Class.aggregate([
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
    const Class = getClassModel(req.gymDBConnection);
    const { filters, extension } = req.body;

    if (!filters || !extension || !extension.fechaFin) {
        res.status(400);
        throw new Error('Se requieren filtros y una fecha final de extensión.');
    }

    // 1. Encontrar la última instancia existente para usarla como plantilla
    const lastInstance = await Class.findOne({
        nombre: filters.nombre,
        tipoClase: filters.tipoClase,
        horaInicio: filters.horaInicio
    }).sort({ fecha: -1 });

    if (!lastInstance) {
        res.status(404);
        throw new Error('No se encontró una clase existente que coincida con los filtros para usar como plantilla.');
    }

    // 2. Definir el rango para generar las nuevas clases
    const startDate = new Date(lastInstance.fecha);
    startDate.setDate(startDate.getDate() + 1);
    const endDate = new Date(extension.fechaFin);

    if (startDate > endDate) {
        res.status(400);
        throw new Error('La fecha de extensión debe ser posterior a la última clase existente.');
    }

    // 3. Crear la regla de recurrencia y generar las fechas
    const rule = new RRule({
        freq: RRule.WEEKLY,
        byweekday: lastInstance.diaDeSemana.map(day => mapDayToRRule(day)).filter(Boolean),
        dtstart: startDate,
        until: endDate,
    });

    const newDates = rule.all();
    let createdCount = 0;

    for (const date of newDates) {
        // --- CORRECCIÓN CLAVE AQUÍ ---
        // Creamos un objeto nuevo y limpio, copiando solo los datos necesarios
        // de la plantilla, en lugar de usar ...lastInstance.toObject() que copia el _id.
        await Class.create({
            nombre: lastInstance.nombre,
            tipoClase: lastInstance.tipoClase,
            horarioFijo: lastInstance.horarioFijo,
            diaDeSemana: [getDayName(date.getDay())], // Día actualizado para la nueva fecha
            tipoInscripcion: lastInstance.tipoInscripcion,
            capacidad: lastInstance.capacidad,
            profesor: lastInstance.profesor,
            fecha: date, // Nueva fecha
            horaInicio: lastInstance.horaInicio,
            horaFin: lastInstance.horaFin,
            estado: 'activa',
            usuariosInscritos: [], // Siempre vacío para una nueva clase
        });
        createdCount++;
    }

    res.json({ message: 'Clases extendidas exitosamente.', creadas: createdCount });
});

// @desc    Cancelar todas las clases de una fecha específica
// @route   POST /api/classes/cancel-day
// @access  Private/Admin
const cancelClassesByDate = asyncHandler(async (req, res) => {
    const { date } = req.body; // Se espera una fecha en formato 'YYYY-MM-DD'
    const Clase = getClassModel(req.gymDBConnection);
    const Notification = getNotificationModel(req.gymDBConnection);

    if (!date) {
        res.status(400);
        throw new Error('Se requiere una fecha para cancelar las clases.');
    }

    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    // 1. Encontrar todas las clases activas para ese día
    const classesToCancel = await Clase.find({
        fecha: { $gte: startOfDay, $lte: endOfDay },
        estado: 'activa'
    });

    if (classesToCancel.length === 0) {
        return res.status(404).json({ message: 'No se encontraron clases activas para cancelar en esa fecha.' });
    }

    const classIdsToCancel = classesToCancel.map(c => c._id);
    let usersToNotify = [];

    // 2. Recolectar todos los usuarios inscritos
    classesToCancel.forEach(c => {
        usersToNotify.push(...c.usuariosInscritos);
    });
    const uniqueUsers = [...new Set(usersToNotify.map(u => u.toString()))];

    // 3. Crear notificaciones para los usuarios afectados
    if (uniqueUsers.length > 0) {
        const notificationPromises = uniqueUsers.map(userId => {
            return Notification.create({
                user: userId,
                message: `Atención: Las clases del día ${startOfDay.toLocaleDateString('es-AR')} han sido canceladas. Si estabas inscrito, por favor busca un nuevo horario.`
            });
        });
        await Promise.all(notificationPromises);
    }
    
    // 4. Actualizar el estado de las clases a 'cancelada'
    const updateResult = await Clase.updateMany(
        { _id: { $in: classIdsToCancel } },
        { $set: { estado: 'cancelada' } }
    );

    res.status(200).json({ 
        message: `Se cancelaron ${updateResult.modifiedCount} clases y se notificó a ${uniqueUsers.length} usuarios.` 
    });
});

// @desc    Reactivar todas las clases de una fecha específica
// @route   POST /api/classes/reactivate-day
// @access  Private/Admin
const reactivateClassesByDate = asyncHandler(async (req, res) => {
    const { date } = req.body;
    const Clase = getClassModel(req.gymDBConnection);
    
    if (!date) {
        res.status(400);
        throw new Error('Se requiere una fecha para reactivar las clases.');
    }
    
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    const result = await Clase.updateMany(
        { fecha: { $gte: startOfDay, $lte: endOfDay }, estado: 'cancelada' },
        { $set: { estado: 'activa' } }
    );

    if (result.modifiedCount === 0) {
        return res.status(404).json({ message: 'No se encontraron clases canceladas para reactivar en esa fecha.' });
    }
    
    res.status(200).json({ message: `Se reactivaron ${result.modifiedCount} clases.` });
});

// @desc    Encontrar los horarios únicos para un tipo de clase en días y fechas específicas
// @route   GET /api/classes/available-slots
// @access  Admin
const getAvailableSlotsForPlan = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    const { tipoClaseId, diasDeSemana, fechaInicio, fechaFin } = req.query;

    if (!tipoClaseId || !diasDeSemana || !fechaInicio || !fechaFin) {
        res.status(400);
        throw new Error('Faltan parámetros de búsqueda.');
    }
    const diasArray = diasDeSemana.split(',');

    const availableSlots = await Class.aggregate([
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
};
