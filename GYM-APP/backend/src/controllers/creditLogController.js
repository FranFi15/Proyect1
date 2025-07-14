import getModels from '../utils/getModels.js';
import asyncHandler from 'express-async-handler';

const getLogsForUser = asyncHandler(async (req, res) => {
    const { CreditLog } = getModels(req.gymDBConnection);
    const userId = req.params.userId;

    const logs = await CreditLog.find({ user: userId })
        .populate('tipoClase', 'nombre') // Para mostrar el nombre de la clase
        .populate('admin', 'nombre apellido') // Para saber qué admin hizo el cambio
        .sort({ createdAt: -1 }); // Los más nuevos primero

    res.json(logs);
});

export { getLogsForUser };