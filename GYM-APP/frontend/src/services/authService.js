// src/services/authService.js
import axios from 'axios';

// La URL base del backend de la App de Gym
const API_BASE_URL_GYM_APP = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'; 
// La URL base del backend del Superadmin
const API_BASE_URL_SUPERADMIN = import.meta.env.VITE_SUPERADMIN_API_URL || 'http://localhost:5001/api'; // Asumiendo que corre en otro puerto

// Función para obtener el clientId desde el backend del superadmin
async function fetchClientId(gymIdentifier) {
    try {
        const response = await axios.get(`${API_BASE_URL_SUPERADMIN}/public/gym/${gymIdentifier}`);
        return response.data.clientId;
    } catch (error) {
        console.error("Error al resolver el identificador del gimnasio:", error);
        throw new Error("El gimnasio especificado no fue encontrado o no es válido.");
    }
}

const login = async (credentials, gymIdentifier) => {
    const clientId = await fetchClientId(gymIdentifier);

    try {
        const response = await axios.post(`${API_BASE_URL_GYM_APP}/auth/login`, credentials, {
            headers: {
                'x-client-id': clientId,
                'x-api-secret': import.meta.env.VITE_API_SECRET, 
            },
        });
        
        if (response.data) {
            const userPayload = { ...response.data, clientId: clientId };
            localStorage.setItem('user', JSON.stringify(userPayload));
            window.dispatchEvent(new Event('authChange'));
        }
        return response.data;
    } catch (error) {
        console.error('Error during login:', error.response ? error.response.data : error.message);
        throw error.response ? error.response.data.message : error.message;
    }
};

const registerAdmin = async (userData, gymIdentifier) => {
    const clientId = await fetchClientId(gymIdentifier); 

    try {
        const response = await axios.post(`${API_BASE_URL_GYM_APP}/auth/register`, userData, {
            headers: {
                'x-client-id': clientId,
                'x-api-secret': import.meta.env.VITE_API_SECRET,
            },
        });
         if (response.data.token) {
            const userPayload = { ...response.data, clientId: clientId };
            localStorage.setItem('user', JSON.stringify(userPayload));
            window.dispatchEvent(new Event('authChange'));
        }
        return response.data;
    } catch (error) {
        console.error('Error during registration:', error.response ? error.response.data : error.message);
        throw error.response ? error.response.data.message : error.message;
    }
};

const getCurrentUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};

const logout = () => {
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('authChange'));
};

const getAuthHeaders = () => {
    const user = getCurrentUser();
    if (user && user.token && user.clientId) { 
        return {
            'x-client-id': user.clientId,
            'x-api-secret': import.meta.env.VITE_API_SECRET,
            'Authorization': `Bearer ${user.token}`
        };
    }
    return {};
};


const authService = {
    registerAdmin,
    login,
    getCurrentUser,
    logout,
    getAuthHeaders,
};

export default authService;