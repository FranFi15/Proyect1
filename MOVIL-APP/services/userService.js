// MOVIL-APP/services/userService.js
import apiClient from './apiClient'; // Ensure apiClient is your configured axios instance for MOVIL-APP

const userService = {
    
    getUserProfile: async () => {
        try {
            const response = await apiClient.get('/users/me'); 
            return response.data;
        } catch (error) {
            console.error('Error fetching user profile (MOVIL-APP):', error);
            throw error.response?.data?.message || 'Error al obtener perfil de usuario.';
        }
    },

};

export default userService;