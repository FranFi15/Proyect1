import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js'; 

/**
 * @desc    Obtener el ID de un gimnasio a partir de su identificador de URL.
 * @route   GET /api/public/gym/:gymIdentifier
 * @access  Public
 */
const getGymClientIdByIdentifier = asyncHandler(async (req, res) => {
    const { gymIdentifier } = req.params;

    if (!gymIdentifier) {
        res.status(400).json({ message: 'No se proporcionó un identificador de gimnasio.' });
        return;
    }

    // Buscamos en la colección de Clientes usando el identificador de la URL (en minúsculas).
    const gym = await Client.findOne({ 
        urlIdentifier: gymIdentifier.toLowerCase() 
    });

    if (gym) {
        // --- CORRECCIÓN AQUÍ ---
        // Devolvemos el _id del documento, que es el verdadero ID del cliente.
        res.status(200).json({ 
            clientId: gym._id,
            gymName: gym.nombre,
            logoUrl: gym.logoUrl 
        });
    } else {
        res.status(404).json({ message: 'Gimnasio no encontrado.' });
    }
});

export { 
    getGymClientIdByIdentifier 
};
