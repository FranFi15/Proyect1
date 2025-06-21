// src/services/clientService.js
import axios from 'axios';
import authService from './authService';

const API_URL = 'http://localhost:8080/api/clients'; // Asegúrate de que esta sea la URL de tu backend de SuperAdmin

// Crear una instancia de Axios con interceptor para añadir el token automáticamente
const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para añadir el token de autenticación a cada petición
apiClient.interceptors.request.use(config => {
    const token = authService.getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

const getClients = async () => {
    try {
        const response = await apiClient.get('/');
        return response.data;
    } catch (error) {
        throw error.response?.data?.message || error.message;
    }
};

const getClientById = async (id) => {
    try {
        const response = await apiClient.get(`/${id}`);
        return response.data;
    } catch (error) {
        throw error.response?.data?.message || error.message;
    }
};

const createClient = async (clientData) => {
    try {
        const response = await apiClient.post('/', clientData);
        return response.data;
    } catch (error) {
        throw error.response?.data?.message || error.message;
    }
};

const updateClient = async (id, clientData) => {
    try {
        const response = await apiClient.put(`/${id}`, clientData);
        return response.data;
    } catch (error) {
        throw error.response?.data?.message || error.message;
    }
};

const deleteClient = async (id) => {
    try {
        const response = await apiClient.delete(`/${id}`);
        return response.data;
    } catch (error) {
        throw error.response?.data?.message || error.message;
    }
};

const clientService = {
    getClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient
};

export default clientService;