import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';

const getSettings = asyncHandler(async (req, res) => {
    const { Settings } = getModels(req.gymDBConnection);
    const settings = await Settings.findById('main_settings');
    res.json({
        classVisibilityDays: settings?.classVisibilityDays || 0,
    });
});

const updateSettings = asyncHandler(async (req, res) => {
    const { classVisibilityDays } = req.body;
    const { Settings } = getModels(req.gymDBConnection);
    const settings = await Settings.findByIdAndUpdate('main_settings', 
        { classVisibilityDays: Number(classVisibilityDays) || 0 },
        { new: true, upsert: true }
    );
    res.json(settings);
});

export { getSettings, updateSettings };