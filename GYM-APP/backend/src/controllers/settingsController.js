import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';

// @desc    Verificar si la cuenta de Mercado Pago está conectada
// @route   GET /api/settings/mercadopago-status
// @access  Private/Admin
const getMercadoPagoStatus = asyncHandler(async (req, res) => {
    const { Settings } = getModels(req.gymDBConnection);
    const settings = await Settings.findById('main_settings');

    res.json({
        mpConnected: settings?.mpConnected || false,
    });
});

export { getMercadoPagoStatus };