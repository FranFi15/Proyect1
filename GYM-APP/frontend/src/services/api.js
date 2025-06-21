import axios from 'axios';
import appConfig from '../config/appConfig'; // DEBE ESTAR

const API_BASE_URL_GYM_APP = 'http://localhost:5000/api'; // Puerto de tu backend del gimnasio

const gymApiClient = axios.create({
    baseURL: API_BASE_URL_GYM_APP,
    headers: {
        'Content-Type': 'application/json',
        'x-client-id': appConfig.APP_CLIENT_ID,      // USANDO appConfig
        'x-api-secret': appConfig.APP_API_SECRET_KEY // USANDO appConfig
    }
});

gymApiClient.interceptors.request.use( // Esto para añadir el token JWT después del login
    config => {
        const token = localStorage.getItem('gymAdminToken');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    error => Promise.reject(error)
);

export default gymApiClient;