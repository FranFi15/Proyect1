import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';

const getSettings = asyncHandler(async (req, res) => {
    const { Settings } = getModels(req.gymDBConnection);
    // Buscamos las configuraciones y populamos
    const settings = await Settings.findById('main_settings').populate('courtesyCredit.tipoClase');
    
    // 🔥 FIX: Devolvemos TODOS los datos, incluyendo bankDetails
    res.json({
        classVisibilityDays: settings?.classVisibilityDays || 0,
        courtesyCredit: settings?.courtesyCredit || { isActive: false, amount: 1, tipoClase: null },
        bankDetails: settings?.bankDetails || { cbu: '', alias: '', bankName: '' }
    });
});

const updateSettings = asyncHandler(async (req, res) => {
    // 🔥 FIX: Recibimos bankDetails del body
    const { classVisibilityDays, courtesyCredit, bankDetails } = req.body;
    const { Settings } = getModels(req.gymDBConnection);
    
    const updateData = {
        classVisibilityDays: Number(classVisibilityDays) || 0
    };

    if (courtesyCredit) {
        updateData.courtesyCredit = {
            isActive: Boolean(courtesyCredit.isActive),
            tipoClase: courtesyCredit.tipoClase, 
            amount: Number(courtesyCredit.amount) || 1
        };
    }

    if (bankDetails) {
        updateData.bankDetails = {
            cbu: bankDetails.cbu || '',
            alias: bankDetails.alias || '',
            bankName: bankDetails.bankName || ''
        };
    }

    const settings = await Settings.findByIdAndUpdate(
        'main_settings', 
        updateData,
        { new: true, upsert: true }
    );
    
    res.json(settings);
});

export { getSettings, updateSettings };