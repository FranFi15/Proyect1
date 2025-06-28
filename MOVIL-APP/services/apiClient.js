// Archivo: MOVIL-APP/services/apiClient.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Apuntamos al backend del GYM-APP en el puerto 5000
const baseURL = 'http://192.168.0.9:5000/api'; 

const apiClient = axios.create({
    baseURL: baseURL,
});

// Interceptor para añadir los headers a cada petición
apiClient.interceptors.request.use(
    async (config) => {
        // 1. Busca el objeto de usuario COMPLETO en AsyncStorage
        const userString = await AsyncStorage.getItem('user');

        if (userString) {
            const user = JSON.parse(userString);
            
            // 2. Si el usuario existe y tiene token, adjunta los headers
            if (user && user.token) {
                config.headers.Authorization = `Bearer ${user.token}`;
                
                // --- INICIO DE LA SOLUCIÓN ---
                // Leemos la propiedad correcta: 'clientId', que es como la guardaste en authService.js
                if (user.clientId) {
                    config.headers['x-client-id'] = user.clientId;
                }
                // --- FIN DE LA SOLUCIÓN ---
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default apiClient;