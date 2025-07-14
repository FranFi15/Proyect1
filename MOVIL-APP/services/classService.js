// MOVIL-APP/services/classService.js
import apiClient from './apiClient'; // Ensure apiClient is your configured axios instance for MOVIL-APP

const classService = {
    
    getAllClasses: async () => {
        try {
            const response = await apiClient.get('/classes'); 
            return response.data;
        } catch (error) {
            console.error('Error fetching all classes:', error);
            throw error.response?.data?.message || 'Error al obtener todas las clases.';
        }
    },

    
    getClassById: async (classId) => {
        try {
            const response = await apiClient.get(`/classes/${classId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching class by ID (${classId}):`, error);
            throw error.response?.data?.message || 'Error al obtener clase por ID.';
        }
    },

   
    subscribeToWaitlist: async (classId) => {
        return apiClient.post(`/classes/${classId}/waitlist/subscribe`);
    },

    
    unsubscribeFromWaitlist: async (classId) => {
        return apiClient.post(`/classes/${classId}/waitlist/unsubscribe`);
    },
   
};

export default classService;