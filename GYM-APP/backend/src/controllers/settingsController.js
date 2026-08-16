import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';

const getSettings = asyncHandler(async (req, res) => {
    const { Settings } = getModels(req.gymDBConnection);
    // Buscamos las configuraciones y populamos
    const settings = await Settings.findById('main_settings').populate('courtesyCredit.tipoClase');
    
    // Devolvemos TODOS los datos, incluyendo bankDetails
    res.json({
        classVisibilityDays: settings?.classVisibilityDays || 0,
        courtesyCredit: settings?.courtesyCredit || { isActive: false, amount: 1, tipoClase: null },
        bankDetails: settings?.bankDetails || { cbu: '', alias: '', bankName: '' },
        cancellationTimeLimitMinutes: settings?.cancellationTimeLimitMinutes ?? 60,
        maxDailyClassesPerUser: settings?.maxDailyClassesPerUser || 0
    });
});

const updateSettings = asyncHandler(async (req, res) => {
    const { classVisibilityDays, courtesyCredit, bankDetails, cancellationTimeLimitMinutes, maxDailyClassesPerUser } = req.body;
    const { Settings } = getModels(req.gymDBConnection);
    
    const updateData = {};
    
    if (classVisibilityDays !== undefined) updateData.classVisibilityDays = Number(classVisibilityDays) || 0;
    if (cancellationTimeLimitMinutes !== undefined) updateData.cancellationTimeLimitMinutes = Number(cancellationTimeLimitMinutes);
    if (maxDailyClassesPerUser !== undefined) updateData.maxDailyClassesPerUser = Number(maxDailyClassesPerUser);

    if (courtesyCredit) {
        // 🔥 VALIDACIÓN CRÍTICA: Comprobamos si es un ObjectId válido (24 caracteres hex)
        // Si viene vacío, null, o incompleto, le asignamos null para evitar el CastError de Mongoose
        const isValidObjectId = courtesyCredit.tipoClase && 
                                typeof courtesyCredit.tipoClase === 'string' && 
                                courtesyCredit.tipoClase.trim() !== "" && 
                                courtesyCredit.tipoClase.length === 24;

        updateData.courtesyCredit = {
            isActive: Boolean(courtesyCredit.isActive),
            tipoClase: isValidObjectId ? courtesyCredit.tipoClase : null, 
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
        { $set: updateData },
        { new: true, upsert: true }
    );
    
    res.json(settings);
});

export { getSettings, updateSettings };