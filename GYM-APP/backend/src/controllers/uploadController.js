import asyncHandler from 'express-async-handler';
import cloudinary from 'cloudinary';

// Configura Cloudinary (esto se hace una sola vez)
cloudinary.v2.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// @desc    Generar una firma para la subida de archivos a Cloudinary
// @route   POST /api/upload/signature
// @access  Private/Profesor con permiso o Admin
const getUploadSignature = asyncHandler(async (req, res) => {
    // Solo usuarios con permiso pueden obtener una firma
    if (!req.user.puedeGestionarEjercicios && !req.user.roles.includes('admin')) {
        res.status(403);
        throw new Error('No tienes permiso para subir archivos.');
    }

    const timestamp = Math.round((new Date).getTime() / 1000);

    // Genera la firma segura usando tu API Secret
    const signature = cloudinary.v2.utils.api_sign_request(
        { 
            timestamp: timestamp,
            upload_preset: 'ml_default' // Opcional: si usas un upload preset en Cloudinary
        },
        process.env.CLOUDINARY_API_SECRET
    );

    res.json({ timestamp, signature });
});

export { getUploadSignature };