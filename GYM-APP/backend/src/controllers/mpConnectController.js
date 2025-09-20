import asyncHandler from 'express-async-handler';
import { MercadoPagoConfig, OAuth } from 'mercadopago';
import getModels from '../utils/getModels.js';
import connectToGymDB from '../config/mongoConnectionManager.js';

const generateConnectUrl = asyncHandler(async (req, res) => {
    const { platform, code_challenge, code_challenge_method } = req.body;
    const state = `${req.gymId}|${platform}`;
    const redirectUri = `${process.env.SERVER_URL}/api/connect/mercadopago/callback`;
    
    let authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${process.env.MP_APP_ID}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${redirectUri}`;
    
    if (code_challenge && code_challenge_method) {
        authUrl += `&code_challenge=${code_challenge}&code_challenge_method=${code_challenge_method}`;
    }
    
    res.json({ authUrl });
});


const handlePkceCallback = asyncHandler(async (req, res) => {
    const { code, code_verifier, redirect_uri, platform } = req.body;
    const { Settings } = getModels(req.gymDBConnection);

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_SECRET_KEY, options: { clientId: process.env.MP_APP_ID }});
    const oauth = new OAuth(client);

    const response = await oauth.create({
        body: {
            client_secret: process.env.MP_SECRET_KEY,
            grant_type: 'authorization_code',
            code,
            code_verifier,
            redirect_uri,
        }
    });
    

    res.json({ message: 'Conexión exitosa' });
});

export { generateConnectUrl, handlePkceCallback };