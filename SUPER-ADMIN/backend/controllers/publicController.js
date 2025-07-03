import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js'; 

/**
 * @desc      Obtener el ID de un gimnasio a partir de su identificador de URL.
 * @route     GET /api/public/gym/:gymIdentifier
 * @access    Public
 */
const getGymClientIdByIdentifier = asyncHandler(async (req, res) => {
    console.log('--- SUPER-ADMIN: Petición recibida en /api/public/gym/:gymIdentifier ---');
    console.log('req.params:', req.params);
    
    const { gymIdentifier } = req.params;

    // --- NUEVO LOG DE DEPURACIÓN ---
    // Vamos a ver el valor exacto de la variable justo antes del 'if'.
    console.log(`Valor de la variable 'gymIdentifier': [${gymIdentifier}]`);

    if (!gymIdentifier) {
        // --- NUEVO MENSAJE DE ERROR ---
        // Cambiamos el mensaje para confirmar que el error viene de este bloque.
        console.error("Error: El bloque 'if (!gymIdentifier)' se ha ejecutado.");
        res.status(400).json({ message: 'Error Crítico: El identificador llegó vacío al controlador.' });
        return;
    }

    const gym = await Client.findOne({ 
        urlIdentifier: gymIdentifier.toLowerCase() 
    });

    if (gym) {
        console.log('Gimnasio encontrado:', gym.nombre);
        res.status(200).json({ 
            clientId: gym._id,
            gymName: gym.nombre,
            logoUrl: gym.logoUrl 
        });
    } else {
        console.log(`No se encontró ningún gimnasio con el urlIdentifier: '${gymIdentifier.toLowerCase()}'`);
        res.status(404).json({ message: 'Gimnasio no encontrado.' });
    }
});

export { 
    getGymClientIdByIdentifier 
};
