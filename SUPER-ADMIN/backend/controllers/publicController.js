import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js'; 

const getGymClientIdByIdentifier = asyncHandler(async (req, res) => {
    const { gymIdentifier } = req.params;

    if (!gymIdentifier) {
        res.status(400).json({ message: 'Error: No se proporcionó un identificador.' });
        return;
    }

    const trimmedIdentifier = gymIdentifier.trim().toLowerCase();

    const gym = await Client.findOne({ 
        urlIdentifier: trimmedIdentifier 
    });

    if (gym) {
        res.status(200).json({ 
            clientId: gym.clientId,
            gymName: gym.nombre,
            logoUrl: gym.logoUrl,
            primaryColor: gym.primaryColor,
            type: gym.type
        });
    } else {
        console.log(`No se encontró ningún gimnasio con el urlIdentifier: '${trimmedIdentifier}'`);
        res.status(404).json({ message: 'Gimnasio no encontrado.' });
    }
});

const getClientInfoByIdentifier = asyncHandler(async (req, res) => {
    const { identifier } = req.params;

    if (!identifier) {
        res.status(400).json({ message: 'Error: No se proporcionó un identificador.' });
        return;
    }

    const trimmedIdentifier = identifier.trim().toLowerCase();
    
    const client = await Client.findOne({ 
        urlIdentifier: trimmedIdentifier 
    });

    if (client) {
        res.status(200).json({ 
            clientId: client.clientId,
            clientName: client.nombre,
            logoUrl: client.logoUrl,
            primaryColor: client.primaryColor,
            type: client.type
        });
    } else {
        res.status(404).json({ message: 'Cliente no encontrado.' });
    }
});


export {
    getGymClientIdByIdentifier,
    getClientInfoByIdentifier
};