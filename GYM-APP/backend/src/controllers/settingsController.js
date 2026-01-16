import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';

const getSettings = asyncHandler(async (req, res) => {
    const { Settings } = getModels(req.gymDBConnection);
    const settings = await Settings.findById('main_settings').populate('courtesyCredit.tipoClase');
    res.json({
        classVisibilityDays: settings?.classVisibilityDays || 0,
        courtesyCredit: settings?.courtesyCredit || { isActive: false, amount: 1, tipoClase: null },
    });
});

const updateSettings = asyncHandler(async (req, res) => {
    const { classVisibilityDays, courtesyCredit } = req.body;
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

    const settings = await Settings.findByIdAndUpdate('main_settings', 
        updateData,
        { new: true, upsert: true }
    );
    
    res.json(settings);
});


export { getSettings, updateSettings };