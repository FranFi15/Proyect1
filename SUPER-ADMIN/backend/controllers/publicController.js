import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js'; 

/**
 * @desc    Obtener el clientId de un gimnasio a partir de su identificador de URL.
 * @route   GET /api/public/gym/:gymIdentifier
 * @access  Public
 */
const getGymClientIdByIdentifier = asyncHandler(async (req, res) => {
    const { gymIdentifier } = req.params;

    if (!gymIdentifier) {
        res.status(400).json({ message: 'No se proporcionó un identificador de gimnasio.' });
        return;
    }

    // Buscamos en la colección de Clientes usando el identificador de la URL.
    const gym = await Client.findOne({ 
        urlIdentifier: gymIdentifier.toLowerCase() 
    });

    if (gym) {
        // Si se encuentra, devolvemos únicamente el clientId.
        // Esta es información segura para compartir con el frontend.
        res.status(200).json({ 
            clientId: gym.clientId 
        });
    } else {
        res.status(404).json({ message: 'Gimnasio no encontrado.' });
    }
});

export { 
    getGymClientIdByIdentifier 
};