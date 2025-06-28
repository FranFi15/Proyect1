// Archivo: MOVIL-APP/services/authService.js

import axios from 'axios'; // Asegúrate de que axios esté importado
import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';


const API_BASE_URL_SUPERADMIN = 'http://192.168.0.9:6001/api';

// --- FUNCIÓN DEPURADA ---
async function fetchClientId(gymIdentifier) {
    const url = `${API_BASE_URL_SUPERADMIN}/public/gym/${gymIdentifier}`;
    
    try {
        // Usamos una instancia limpia de axios para evitar conflictos de interceptors
        const response = await axios.get(url);

   

        if (!response.data || !response.data.clientId) {
            throw new Error("Respuesta inválida del servidor de administración.");
        }
        
        const clientId = response.data.clientId;
        return clientId;

    } catch (error) {
        throw new Error("El gimnasio no fue encontrado o el servidor de administración no responde.");
    }
}

const login = async (credentials, gymIdentifier) => {
    // 1. Obtiene el clientId
    const clientId = await fetchClientId(gymIdentifier);

    if (!clientId) {
        console.error("El login no puede continuar porque fetchClientId no devolvió un ID.");
        throw new Error("No se pudo identificar al gimnasio.");
    }

    try {
        const response = await apiClient.post('/auth/login', credentials, {
            headers: { 
                'x-client-id': clientId 
            },
        });

        if (response.data && response.data.token) {
            // Guardamos el clientId que ya obtuvimos, porque la respuesta del login no lo trae.
            const userPayload = { ...response.data, clientId: clientId };
            await AsyncStorage.setItem('user', JSON.stringify(userPayload));
            return userPayload;
        }
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Error de autenticación');
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
        const currentUser = await getCurrentUser();
        const updatedUser = { ...currentUser, ...response.data };
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        return updatedUser;
    } catch (error) {
        console.error("Error al obtener datos del usuario desde la API:", error);
        return null;
    }
};

const authService = {
    login,
    logout,
    getCurrentUser,
    getMe,
};

export default authService;