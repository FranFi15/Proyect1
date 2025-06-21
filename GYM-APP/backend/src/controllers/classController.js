// src/controllers/classController.js
import getClassModel from '../models/Clase.js';
import rrule from 'rrule';
import getUserModel from '../models/User.js'; 
import getTipoClaseModel from '../models/TipoClase.js'; 
import getNotificationModel from '../models/Notification.js'; 
import asyncHandler from 'express-async-handler';
import getConfiguracionModel from '../models/Configuracion.js';
const {RRule} = rrule
import mongoose from 'mongoose';

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

const getDayName = (dayIndex) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[dayIndex];
};

// @desc    Crear una nueva clase (o un patrón de clase recurrente)
// @route   POST /api/classes
// @access  Private/Admin/Teacher
const createClass = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    const User = getUserModel(req.gymDBConnection);

    const { 
        nombre, tipoClase, capacidad, horaInicio, horaFin, 
        tipoInscripcion, profesor, diaDeSemana, fecha, 
        fechaInicio, fechaFin
    } = req.body;

    if (!nombre || !tipoClase || !capacidad || !horaInicio || !horaFin) {
        res.status(400);
        throw new Error('Por favor, completa todos los campos obligatorios.');
    }

    if (profesor && profesor.length > 0) {
        const existingProfesor = await User.findById(profesor);
        if (!existingProfesor || !existingProfesor.roles.includes('profesor')) {
            res.status(400);
            throw new Error('El ID de profesor proporcionado no es válido.');
        }
    }

    if (tipoInscripcion === 'fijo') {
        if (!diaDeSemana || diaDeSemana.length === 0 || !fechaInicio || !fechaFin) {
            res.status(400);
            throw new Error('Para clases fijas, se requieren días de la semana y un rango de fechas.');
        }

        // --- CORRECCIÓN DE ZONA HORARIA ---
        // Forzamos las fechas a ser interpretadas como UTC para evitar desfases.
        const rule = new RRule({
            freq: RRule.WEEKLY,
            byweekday: diaDeSemana.map(mapDayToRRule),
            dtstart: new Date(`${fechaInicio}T00:00:00Z`),
            until: new Date(`${fechaFin}T23:59:59Z`),
        });

        const classDates = rule.all();
        const createdClasses = [];

        for (const classDate of classDates) {
            const newClass = await Class.create({
                nombre, tipoClase, capacidad, fecha: classDate,
                horaInicio, horaFin,
                horarioFijo: `${horaInicio} - ${horaFin}`,
                // --- CORRECCIÓN DE ZONA HORARIA ---
                // Usamos getUTCDay() para obtener el día correcto en UTC.
                diaDeSemana: [getDayName(classDate.getUTCDay())],
                tipoInscripcion,
                profesor: profesor || undefined,
                estado: 'activa',
                usuariosInscritos: [],
            });
            createdClasses.push(newClass);
        }
        res.status(201).json(createdClasses);

    } else { // tipoInscripcion === 'libre'
        if (!fecha) {
            res.status(400);
            throw new Error('Para clases de tipo "libre", se requiere una fecha específica.');
        }
        const newClass = await Class.create({
            nombre, tipoClase, capacidad,
            fecha: new Date(`${fecha}T00:00:00Z`), // Guardamos la fecha libre también en UTC
            horaInicio, horaFin, tipoInscripcion,
            profesor: profesor || undefined,
            estado: 'activa',
            usuariosInscritos: [],
        });
        res.status(201).json(newClass);
    }
});

// @desc    Obtener todas las clases
// @route   GET /api/classes
// @access  Public
const getAllClasses = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    const User = getUserModel(req.gymDBConnection); 
    const TipoClase = getTipoClaseModel(req.gymDBConnection); 

    const classes = await Class.find({})
        .populate({ path: 'tipoClase', model: TipoClase, select: 'nombre' }) 
        .populate({ path: 'profesor', model: User, select: 'nombre apellido' }) 
        .populate({ path: 'usuariosInscritos', model: User, select: 'nombre apellido email' }); 
    res.json(classes);
});

