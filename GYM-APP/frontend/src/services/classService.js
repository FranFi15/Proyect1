// GYM-APP/frontend/src/services/classService.js
import api from './api'; // Ensure you import your configured axios instance

const classService = {
   
    getAllClasses: async () => {
        try {
            const response = await api.get('/classes'); // Assuming '/classes' endpoint returns all classes
            return response.data;
        } catch (error) {
            console.error('Error fetching all classes:', error);
            throw error.response?.data?.message || 'Error al obtener todas las clases.';
        }
    },

    
    getClassById: async (classId) => {
        try {
            const response = await api.get(`/classes/${classId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching class by ID (${classId}):`, error);
            throw error.response?.data?.message || 'Error al obtener clase por ID.';
        }
    },
};

export default classService;