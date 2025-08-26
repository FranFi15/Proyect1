import asyncHandler from 'express-async-handler';
import Settings from '../models/Settings.js';

// Obtiene la configuración de precios.
// Si no existe, la crea con valores por defecto.
const getSettings = asyncHandler(async (req, res) => {
    let settings = await Settings.findOne();

    if (!settings) {
        // Si es la primera vez que se ejecuta, crea el documento de configuración.
        settings = await Settings.create({ pricePerClient: 0, restaurantPrice: 0 });
    }

    res.status(200).json(settings);
});

// Actualiza la configuración de precios.
const updateSettings = asyncHandler(async (req, res) => {
    const { pricePerClient, restaurantPrice } = req.body;

    let settings = await Settings.findOne();

    if (!settings) {
        // Si por alguna razón no existiera, la crea.
        settings = await Settings.create({ pricePerClient, restaurantPrice });
    } else {
        // Si ya existe, actualiza los valores.
        settings.pricePerClient = pricePerClient ?? settings.pricePerClient;
        settings.restaurantPrice = restaurantPrice ?? settings.restaurantPrice;
        await settings.save();
    }

    res.status(200).json({
        message: 'Configuración de precios actualizada exitosamente.',
        settings,
    });
});

export {
    getSettings,
    updateSettings,
};
