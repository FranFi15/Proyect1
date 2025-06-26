// services/authService.js
import apiClient from './apiClient'
import AsyncStorage from '@react-native-async-storage/async-storage';

// Estas URLs deben apuntar a tus servidores. Reemplaza si es necesario.
const API_BASE_URL_GYM_APP = 'http://192.168.0.109:5000/api';
const API_BASE_URL_SUPERADMIN = 'http://192.168.0.109:6001/api';

// Función para obtener el clientId desde el backend del superadmin
async function fetchClientId(gymIdentifier) {
    try {
        // Llama al endpoint público que creaste para obtener el clientId
        const response = await apiClient.get(`${API_BASE_URL_SUPERADMIN}/public/gym/${gymIdentifier}`);
        return response.data.clientId;
    } catch (error) {
        console.error("Error al resolver el identificador del gimnasio:", error);
        throw new Error("El gimnasio especificado no fue encontrado.");
    }
}

const login = async (credentials, gymIdentifier) => {
    // 1. Obtiene el clientId usando el identificador del gym (ej: "power-gym")
    const clientId = await fetchClientId(gymIdentifier);

    try {
        // 2. Llama al endpoint de login del gym, pasando el clientId en los headers
        const response = await apiClient.post(`${API_BASE_URL_GYM_APP}/auth/login`, credentials, {
            headers: {
                'x-client-id': clientId,
            },
        });

        if (response.data) {
            // 3. Guarda la información del usuario y el clientId en el almacenamiento del dispositivo
            const userPayload = { ...response.data, clientId: clientId, gymIdentifier: gymIdentifier };
            await AsyncStorage.setItem('user', JSON.stringify(userPayload));
        }
        return response.data;
    } catch (error) {
        throw error.response?.data?.message || 'Error de autenticación';
    }
};

const logout = async () => {
    await AsyncStorage.removeItem('user');
};

const getCurrentUser = async () => {
    const user = await AsyncStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};
const getMe = async () => {
    try {
        const response = await apiClient.get('/users/me');
        // Actualizamos los datos en el AsyncStorage también
        await AsyncStorage.setItem('user', JSON.stringify(response.data));
        return response.data;
    } catch (error) {
        console.error("Error al obtener datos del usuario desde la API:", error);
        return null;
    }
};

// Exportamos las funciones para usarlas en la app
const authService = {
    login,
    logout,
    getCurrentUser,
    getMe,
};

export default authService;