import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';


const checkSecurityKeyExists = asyncHandler(async (req, res) => {
    const { Settings } = getModels(req.gymDBConnection);
    const settings = await Settings.findById('main_settings').select('+securityKey');
    
    res.json({
        hasSecurityKey: !!settings?.securityKey,
    });
});


const updateSecurityKey = asyncHandler(async (req, res) => {
    const { User, Settings } = getModels(req.gymDBConnection);
    const { currentPassword, newSecurityKey, oldSecurityKey } = req.body;

    if (!newSecurityKey) {
        res.status(400);
        throw new Error('La nueva clave de seguridad es obligatoria.');
    }

    const admin = await User.findById(req.user._id);
    if (!admin || !(await admin.matchPassword(currentPassword))) {
        res.status(401);
        throw new Error('La contraseña de administrador es incorrecta.');
    }

    // 1. Buscamos el documento de configuración o creamos una instancia nueva si no existe
    let settings = await Settings.findById('main_settings').select('+securityKey');
    if (!settings) {
        settings = new Settings();
    }

    // 2. Verificamos la clave antigua si es necesario
    if (settings.securityKey) {
        if (!oldSecurityKey || !(await settings.matchSecurityKey(oldSecurityKey))) {
            res.status(403);
            throw new Error('La clave de seguridad actual es incorrecta.');
        }
    }
    
    // 3. Asignamos la nueva clave y usamos .save() para activar el hook de encriptación
    settings.securityKey = newSecurityKey;
    await settings.save();

    res.json({ message: 'La clave de seguridad ha sido actualizada correctamente.' });
});



const updateMercadoPagoSettings = asyncHandler(async (req, res) => {
    const { Settings } = getModels(req.gymDBConnection);
    const { accessToken, securityKey } = req.body;

    if (!accessToken || !securityKey) {
        res.status(400);
        throw new Error('Se requiere el Access Token y la clave de seguridad.');
    }

    const settings = await Settings.findById('main_settings').select('+securityKey');

    if (!settings || !(await settings.matchSecurityKey(securityKey))) {
        res.status(403);
        throw new Error('La clave de seguridad es incorrecta.');
    }

    settings.mercadoPagoAccessToken = accessToken;
    await settings.save();
    
    res.json({ message: 'Credenciales de Mercado Pago guardadas correctamente.' });
});

export { 
    checkSecurityKeyExists,
    updateSecurityKey,
    updateMercadoPagoSettings 
};