// @desc    Obtener clase por ID
// @route   GET /api/classes/:id
// @access  Public
const getClassById = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    const User = getUserModel(req.gymDBConnection); 
    const TipoClase = getTipoClaseModel(req.gymDBConnection); 

    const classItem = await Class.findById(req.params.id)
        .populate({ path: 'tipoClase', model: TipoClase, select: 'nombre' })
        .populate({ path: 'profesor', model: User, select: 'nombre apellido' }) 
        .populate({ path: 'usuariosInscritos', model: User, select: 'nombre apellido email' });

    if (classItem) {
        res.json(classItem);
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

// @desc    Inscribir un usuario en una clase
// @route   POST /api/classes/:id/enroll
// @access  Private (para usuarios que se auto-inscriben)
const enrollUserInClass = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    const User = getUserModel(req.gymDBConnection); 
    const Notification = getNotificationModel(req.gymDBConnection); 

    const classId = req.params.id; // Este es el ID de la instancia de clase específica
    const userId = req.user._id; 

    const classItem = await Class.findById(classId).populate('tipoClase'); // Popula tipoClase para acceder a _id
    const user = await User.findById(userId);

    if (!classItem || !user) {
        res.status(404);
        throw new Error('Clase o usuario no encontrados.');
    }

    if (classItem.estado === 'cancelada') {
        res.status(400);
        throw new Error('No se puede inscribir en una clase cancelada.');
    }

    // Si la clase es fija, necesitamos asegurarnos de que el usuario se inscribe a esta instancia específica
    // Y no al "patrón" de clase si es que se ha creado de esa forma.
    // Con el nuevo modelo de clases fijas, el cron job creará instancias con `fecha`
    // lo que permite que el sistema funcione de la misma manera que las clases libres.
    if (classItem.usuariosInscritos.includes(userId)) {
        res.status(400);
        throw new Error('El usuario ya está inscrito en esta clase.');
    }

    if (classItem.usuariosInscritos.length >= classItem.capacidad) {
        res.status(400);
        throw new Error('La clase está llena.');
    }
    
    const tipoClaseId = classItem.tipoClase._id.toString(); // Asegurarse de usar el ID del tipo de clase populado
    const creditosDisponibles = user.creditosPorTipo.get(tipoClaseId) || 0;

    if (creditosDisponibles <= 0) {
        res.status(400);
        throw new Error(`No tienes créditos disponibles para el tipo de clase "${classItem.tipoClase.nombre}".`); // Usa el nombre populado
    }

    user.creditosPorTipo.set(tipoClaseId, creditosDisponibles - 1);
    await user.save();

    classItem.usuariosInscritos.push(userId);
    if (classItem.usuariosInscritos.length >= classItem.capacidad) {
        classItem.estado = 'llena'; 
    }
    await classItem.save();

    if (!user.clasesInscritas.includes(classId)) {
        user.clasesInscritas.push(classId);
        await user.save(); 
    }

    // Si la clase es de tipo fija, y el usuario no tiene este patrón de clase fija en sus planesFijos, añadirlo
    // Esto es para que el usuario "tenga" el plan, no se inscribe a cada instancia recurrente en planesFijos
    if (classItem.tipoInscripcion === 'fijo' && !user.planesFijos.has(classItem._id.toString())) {
        user.planesFijos.set(classItem._id.toString(), classItem.diaDeSemana);
        await user.save();
    }


    res.json({ message: 'Inscripción exitosa en clase.', class: classItem });
});


