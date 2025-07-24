// Archivo: MOVIL-APP/services/apiClient.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Apuntamos al backend del GYM-APP en el puerto 5000
const baseURL = process.env.EXPO_PUBLIC_URL_GYM;

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

export default apiClient;