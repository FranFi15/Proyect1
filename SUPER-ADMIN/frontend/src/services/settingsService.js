import axios from 'axios';
import authService from './authService';

const API_URL = import.meta.env.VITE_SUPERADMIN_API_URL || 'http://localhost:6001/api';

const apiClient = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(config => {
    const token = authService.getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const getSettings = async () => {
    try {
        const response = await apiClient.get('/settings');
        return response.data;
    } catch (error) {
        throw error.response?.data?.message || error.message;
    }
};

const updateSettings = async (settingsData) => {
    try {
        const response = await apiClient.put('/settings', settingsData);
        return response.data;
    } catch (error) {
        throw error.response?.data?.message || error.message;
    }
};

const settingsService = {
    getSettings,
    updateSettings,
};

export default settingsService;