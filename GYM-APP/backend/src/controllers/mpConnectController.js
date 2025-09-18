import asyncHandler from 'express-async-handler';
import axios from 'axios';

// @desc    Obtener la URL de autorización de Mercado Pago desde el SUPER-ADMIN
// @route   POST /api/connect/mercadopago/url
// @access  Private/Admin
const getConnectUrl = asyncHandler(async (req, res) => {
    const { platform } = req.body; // 'web' o 'mobile'

    // Hacemos una llamada segura de servidor a servidor
    const response = await axios.post(
        `${process.env.SUPER_ADMIN_API_URL}/api/connect/mercadopago/url`,
        { platform },
        {
            headers: {
                'x-client-id': req.gymId, 
                'x-api-secret-key': process.env.INTERNAL_ADMIN_API_KEY,
            },
        }
    );
    
    res.json(response.data); // Devolvemos la authUrl al frontend
});

export { getConnectUrl };