// @desc    Desinscribir un usuario de una clase
// @route   POST /api/classes/:id/unenroll
// @access  Private
const unenrollUserFromClass = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    const User = getUserModel(req.gymDBConnection); 
    const Notification = getNotificationModel(req.gymDBConnection); 

    const classId = req.params.id;
    const userId = req.user._id;

    const classItem = await Class.findById(classId).populate('tipoClase');
    const user = await User.findById(userId);

    if (!classItem || !user) {
        res.status(404);
        throw new Error('Clase o usuario no encontrados.');
    }

    const userIndexInClass = classItem.usuariosInscritos.indexOf(userId);
    if (userIndexInClass === -1) {
        res.status(400);
        throw new Error('El usuario no está inscrito en esta clase.');
    }

    classItem.usuariosInscritos.splice(userIndexInClass, 1);
    if (classItem.estado === 'llena' && classItem.usuariosInscritos.length < classItem.capacidad) { 
        classItem.estado = 'activa'; 
    }
    await classItem.save();

    const classIndexInUser = user.clasesInscritas.indexOf(classId);
    if (classIndexInUser > -1) {
        user.clasesInscritas.splice(classIndexInUser, 1);
        await user.save();
    }

    // Para clases fijas, si el usuario se desinscribe de una instancia,
    // y si es la última instancia de ese patrón en la que estaba inscrito,
    // podríamos considerar quitarlo de planesFijos si es relevante para tu lógica.
    // Sin embargo, `planesFijos` está pensado más para un "plan" de suscripción.
    // Si la desinscripción de una instancia individual de clase fija no significa cancelar el "plan fijo",
    // entonces no necesitamos modificar `user.planesFijos` aquí.
    // Si la desinscripción de una instancia de clase fija IMPLICA cancelar el plan fijo, esta lógica debe ser más inteligente.
    // Por ahora, lo dejo sin modificar planesFijos a menos que se defina la relación.

    // Notificar a otros usuarios que un lugar se ha liberado (solo si la clase es fija y el estado es 'activa' de nuevo)
    if (classItem.tipoInscripcion === 'fijo' && classItem.estado === 'activa') {
        const notificationMessage = `¡Atención! Un lugar en la clase fija "${classItem.nombre}" (${classItem.horarioFijo}, ${classItem.diaDeSemana.join(', ')}) del ${new Date(classItem.fecha).toLocaleDateString()} se ha liberado debido a una desinscripción.`;
        // Podrías filtrar a los usuarios a notificar, por ejemplo, aquellos que tienen créditos para esta clase
        // o que están en lista de espera si la implementas.
        const allUsers = await User.find({ _id: { $ne: userId } }); // Obtener todos menos el que se desinscribió
        for (const otherUser of allUsers) {
            await Notification.create({
                user: otherUser._id, 
                message: notificationMessage,
                type: 'class_unenroll_spot_available',
                class: classId 
            });
        }
    }


    res.json({ message: 'Desinscripción exitosa de clase.', class: classItem });
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

// @desc    Obtener un resumen de las clases fijas agrupadas por patrón
// @route   GET /api/classes/grouped
// @access  Private/Admin
const getGroupedClasses = asyncHandler(async (req, res) => {
    const Class = getClassModel(req.gymDBConnection);
    const User = getUserModel(req.gymDBConnection);
    const TipoClase = getTipoClaseModel(req.gymDBConnection);

    const groupedClasses = await Class.aggregate([
        // 1. Considerar solo instancias de clases fijas y activas
        {
            $match: {
                tipoInscripcion: 'fijo',
                estado: 'activa',
                fecha: { $gte: new Date() } // Solo considerar patrones con instancias futuras
            }
        },
        // 2. Ordenar por fecha para poder obtener el último profesor asignado
        { $sort: { fecha: 1 } },
        // 3. Agrupar por lo que define un patrón único
        {
            $group: {
                _id: {
                    nombre: '$nombre',
                    tipoClase: '$tipoClase',
                    horaInicio: '$horaInicio',
                    horaFin: '$horaFin'
                },
                profesorId: { $first: '$profesor' }, // Tomar el primer profesor encontrado en las instancias futuras
                diasDeSemana: { $addToSet: { $arrayElemAt: ['$diaDeSemana', 0] } }, // Juntar todos los días de la semana
                cantidadDeInstancias: { $sum: 1 } // Contar cuántas clases futuras hay
            }
        },
        // 4. Poblar los datos del profesor y tipo de clase para mostrarlos
        {
            $lookup: {
                from: User.collection.name,
                localField: 'profesorId',
                foreignField: '_id',
                as: 'profesorInfo'
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
        // 5. Formatear la salida para que sea más fácil de usar en el frontend
        {
            $project: {
                _id: 0, // No necesitamos el _id de la agrupación
                nombre: '$_id.nombre',
                horaInicio: '$_id.horaInicio',
                horaFin: '$_id.horaFin',
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
};
