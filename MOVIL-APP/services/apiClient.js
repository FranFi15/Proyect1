// Archivo: MOVIL-APP/services/apiClient.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Apuntamos al backend del GYM-APP en el puerto 5000
const baseURL = process.env.URL_GYM || 'http://192.168.0.100:5000/api';

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
        // La cabecera 'x-client-id' es manejada por AuthContext.
        // No la tocamos aquí.
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default apiClient;