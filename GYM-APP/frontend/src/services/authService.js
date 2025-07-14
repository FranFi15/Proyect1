// src/services/authService.js
import api from './api';


const login = async (credentials) => { // Removed gymIdentifier from parameters
    try {
        // Use the 'api' instance, which already has the x-client-id interceptor
        const response = await api.post(`/auth/login`, credentials); 
        
        if (response.data) {
            // No need to pass clientId back from login response as it's already in session/local storage
            // const userPayload = { ...response.data, clientId: clientId }; // Remove clientId from here
            localStorage.setItem('user', JSON.stringify(response.data)); // Store response.data directly
            window.dispatchEvent(new Event('authChange'));
        }
        return response.data;
    } catch (error) {
        console.error('Error during login:', error.response ? error.response.data : error.message);
        throw error.response ? error.response.data.message : error.message;
    }
};

const registerAdmin = async (userData) => { // Removed gymIdentifier from parameters
    try {
        // Use the 'api' instance, which already has the x-client-id interceptor
        const response = await api.post(`/auth/register`, userData); 
        
        if (response.data.token) {
            // No need to pass clientId back from registration response
            // const userPayload = { ...response.data, clientId: clientId }; // Remove clientId from here
            localStorage.setItem('user', JSON.stringify(response.data)); // Store response.data directly
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
    // This function will rely on clientId being stored in localStorage with the user object
    const clientId = sessionStorage.getItem('clientId'); // Get clientId from sessionStorage for headers
    if (user && user.token && clientId) { 
        return {
            'x-client-id': clientId, // Use clientId from sessionStorage
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