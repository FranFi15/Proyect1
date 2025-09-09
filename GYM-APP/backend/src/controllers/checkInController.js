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

    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // 1. Buscamos todas las clases de hoy en las que el usuario está inscrito.
    const enrolledClassesToday = await Clase.find({
        fecha: { $gte: todayStart, $lte: todayEnd },
        usuariosInscritos: userId, // Filtramos directamente en la consulta
        estado: 'activa',
    }).populate('tipoClase', 'nombre').sort({ horaInicio: 'asc' });

    if (enrolledClassesToday.length === 0) {
        return res.status(403).json({
            success: false,
            message: `❌ ${user.nombre} ${user.apellido} no está inscripto en ningún turno hoy.`,
        });
    }

    // 2. Filtramos las clases que ya han terminado.
    const currentTime = format(new Date(), 'HH:mm');
    const upcomingClasses = enrolledClassesToday.filter(clase => clase.horaFin > currentTime);

    if (upcomingClasses.length === 0) {
        return res.status(200).json({
            success: true, // Es éxito, pero sin clases activas
            message: `✅ ${user.nombre} ${user.apellido} sus turnos ya finalizaron.`,
            classes: []
        });
    }

    // 3. Si se encuentran clases válidas, respondemos con la lista.
    res.status(200).json({
        success: true,
        message: `✅ ${user.nombre} ${user.apellido}:`,
        classes: upcomingClasses.map(c => ({ 
            nombre: c.tipoClase?.nombre || 'General',
            horario: `${c.horaInicio}hs - ${c.horaFin}hs`
        }))
    });
});

export { processGeneralCheckIn };