import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js'; 

const getGymClientIdByIdentifier = asyncHandler(async (req, res) => {
    const { gymIdentifier } = req.params;

    if (!gymIdentifier) {
        res.status(400).json({ message: 'Error: No se proporcionó un identificador.' });
        return;
    }
    // --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
    // Limpiamos el identificador de espacios y lo pasamos a minúsculas.
    const trimmedIdentifier = gymIdentifier.trim().toLowerCase();

    const gym = await Client.findOne({ 
        urlIdentifier: trimmedIdentifier // Usamos el identificador limpio
    });

    if (gym) {
        res.status(200).json({ 
            clientId: gym.clientId,
            gymName: gym.nombre,
            logoUrl: gym.logoUrl,
            primaryColor: gym.primaryColor 
        });
    } else {
        console.log(`No se encontró ningún gimnasio con el urlIdentifier: '${trimmedIdentifier}'`);
        res.status(404).json({ message: 'Gimnasio no encontrado.' });
    }
});

export { 
    getGymClientIdByIdentifier 
};
