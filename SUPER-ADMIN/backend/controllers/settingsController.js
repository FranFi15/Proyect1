import asyncHandler from 'express-async-handler';
import Settings from '../models/Settings.js';

// Obtener la configuración (creándola si no existe)
const getSettings = asyncHandler(async (req, res) => {
    let settings = await Settings.findOne({ singleton: 'main_settings' });
    if (!settings) {
        settings = await Settings.create({}); // Crea el documento con valores por defecto
    }
    res.json(settings);
});

// Actualizar la configuración
const updateSettings = asyncHandler(async (req, res) => {
    const { basePrice, pricePerBlock } = req.body;
    const settings = await Settings.findOneAndUpdate(
        { singleton: 'main_settings' },
        { basePrice, pricePerBlock },
        { new: true, upsert: true } // upsert: true crea el documento si no existe
    );
    res.json(settings);
});

export { getSettings, updateSettings };