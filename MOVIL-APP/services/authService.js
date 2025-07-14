// Archivo: MOVIL-APP/services/authService.js

import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';



const register = async (userData) => {
    try {
        // La cabecera x-client-id ya está puesta globalmente por el AuthContext
        const response = await apiClient.post('/auth/register', userData);
        if (response.data && response.data.token) {
            // Guardamos el usuario en AsyncStorage para auto-loguearlo
            await AsyncStorage.setItem('user', JSON.stringify(response.data));
            return response.data;
        }
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Error en el registro');
    }
};

const login = async (credentials) => {

    try {
        const response = await apiClient.post('/auth/login', credentials);

        if (response.data && response.data.token) {
            
            await AsyncStorage.setItem('user', JSON.stringify(response.data));
            return response.data;
        }
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Error de autenticación');
    }
};

const logout = async () => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('gymIdentifier');
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
    register,
    login,
    logout,
    getCurrentUser,
    getMe,
};

export default authService;