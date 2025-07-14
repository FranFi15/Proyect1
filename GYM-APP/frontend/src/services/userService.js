// GYM-APP/frontend/src/services/userService.js
import api from './api'; // Ensure you import your configured axios instance

const userService = {

    getAllUsers: async (role = '') => {
        try {
            const config = {};
            if (role) {
                config.params = { role: role }; // Add role as a query parameter
            }
            const response = await api.get('/users', config);
            return response.data;
        } catch (error) {
            console.error(`Error fetching users (role: ${role}):`, error);
            throw error.response?.data?.message || `Error al obtener usuarios (${role}).`;
        }
    },

   
    getUserById: async (userId) => {
        try {
            const response = await api.get(`/users/${userId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching user by ID (${userId}):`, error);
            throw error.response?.data?.message || `Error al obtener usuario por ID.`;
        }
    },
};

export default userService;