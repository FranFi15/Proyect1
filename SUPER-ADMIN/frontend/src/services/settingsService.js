// src/services/settingsService.js
import axios from 'axios';
import authService from './authService';

// La URL base de tu API. Debería estar en una variable de entorno.
const API_URL = import.meta.env.VITE_SUPERADMIN_API_URL || 'http://localhost:3000/api';

// Función para obtener la configuración del token de autenticación
const getConfig = () => {
    const token = authService.getToken();
    return {
        headers: {
            Authorization: `Bearer ${token}`
        }
    };
};

// Obtiene la configuración de precios desde el backend
const getSettings = async () => {
    try {
        const response = await axios.get(`${API_URL}/settings`, getConfig());
        return response.data;
    } catch (error) {
        console.error('Error al obtener la configuración de precios:', error.response?.data?.message || error.message);
        throw new Error(error.response?.data?.message || 'Error al obtener la configuración');
    }
};

// Actualiza la configuración de precios en el backend
const updateSettings = async (settingsData) => {
    try {
        const response = await axios.put(`${API_URL}/settings`, settingsData, getConfig());
        return response.data;
    } catch (error) {
        console.error('Error al actualizar la configuración de precios:', error.response?.data?.message || error.message);
        throw new Error(error.response?.data?.message || 'Error al actualizar la configuración');
    }
};

const settingsService = {
    getSettings,
    updateSettings,
};

export default settingsService;


