// Archivo: MOVIL-APP/services/apiClient.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config';
import { triggerSessionExpired, isEventBlocked   } from './sessionEvent';

const baseURL = config.gymAppBackend;

const apiClient = axios.create({
    baseURL: baseURL,
});

let isLoggingOut = false;

// Interceptor para añadir el token de autorización
apiClient.interceptors.request.use(
    async (config) => {
        const userString = await AsyncStorage.getItem('user');
        if (userString) {
            const user = JSON.parse(userString);
            if (user && user.token) {
                config.headers.Authorization = `Bearer ${user.token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            
            // Si ya se disparó la alerta, no hacemos nada más que rechazar
            if (isLoggingOut || isEventBlocked) {
                return Promise.reject(error);
            }
            isLoggingOut = true;
            console.log("⛔ Sesión expirada. Disparando evento...");
            triggerSessionExpired();
            return Promise.reject(new Error("SESSION_EXPIRED"));
        }
        return Promise.reject(error);
    }
);

export default apiClient;