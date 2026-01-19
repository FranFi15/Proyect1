// Archivo: MOVIL-APP/services/apiClient.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config';
import { router } from 'expo-router';

// Apuntamos al backend del GYM-APP en el puerto 5000
const baseURL = config.gymAppBackend;

const apiClient = axios.create({
    baseURL: baseURL,
});


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
    (response) => {
        return response;
    },
    async (error) => {
        if (error.response && error.response.status === 401) {
            console.log("⛔ Sesión expirada (401). Cerrando sesión...");

            await AsyncStorage.removeItem('user');

            router.replace('/login'); 
        }

        return Promise.reject(error);
    }
);

export default apiClient;