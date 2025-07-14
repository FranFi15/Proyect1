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

    updateUserPushToken: async (token) => {
        try {
            // La ruta debe coincidir con la que creaste en el backend
            const response = await apiClient.put('/users/profile/push-token', { token });
            return response.data;
        } catch (error) {
            // Lanza el error para que el componente que llama pueda manejarlo
            console.error('Error al actualizar el push token:', error.response?.data?.message || error.message);
            throw error;
        }
    },

};

export default userService;