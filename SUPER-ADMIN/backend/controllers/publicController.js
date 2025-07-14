import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js'; 

const getGymClientIdByIdentifier = asyncHandler(async (req, res) => {

    
    const { gymIdentifier } = req.params;



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
            logoUrl: gym.logoUrl,
            primaryColor: gym.primaryColor 

        });
    } else {
        console.log(`No se encontró ningún gimnasio con el urlIdentifier: '${gymIdentifier.toLowerCase()}'`);
        res.status(404).json({ message: 'Gimnasio no encontrado.' });
    }
});

export { 
    getGymClientIdByIdentifier 
};
