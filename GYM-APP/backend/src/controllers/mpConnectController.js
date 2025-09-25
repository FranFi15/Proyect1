import asyncHandler from 'express-async-handler';
import axios from 'axios';

const getConnectUrl = asyncHandler(async (req, res) => {
    const { platform } = req.body;
    
    const response = await axios.post(
        `${process.env.SUPER_ADMIN_API_URL}/api/connect/mercadopago/url`,
        { platform },
        { headers: { 'Authorization': req.headers.authorization } }
    );
    
    res.json(response.data);
});
// Pide el estado de la conexión al SUPER-ADMIN
const getConnectStatus = asyncHandler(async (req, res) => {
    const response = await axios.get(
        `${process.env.SUPER_ADMIN_API_URL}/api/clients/status`,
        { headers: { 'Authorization': req.headers.authorization } }
    );
    res.json(response.data);
});

export { getConnectUrl, getConnectStatus };