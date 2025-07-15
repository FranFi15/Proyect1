// src/services/authService.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_SUPERADMIN_API_URL || 'http://localhost:6001/api';

const login = async (email, password) => {
    try {
        const response = await axios.post(`${API_URL}/login`, { email, password });
        if (response.data.token) {
            localStorage.setItem('superAdminToken', response.data.token);
        }
        return response.data;
    } catch (error) {
        throw error.response?.data?.message || error.message;
    }
};

const logout = () => {
    localStorage.removeItem('superAdminToken');
};

const getToken = () => {
    return localStorage.getItem('superAdminToken');
};

const authService = {
    login,
    logout,
    getToken
};

export default authService;