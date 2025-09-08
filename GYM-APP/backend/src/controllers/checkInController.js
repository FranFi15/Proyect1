import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import { startOfDay, endOfDay } from 'date-fns';

const processGeneralCheckIn = asyncHandler(async (req, res) => {
    const { Clase } = getModels(req.gymDBConnection);
    const { userId } = req.body;

    if (!userId) {
        res.status(400);
        throw new Error('No se proporcionó un ID de usuario.');
    }

    // 1. Buscamos todas las clases activas para el día de hoy
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const todayClasses = await Clase.find({
        fecha: { $gte: todayStart, $lte: todayEnd },
        estado: 'activa',
    }).populate('tipoClase', 'nombre');

    if (todayClasses.length === 0) {
        res.status(404).json({ success: false, message: 'No hay turnos programados para hoy.' });
        return;
    }

    // 2. Buscamos el primer turno de hoy en el que el usuario esté inscripto
    const enrolledClass = todayClasses
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)) // Ordenamos por hora
        .find(clase => clase.usuariosInscritos.some(id => id.toString() === userId));

    if (enrolledClass) {
        // 3. Si se encuentra, respondemos con éxito y los datos de la clase
        res.status(200).json({
            success: true,
            message: '✅ Check-in Válido',
            classInfo: `Turno: ${enrolledClass.tipoClase.nombre} a las ${enrolledClass.horaInicio}hs`,
        });
    } else {
        // 4. Si no se encuentra en ninguna clase, respondemos con error
        res.status(403).json({
            success: false,
            message: '❌ El cliente no está inscripto en ningun turno hoy.',
        });
    }
});

export { processGeneralCheckIn };